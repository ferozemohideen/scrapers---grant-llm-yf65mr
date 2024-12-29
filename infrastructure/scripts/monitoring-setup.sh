#!/bin/bash

# Monitoring Stack Setup Script v1.0.0
# Sets up and configures Prometheus, Grafana, ELK Stack, and Jaeger
# Supports both Docker Compose and Kubernetes deployments
# Author: System Architect
# Last Updated: 2024-02-20

set -euo pipefail

# Version constants for monitoring components
readonly PROMETHEUS_VERSION="2.45.0"
readonly GRAFANA_VERSION="9.5.0"
readonly ELASTICSEARCH_VERSION="8.9.0"
readonly LOGSTASH_VERSION="8.9.0"
readonly KIBANA_VERSION="8.9.0"
readonly JAEGER_VERSION="1.47.0"

# Directory constants
readonly MONITORING_BASE_DIR="/opt/monitoring"
readonly LOG_DIR="/var/log/monitoring"
readonly BACKUP_DIR="/var/backup/monitoring"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Verify root privileges
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root"
        exit 1
    fi
}

# Verify required tools
check_prerequisites() {
    local missing_tools=()
    
    # Check for required tools
    for tool in docker-compose kubectl curl jq; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
}

# Create required directories
setup_directories() {
    local dirs=(
        "$MONITORING_BASE_DIR"
        "$LOG_DIR"
        "$BACKUP_DIR"
        "$MONITORING_BASE_DIR/prometheus"
        "$MONITORING_BASE_DIR/grafana"
        "$MONITORING_BASE_DIR/elasticsearch"
        "$MONITORING_BASE_DIR/logstash"
        "$MONITORING_BASE_DIR/kibana"
        "$MONITORING_BASE_DIR/jaeger"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        chmod 755 "$dir"
    done
}

# Setup Prometheus
setup_prometheus() {
    local environment="$1"
    local deployment_mode="$2"
    
    log_info "Setting up Prometheus v${PROMETHEUS_VERSION} for ${environment} environment"
    
    # Backup existing config if present
    if [[ -f "$MONITORING_BASE_DIR/prometheus/prometheus.yml" ]]; then
        cp "$MONITORING_BASE_DIR/prometheus/prometheus.yml" \
           "$BACKUP_DIR/prometheus-$(date +%Y%m%d-%H%M%S).yml"
    fi
    
    # Copy base configuration
    cp "$SCRIPT_DIR/../docker/monitoring/prometheus/prometheus.yml" \
       "$MONITORING_BASE_DIR/prometheus/prometheus.yml"
    
    # Environment-specific configurations
    case "$environment" in
        production)
            # Configure high availability settings
            cat >> "$MONITORING_BASE_DIR/prometheus/prometheus.yml" <<EOF
global:
  external_labels:
    environment: production
  scrape_interval: 10s
  evaluation_interval: 10s

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
EOF
            ;;
        staging)
            # Staging-specific settings
            sed -i 's/scrape_interval: 15s/scrape_interval: 30s/' \
                "$MONITORING_BASE_DIR/prometheus/prometheus.yml"
            ;;
        development)
            # Development-specific settings
            sed -i 's/scrape_interval: 15s/scrape_interval: 1m/' \
                "$MONITORING_BASE_DIR/prometheus/prometheus.yml"
            ;;
    esac
    
    # Deploy based on mode
    if [[ "$deployment_mode" == "kubernetes" ]]; then
        kubectl apply -f "$SCRIPT_DIR/../k8s/monitoring/prometheus/"
    else
        docker-compose -f "$SCRIPT_DIR/../docker/monitoring/docker-compose.yml" \
                      up -d prometheus
    fi
    
    # Verify deployment
    local retries=0
    while ! curl -s "http://localhost:9090/-/healthy" > /dev/null; do
        if ((retries >= 5)); then
            log_error "Prometheus failed to start"
            return 1
        fi
        log_warn "Waiting for Prometheus to start..."
        sleep 10
        ((retries++))
    done
    
    log_info "Prometheus setup completed successfully"
    return 0
}

# Setup Grafana
setup_grafana() {
    local environment="$1"
    local deployment_mode="$2"
    
    log_info "Setting up Grafana v${GRAFANA_VERSION} for ${environment} environment"
    
    # Copy datasources configuration
    cp "$SCRIPT_DIR/../docker/monitoring/grafana/datasources.yml" \
       "$MONITORING_BASE_DIR/grafana/provisioning/datasources/"
    
    # Copy dashboard configuration
    mkdir -p "$MONITORING_BASE_DIR/grafana/provisioning/dashboards"
    cp "$SCRIPT_DIR/../docker/monitoring/grafana/dashboards/scraper.json" \
       "$MONITORING_BASE_DIR/grafana/provisioning/dashboards/"
    
    # Environment-specific configurations
    case "$environment" in
        production)
            # Production security settings
            cat > "$MONITORING_BASE_DIR/grafana/grafana.ini" <<EOF
[security]
admin_user = admin
admin_password = ${GRAFANA_ADMIN_PASSWORD:-admin}
disable_gravatar = true
cookie_secure = true
[auth.anonymous]
enabled = false
EOF
            ;;
        staging|development)
            # Non-production settings
            cat > "$MONITORING_BASE_DIR/grafana/grafana.ini" <<EOF
[security]
admin_user = admin
admin_password = admin
[auth.anonymous]
enabled = true
org_role = Viewer
EOF
            ;;
    esac
    
    # Deploy based on mode
    if [[ "$deployment_mode" == "kubernetes" ]]; then
        kubectl apply -f "$SCRIPT_DIR/../k8s/monitoring/grafana/"
    else
        docker-compose -f "$SCRIPT_DIR/../docker/monitoring/docker-compose.yml" \
                      up -d grafana
    fi
    
    # Verify deployment
    local retries=0
    while ! curl -s "http://localhost:3000/api/health" > /dev/null; do
        if ((retries >= 5)); then
            log_error "Grafana failed to start"
            return 1
        fi
        log_warn "Waiting for Grafana to start..."
        sleep 10
        ((retries++))
    done
    
    log_info "Grafana setup completed successfully"
    return 0
}

# Setup ELK Stack
setup_elk() {
    local environment="$1"
    local deployment_mode="$2"
    
    log_info "Setting up ELK Stack (ES: ${ELASTICSEARCH_VERSION}, Logstash: ${LOGSTASH_VERSION}, Kibana: ${KIBANA_VERSION})"
    
    # Configure Elasticsearch
    cat > "$MONITORING_BASE_DIR/elasticsearch/elasticsearch.yml" <<EOF
cluster.name: tech-transfer-cluster
node.name: node-1
network.host: 0.0.0.0
discovery.type: single-node
xpack.security.enabled: true
EOF
    
    # Deploy based on mode
    if [[ "$deployment_mode" == "kubernetes" ]]; then
        kubectl apply -f "$SCRIPT_DIR/../k8s/monitoring/elk/"
    else
        docker-compose -f "$SCRIPT_DIR/../docker/monitoring/docker-compose.yml" \
                      up -d elasticsearch logstash kibana
    fi
    
    log_info "ELK Stack setup completed"
    return 0
}

# Setup Jaeger
setup_jaeger() {
    local environment="$1"
    local deployment_mode="$2"
    
    log_info "Setting up Jaeger v${JAEGER_VERSION} for distributed tracing"
    
    if [[ "$deployment_mode" == "kubernetes" ]]; then
        kubectl apply -f "$SCRIPT_DIR/../k8s/monitoring/jaeger/"
    else
        docker-compose -f "$SCRIPT_DIR/../docker/monitoring/docker-compose.yml" \
                      up -d jaeger
    fi
    
    log_info "Jaeger setup completed"
    return 0
}

# Verify entire monitoring stack
verify_setup() {
    local environment="$1"
    local deployment_mode="$2"
    local failed=0
    
    log_info "Verifying monitoring stack deployment..."
    
    # Verify Prometheus
    if ! curl -s "http://localhost:9090/-/healthy" > /dev/null; then
        log_error "Prometheus verification failed"
        failed=1
    fi
    
    # Verify Grafana
    if ! curl -s "http://localhost:3000/api/health" > /dev/null; then
        log_error "Grafana verification failed"
        failed=1
    fi
    
    # Verify Elasticsearch
    if ! curl -s "http://localhost:9200/_cluster/health" > /dev/null; then
        log_error "Elasticsearch verification failed"
        failed=1
    fi
    
    # Verify Jaeger
    if ! curl -s "http://localhost:16686/api/traces" > /dev/null; then
        log_error "Jaeger verification failed"
        failed=1
    fi
    
    if [[ $failed -eq 0 ]]; then
        log_info "All monitoring components verified successfully"
        return 0
    else
        log_error "Monitoring stack verification failed"
        return 1
    fi
}

# Main setup function
main() {
    local environment="${1:-development}"
    local deployment_mode="${2:-docker-compose}"
    
    # Validate inputs
    if [[ ! "$environment" =~ ^(development|staging|production)$ ]]; then
        log_error "Invalid environment. Must be one of: development, staging, production"
        exit 1
    fi
    
    if [[ ! "$deployment_mode" =~ ^(docker-compose|kubernetes)$ ]]; then
        log_error "Invalid deployment mode. Must be one of: docker-compose, kubernetes"
        exit 1
    fi
    
    # Run setup steps
    check_root
    check_prerequisites
    setup_directories
    
    # Setup components
    setup_prometheus "$environment" "$deployment_mode" || exit 1
    setup_grafana "$environment" "$deployment_mode" || exit 1
    setup_elk "$environment" "$deployment_mode" || exit 1
    setup_jaeger "$environment" "$deployment_mode" || exit 1
    
    # Verify setup
    verify_setup "$environment" "$deployment_mode"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
```

This script provides a comprehensive setup for the monitoring stack with the following key features:

1. Supports both Docker Compose and Kubernetes deployments
2. Environment-specific configurations (development, staging, production)
3. Automated setup of Prometheus, Grafana, ELK Stack, and Jaeger
4. Robust error handling and logging
5. Verification of component health after setup
6. Backup of existing configurations
7. Security considerations for production environments
8. Integration with imported configuration files

The script can be executed with:
```bash
sudo ./monitoring-setup.sh [environment] [deployment_mode]
```

Example usage:
```bash
# For development with Docker Compose
sudo ./monitoring-setup.sh development docker-compose

# For production with Kubernetes
sudo ./monitoring-setup.sh production kubernetes