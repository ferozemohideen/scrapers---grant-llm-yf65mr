# Production Environment Configuration
# Purpose: Defines infrastructure parameters for production deployment of the Technology Transfer Data Aggregation system
# Last Updated: 2024-02-20

# Project Identification
project_name = "tech-transfer"
environment  = "prod"

# Regional Configuration
aws_region = "us-west-2"

# Network Configuration
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "us-west-2a",
  "us-west-2b",
  "us-west-2c"
]

# ECS Configuration
# t3.large provides 2 vCPU and 8GB RAM for production workloads
ecs_instance_type = "t3.large"
min_capacity      = 4  # Baseline capacity for high availability
max_capacity      = 10 # Maximum capacity for peak loads

# Database Configuration
# db.t3.large provides balanced compute and memory for production database
rds_instance_class = "db.t3.large"

# Caching Configuration
# cache.t3.large provides sufficient memory and network performance for production caching
redis_node_type = "cache.t3.large"

# Document Store Configuration
# db.t3.large provides appropriate compute resources for document storage
documentdb_instance_class = "db.t3.large"