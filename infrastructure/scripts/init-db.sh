#!/bin/bash

# Enterprise-grade database initialization script for technology transfer platform
# Version: 1.0.0
# Implements comprehensive database setup with security, monitoring, and health checks

set -euo pipefail

# Script directory and configuration
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
LOG_FILE="/var/log/init-db.log"
MAX_RETRIES=3
BACKUP_RETENTION_DAYS=30
MONITORING_PORT=9090
HEALTH_CHECK_INTERVAL=60
SSL_CERT_PATH="/etc/ssl/certs/db-cert.pem"
PROMETHEUS_CONFIG="/etc/prometheus/db-targets.yml"

# Load environment variables
source "${SCRIPT_DIR}/.env" 2>/dev/null || true

# Logging function with timestamps
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [${level}] $*" | tee -a "${LOG_FILE}"
}

# Error handling function
handle_error() {
    local exit_code=$?
    log "ERROR" "An error occurred on line $1"
    if [[ -n ${2:-} ]]; then
        log "ERROR" "Additional context: $2"
    fi
    exit "${exit_code}"
}

trap 'handle_error ${LINENO}' ERR

# Check prerequisites function
check_prerequisites() {
    log "INFO" "Checking prerequisites..."

    # Check required tools
    local required_tools=("psql" "mongosh" "redis-cli" "openssl" "curl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "${tool}" &>/dev/null; then
            log "ERROR" "Required tool not found: ${tool}"
            return 1
        fi
    done

    # Verify PostgreSQL version
    local pg_version
    pg_version=$(psql --version | awk '{print $3}' | cut -d. -f1)
    if [[ ${pg_version} -lt 14 ]]; then
        log "ERROR" "PostgreSQL version must be 14 or higher"
        return 1
    fi

    # Check environment variables
    local required_vars=(
        "POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD"
        "MONGO_URI" "MONGO_DB"
        "REDIS_HOST" "REDIS_PORT"
    )
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Required environment variable not set: ${var}"
            return 1
        fi
    done

    # Verify SSL certificates
    if [[ ! -f "${SSL_CERT_PATH}" ]]; then
        log "ERROR" "SSL certificate not found at ${SSL_CERT_PATH}"
        return 1
    }

    log "INFO" "Prerequisites check completed successfully"
    return 0
}

# Initialize PostgreSQL with TimescaleDB
init_postgres() {
    log "INFO" "Initializing PostgreSQL database..."

    # Create database with proper encoding
    psql -v ON_ERROR_STOP=1 <<-EOSQL
        CREATE DATABASE "${POSTGRES_DB}" WITH ENCODING 'UTF8' LC_COLLATE 'en_US.UTF-8' LC_CTYPE 'en_US.UTF-8';
        \c "${POSTGRES_DB}"
        
        -- Enable required extensions
        CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
        CREATE EXTENSION IF NOT EXISTS pgcrypto;
        
        -- Configure connection pooling
        ALTER SYSTEM SET max_connections = '200';
        ALTER SYSTEM SET shared_buffers = '1GB';
        ALTER SYSTEM SET work_mem = '16MB';
        
        -- Configure WAL and archiving
        ALTER SYSTEM SET wal_level = 'replica';
        ALTER SYSTEM SET archive_mode = 'on';
        ALTER SYSTEM SET archive_command = 'test ! -f /archive/%f && cp %p /archive/%f';
        
        -- Set up SSL
        ALTER SYSTEM SET ssl = 'on';
        ALTER SYSTEM SET ssl_cert_file = '${SSL_CERT_PATH}';
EOSQL

    # Apply initial schema migration
    psql -v ON_ERROR_STOP=1 -d "${POSTGRES_DB}" -f "${SCRIPT_DIR}/../../src/backend/src/db/migrations/001_initial_schema.sql"

    # Configure Prometheus monitoring
    cat > "${PROMETHEUS_CONFIG}" <<-EOF
        - job_name: 'postgresql'
          static_configs:
            - targets: ['localhost:9187']
          metrics_path: '/metrics'
EOF

    log "INFO" "PostgreSQL initialization completed"
}

# Initialize MongoDB with sharding and security
init_mongodb() {
    log "INFO" "Initializing MongoDB..."

    # Configure MongoDB with authentication and sharding
    mongosh "${MONGO_URI}" --eval "
        use ${MONGO_DB};
        
        // Enable sharding
        sh.enableSharding('${MONGO_DB}');
        
        // Create collections with validation
        db.createCollection('proposals', {
            validator: {
                \$jsonSchema: {
                    bsonType: 'object',
                    required: ['user_id', 'technology_id', 'content'],
                    properties: {
                        user_id: { bsonType: 'string' },
                        technology_id: { bsonType: 'string' },
                        content: { bsonType: 'string' },
                        version: { bsonType: 'int' }
                    }
                }
            }
        });
        
        // Create indexes
        db.proposals.createIndex({ user_id: 1, technology_id: 1 });
        db.proposals.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 });
        
        // Configure audit logging
        db.setProfilingLevel(1, { slowms: 100 });
    "

    # Configure MongoDB Exporter for Prometheus
    cat >> "${PROMETHEUS_CONFIG}" <<-EOF
        - job_name: 'mongodb'
          static_configs:
            - targets: ['localhost:9216']
          metrics_path: '/metrics'
EOF

    log "INFO" "MongoDB initialization completed"
}

# Initialize Redis for caching
init_redis() {
    log "INFO" "Initializing Redis..."

    # Configure Redis with persistence and security
    redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" CONFIG SET protected-mode yes
    redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" CONFIG SET maxmemory "2gb"
    redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" CONFIG SET maxmemory-policy allkeys-lru
    redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" CONFIG SET appendonly yes
    redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" CONFIG SET appendfsync everysec
    
    # Configure Redis Exporter for Prometheus
    cat >> "${PROMETHEUS_CONFIG}" <<-EOF
        - job_name: 'redis'
          static_configs:
            - targets: ['localhost:9121']
          metrics_path: '/metrics'
EOF

    log "INFO" "Redis initialization completed"
}

# Set up monitoring and health checks
setup_monitoring() {
    log "INFO" "Setting up monitoring..."

    # Create health check script
    cat > "/usr/local/bin/db-health-check" <<-'EOF'
#!/bin/bash
check_postgres() {
    psql -c "SELECT 1" >/dev/null 2>&1
}

check_mongo() {
    mongosh --eval "db.runCommand({ ping: 1 })" >/dev/null 2>&1
}

check_redis() {
    redis-cli ping >/dev/null 2>&1
}

main() {
    local status=0
    check_postgres || status=$((status + 1))
    check_mongo || status=$((status + 2))
    check_redis || status=$((status + 4))
    return ${status}
}

main
EOF
    chmod +x "/usr/local/bin/db-health-check"

    # Set up cron job for health checks
    echo "*/${HEALTH_CHECK_INTERVAL} * * * * /usr/local/bin/db-health-check || curl -X POST http://alerts.example.com/webhook" | crontab -

    log "INFO" "Monitoring setup completed"
}

# Main execution
main() {
    log "INFO" "Starting database initialization..."

    # Check prerequisites
    check_prerequisites || exit 1

    # Initialize databases
    init_postgres
    init_mongodb
    init_redis

    # Setup monitoring
    setup_monitoring

    log "INFO" "Database initialization completed successfully"
}

main "$@"