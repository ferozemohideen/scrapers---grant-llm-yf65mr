# Project and Environment Configuration
# Version: 1.0
# Last Updated: 2024-02-20
# Purpose: Development environment variable definitions for Tech Transfer Data Aggregation system

# Core Project Settings
project_name = "tech-transfer"
environment  = "dev"
aws_region   = "us-west-2"

# Network Configuration
vpc_cidr            = "10.0.0.0/16"
availability_zones  = ["us-west-2a", "us-west-2b"]

# ECS Configuration - Development Optimized
ecs_instance_type = "t3.small"  # Cost-effective instance suitable for development workloads
min_capacity      = 1          # Minimum tasks to maintain basic functionality
max_capacity      = 4          # Maximum tasks capped for cost control

# Database Configuration - Development Sized
rds_instance_class       = "db.t3.small"  # Balanced performance and cost for development
redis_node_type         = "cache.t3.small"  # Sufficient for development caching needs
documentdb_instance_class = "db.t3.small"  # Cost-effective for development document storage

# Additional Tags
tags = {
  Environment     = "development"
  ManagedBy      = "terraform"
  Project        = "tech-transfer"
  CostCenter     = "development"
  DataSensitivity = "internal"
}

# Resource Configurations
resource_configs = {
  # ECS Task Memory/CPU Configuration
  ecs_task = {
    memory = "2048"  # 2GB memory allocation for development tasks
    cpu    = "512"   # 0.5 vCPU allocation for development workloads
  }
  
  # RDS Storage Configuration
  rds = {
    allocated_storage     = 20    # 20GB storage for development database
    max_allocated_storage = 50    # Allow growth up to 50GB
    backup_retention     = 3     # 3 days backup retention for development
  }
  
  # Redis Configuration
  redis = {
    num_cache_nodes = 1          # Single node for development
    port           = 6379
    snapshot_retention = 1        # 1 day snapshot retention for development
  }
  
  # DocumentDB Configuration
  documentdb = {
    instance_count = 1           # Single instance for development
    backup_retention = 1         # 1 day backup retention
    storage_encrypted = true     # Maintain encryption even in development
  }
}

# Monitoring and Logging
monitoring_config = {
  log_retention_days = 7         # Shorter log retention for development
  detailed_monitoring = false    # Basic monitoring for cost savings
  alarm_evaluation_periods = 2   # Reduced evaluation periods for development
}

# Security Groups
security_group_rules = {
  allow_internal = {
    from_port = 0
    to_port   = 65535
    protocol  = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }
  allow_https = {
    from_port = 443
    to_port   = 443
    protocol  = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Backup Configuration
backup_config = {
  enabled = true
  schedule = "cron(0 0 ? * MON-FRI *)"  # Weekday backups only for development
  retention_days = 7
}

# Auto Scaling Configuration
autoscaling_config = {
  cpu_threshold = 75
  memory_threshold = 80
  scale_in_cooldown = 300
  scale_out_cooldown = 300
}