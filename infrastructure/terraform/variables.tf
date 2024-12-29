# Core Project Variables
variable "project_name" {
  description = "Name of the technology transfer data aggregation project"
  type        = string
  default     = "tech-transfer"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod) with specific security and scaling configurations"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod"
  }
}

variable "aws_region" {
  description = "AWS region for infrastructure deployment with failover configuration"
  type        = string
  default     = "us-west-2"
  validation {
    condition     = contains(["us-west-2", "us-east-1", "eu-west-1"], var.aws_region)
    error_message = "Region must be one of the approved regions for compliance"
  }
}

# Networking Variables
variable "vpc_cidr" {
  description = "CIDR block for VPC network with subnet allocation strategy"
  type        = string
  default     = "10.0.0.0/16"
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "VPC CIDR must be a valid IPv4 CIDR block"
  }
}

variable "availability_zones" {
  description = "List of availability zones for multi-AZ deployment with failover support"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c"]
}

# Compute Variables
variable "ecs_instance_type" {
  description = "EC2 instance type for ECS cluster nodes with CPU and memory specifications"
  type        = string
  default     = "t3.large"
  validation {
    condition     = contains(["t3.medium", "t3.large", "t3.xlarge"], var.ecs_instance_type)
    error_message = "Instance type must be appropriate for production workloads"
  }
}

variable "min_capacity" {
  description = "Minimum number of ECS tasks for high availability"
  type        = number
  default     = 2
  validation {
    condition     = var.min_capacity >= 2
    error_message = "Minimum capacity must be at least 2 for high availability"
  }
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks for peak load handling"
  type        = number
  default     = 20
  validation {
    condition     = var.max_capacity >= var.min_capacity * 2
    error_message = "Maximum capacity must be at least double the minimum capacity"
  }
}

# Database Variables
variable "rds_instance_class" {
  description = "RDS instance class for PostgreSQL database with performance specifications"
  type        = string
  default     = "db.t3.large"
  validation {
    condition     = contains(["db.t3.medium", "db.t3.large", "db.r5.large"], var.rds_instance_class)
    error_message = "RDS instance class must meet minimum performance requirements"
  }
}

variable "redis_node_type" {
  description = "ElastiCache node type for Redis cache with memory optimization"
  type        = string
  default     = "cache.t3.medium"
  validation {
    condition     = contains(["cache.t3.medium", "cache.t3.large"], var.redis_node_type)
    error_message = "Redis node type must support required cache capacity"
  }
}

variable "documentdb_instance_class" {
  description = "DocumentDB instance class for MongoDB-compatible database with storage optimization"
  type        = string
  default     = "db.r5.large"
  validation {
    condition     = contains(["db.r5.large", "db.r5.xlarge"], var.documentdb_instance_class)
    error_message = "DocumentDB instance class must support required document storage capacity"
  }
}

# Security and Compliance Variables
variable "backup_retention_days" {
  description = "Number of days to retain automated backups"
  type        = number
  default     = 30
  validation {
    condition     = var.backup_retention_days >= 30
    error_message = "Backup retention must be at least 30 days for compliance"
  }
}

variable "enable_encryption" {
  description = "Enable encryption at rest for all data stores"
  type        = bool
  default     = true
}

# Output variable definitions for use in other modules
output "project_variables" {
  value = {
    project_name = var.project_name
    environment  = var.environment
    aws_region   = var.aws_region
  }
  description = "Core project configuration variables for use in other modules"
}