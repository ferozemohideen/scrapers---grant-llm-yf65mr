#!/bin/bash

# Database Backup Script
# Version: 1.0.0
# Implements enterprise-grade backup procedures for PostgreSQL, MongoDB, and Redis
# with encryption, validation, and S3 upload capabilities.

# Required tool versions:
# postgresql-client: v14
# mongodb-database-tools: v6.0
# redis-tools: v6.0
# awscli: v2.0
# openssl: v1.1.1

set -euo pipefail

# Script directory and global constants
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
LOG_FILE="/var/log/backup-db.log"
BACKUP_DIR="/tmp/backups"
MAX_RETRIES=3
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
ENCRYPTION_ALGORITHM="aes-256-cbc"
COMPRESSION_LEVEL=9
PARALLEL_JOBS=4

# Logging function with timestamps
log() {
    local level="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" | tee -a "$LOG_FILE"
}

# Error handling function
handle_error() {
    local error_message="$1"
    local error_code="${2:-1}"
    log "ERROR" "$error_message"
    notify_admin "Backup Error" "$error_message"
    exit "$error_code"
}

# Admin notification function
notify_admin() {
    local subject="$1"
    local message="$2"
    if [[ -n "${NOTIFICATION_EMAIL:-}" ]]; then
        echo "$message" | mail -s "[Backup Alert] $subject" "$NOTIFICATION_EMAIL"
    fi
}

# Prerequisite check function
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check required tools
    local required_tools=("pg_dump" "mongodump" "redis-cli" "aws" "openssl")
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            handle_error "Required tool not found: $tool"
        fi
    done

    # Verify environment variables
    local required_vars=(
        "POSTGRES_HOST" "POSTGRES_PORT" "POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD"
        "MONGO_URI" "MONGO_DB" "REDIS_HOST" "REDIS_PORT"
        "AWS_ACCESS_KEY_ID" "AWS_SECRET_ACCESS_KEY" "AWS_DEFAULT_REGION" "S3_BUCKET"
        "ENCRYPTION_KEY"
    )
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            handle_error "Required environment variable not set: $var"
        fi
    done

    # Create backup directory
    mkdir -p "$BACKUP_DIR" || handle_error "Failed to create backup directory"

    # Verify S3 bucket access
    aws s3 ls "s3://${S3_BUCKET}" &>/dev/null || handle_error "Cannot access S3 bucket"

    log "INFO" "Prerequisites check completed successfully"
    return 0
}

# PostgreSQL backup function
backup_postgres() {
    local backup_type="$1"
    local timestamp="$(date +%Y%m%d_%H%M%S)"
    local backup_file="${BACKUP_DIR}/postgres_${backup_type}_${timestamp}.sql"
    local encrypted_file="${backup_file}.enc"
    
    log "INFO" "Starting PostgreSQL backup (${backup_type})..."

    # Perform backup with retry logic
    local retry_count=0
    while [[ $retry_count -lt $MAX_RETRIES ]]; do
        if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
            -h "$POSTGRES_HOST" \
            -p "$POSTGRES_PORT" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            --verbose \
            --format=custom \
            --compress=$COMPRESSION_LEVEL \
            --file="$backup_file" 2>> "$LOG_FILE"; then
            break
        fi
        
        ((retry_count++))
        log "WARN" "PostgreSQL backup attempt $retry_count failed, retrying..."
        sleep $((2 ** retry_count))
    done

    if [[ $retry_count -eq $MAX_RETRIES ]]; then
        handle_error "PostgreSQL backup failed after $MAX_RETRIES attempts"
    fi

    # Generate checksum
    local checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
    
    # Encrypt backup
    openssl enc -$ENCRYPTION_ALGORITHM -salt \
        -in "$backup_file" \
        -out "$encrypted_file" \
        -k "$ENCRYPTION_KEY" || handle_error "Encryption failed"

    # Upload to S3 with metadata
    aws s3 cp "$encrypted_file" \
        "s3://${S3_BUCKET}/postgres/${timestamp}/" \
        --metadata "checksum=$checksum,backup_type=$backup_type" \
        || handle_error "S3 upload failed"

    # Cleanup
    rm -f "$backup_file" "$encrypted_file"
    
    log "INFO" "PostgreSQL backup completed successfully"
    echo "$encrypted_file:$checksum"
}

# MongoDB backup function
backup_mongodb() {
    local timestamp="$(date +%Y%m%d_%H%M%S)"
    local backup_dir="${BACKUP_DIR}/mongo_${timestamp}"
    local archive_file="${BACKUP_DIR}/mongo_${timestamp}.archive"
    local encrypted_file="${archive_file}.enc"

    log "INFO" "Starting MongoDB backup..."

    # Perform backup with retry logic
    local retry_count=0
    while [[ $retry_count -lt $MAX_RETRIES ]]; do
        if mongodump \
            --uri="$MONGO_URI" \
            --db="$MONGO_DB" \
            --out="$backup_dir" \
            --gzip \
            --numParallelCollections=$PARALLEL_JOBS 2>> "$LOG_FILE"; then
            break
        fi
        
        ((retry_count++))
        log "WARN" "MongoDB backup attempt $retry_count failed, retrying..."
        sleep $((2 ** retry_count))
    done

    if [[ $retry_count -eq $MAX_RETRIES ]]; then
        handle_error "MongoDB backup failed after $MAX_RETRIES attempts"
    fi

    # Create archive
    tar -czf "$archive_file" -C "$backup_dir" . || handle_error "Archive creation failed"
    
    # Generate checksum
    local checksum=$(sha256sum "$archive_file" | cut -d' ' -f1)
    
    # Encrypt backup
    openssl enc -$ENCRYPTION_ALGORITHM -salt \
        -in "$archive_file" \
        -out "$encrypted_file" \
        -k "$ENCRYPTION_KEY" || handle_error "Encryption failed"

    # Upload to S3 with metadata
    aws s3 cp "$encrypted_file" \
        "s3://${S3_BUCKET}/mongodb/${timestamp}/" \
        --metadata "checksum=$checksum" \
        || handle_error "S3 upload failed"

    # Cleanup
    rm -rf "$backup_dir" "$archive_file" "$encrypted_file"
    
    log "INFO" "MongoDB backup completed successfully"
    echo "$encrypted_file:$checksum"
}

# Redis backup function
backup_redis() {
    local timestamp="$(date +%Y%m%d_%H%M%S)"
    local backup_file="${BACKUP_DIR}/redis_${timestamp}.rdb"
    local encrypted_file="${backup_file}.enc"

    log "INFO" "Starting Redis backup..."

    # Trigger SAVE command
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" SAVE || handle_error "Redis SAVE failed"
    
    # Copy dump file
    redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" --rdb "$backup_file" || handle_error "Redis backup failed"
    
    # Generate checksum
    local checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
    
    # Encrypt backup
    openssl enc -$ENCRYPTION_ALGORITHM -salt \
        -in "$backup_file" \
        -out "$encrypted_file" \
        -k "$ENCRYPTION_KEY" || handle_error "Encryption failed"

    # Upload to S3 with metadata
    aws s3 cp "$encrypted_file" \
        "s3://${S3_BUCKET}/redis/${timestamp}/" \
        --metadata "checksum=$checksum" \
        || handle_error "S3 upload failed"

    # Cleanup
    rm -f "$backup_file" "$encrypted_file"
    
    log "INFO" "Redis backup completed successfully"
    echo "$encrypted_file:$checksum"
}

# Cleanup old backups function
cleanup_old_backups() {
    log "INFO" "Starting backup cleanup..."
    
    local retention_date=$(date -d "$BACKUP_RETENTION_DAYS days ago" +%Y%m%d)
    local deleted_count=0

    # List and delete old backups
    for db_type in "postgres" "mongodb" "redis"; do
        local old_backups=$(aws s3 ls "s3://${S3_BUCKET}/${db_type}/" \
            | awk '{print $2}' \
            | grep -E '^[0-9]{8}_[0-9]{6}/$' \
            | cut -d'_' -f1 \
            | while read -r date; do
                if [[ "$date" < "$retention_date" ]]; then
                    echo "${db_type}/${date}_"
                fi
            })

        for backup in $old_backups; do
            aws s3 rm "s3://${S3_BUCKET}/${backup}" --recursive && ((deleted_count++))
        done
    done

    log "INFO" "Cleanup completed. Removed $deleted_count old backups"
    return "$deleted_count"
}

# Main execution
main() {
    log "INFO" "Starting database backup process..."
    
    # Check prerequisites
    check_prerequisites || exit 1
    
    # Create timestamped backup directory
    local timestamp="$(date +%Y%m%d_%H%M%S)"
    local backup_dir="${BACKUP_DIR}/${timestamp}"
    mkdir -p "$backup_dir"
    
    # Perform backups
    backup_postgres "full"
    backup_mongodb
    backup_redis
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Cleanup temporary directory
    rm -rf "$backup_dir"
    
    log "INFO" "Backup process completed successfully"
}

# Execute main function
main "$@"