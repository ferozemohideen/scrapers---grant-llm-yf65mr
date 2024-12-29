# AWS ElastiCache Redis Configuration
# Provider version: ~> 4.0

# Redis subnet group for cluster placement in private subnets
resource "aws_elasticache_subnet_group" "main" {
  name        = "${var.project_name}-${var.environment}-redis-subnet"
  subnet_ids  = var.private_subnet_ids
  description = "Subnet group for Redis cluster deployment in private subnets"

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-subnet"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Redis parameter group with optimized settings for search and session caching
resource "aws_elasticache_parameter_group" "main" {
  family      = "redis6.x"
  name        = "${var.project_name}-${var.environment}-redis-params"
  description = "Redis parameter group with optimized settings for search and session caching"

  # Performance optimization parameters
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"  # Optimized for cache eviction
  }

  parameter {
    name  = "activedefrag"
    value = "yes"  # Enable active defragmentation
  }

  parameter {
    name  = "maxmemory-samples"
    value = "10"  # Increased sampling for better LRU accuracy
  }

  parameter {
    name  = "tcp-keepalive"
    value = "300"  # Connection management optimization
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-params"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Security group for Redis cluster with restricted access
resource "aws_security_group" "redis" {
  name        = "${var.project_name}-${var.environment}-redis-sg"
  vpc_id      = var.vpc_id
  description = "Security group for Redis cluster with restricted access"

  ingress {
    description = "Redis port access from VPC"
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-redis-sg"
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Redis replication group with high availability configuration
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${var.project_name}-${var.environment}-redis"
  description         = "Redis cluster for high-performance search and session caching"
  node_type           = var.redis_node_type
  port                = 6379

  # Cluster configuration
  parameter_group_name    = aws_elasticache_parameter_group.main.name
  subnet_group_name      = aws_elasticache_subnet_group.main.name
  security_group_ids     = [aws_security_group.redis.id]
  automatic_failover_enabled = true
  multi_az_enabled       = true
  num_cache_clusters     = 2  # Primary + Replica for HA

  # Engine configuration
  engine               = "redis"
  engine_version      = "6.x"
  
  # Security configuration
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true

  # Maintenance and backup configuration
  maintenance_window        = "sun:05:00-sun:09:00"
  snapshot_window          = "03:00-05:00"
  snapshot_retention_limit = 7
  auto_minor_version_upgrade = true
  apply_immediately        = false

  tags = {
    Name             = "${var.project_name}-${var.environment}-redis"
    Project          = var.project_name
    Environment      = var.environment
    ManagedBy        = "terraform"
    Service          = "cache"
    HighAvailability = "enabled"
    Encryption       = "enabled"
  }
}

# Output the Redis endpoint for application configuration
output "redis_endpoint" {
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
  description = "Redis cluster endpoint for application configuration"
}

# Output the Redis security group ID for other services
output "redis_security_group_id" {
  value       = aws_security_group.redis.id
  description = "Redis security group ID for other services to allow access"
}