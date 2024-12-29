# Project Identification
project_name = "tech-transfer"
environment  = "staging"

# Region Configuration
aws_region = "us-west-2"

# Network Configuration
vpc_cidr = "10.1.0.0/16"
availability_zones = [
  "us-west-2a",
  "us-west-2b"
]

# ECS Configuration
ecs_instance_type = "t3.medium"
min_capacity      = 2
max_capacity      = 4

# Database Configuration
rds_instance_class        = "db.t3.medium"
redis_node_type          = "cache.t3.medium"
documentdb_instance_class = "db.t3.medium"

# Tags that will be applied to all resources
common_tags = {
  Project     = "tech-transfer"
  Environment = "staging"
  ManagedBy   = "terraform"
  Purpose     = "technology-transfer-data-aggregation"
}

# Monitoring and Scaling Configuration
monitoring_enabled = true
backup_retention_days = 7

# Security Configuration
enable_encryption = true
multi_az_enabled  = true

# Performance Configuration
performance_insights_enabled = true
enhanced_monitoring_enabled = true

# Cost Optimization
instance_termination_protection = false
auto_minor_version_upgrade     = true