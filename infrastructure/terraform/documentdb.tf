# AWS Provider configuration inherited from root module
# Provider version: ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# KMS key for DocumentDB encryption
resource "aws_kms_key" "docdb" {
  description             = "KMS key for DocumentDB encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true
  
  tags = {
    Name        = "${var.project_name}-${var.environment}-docdb-kms"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# DocumentDB cluster parameter group
resource "aws_docdb_cluster_parameter_group" "main" {
  family      = "docdb4.0"
  name        = "${var.project_name}-${var.environment}-params"
  description = "DocumentDB cluster parameter group for ${var.project_name}"

  parameter {
    name  = "tls"
    value = "enabled"
  }

  parameter {
    name  = "audit_logs"
    value = "enabled"
  }

  parameter {
    name  = "ttl_monitor"
    value = "enabled"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-docdb-params"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Generate secure random password for DocumentDB
resource "random_password" "docdb_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# DocumentDB subnet group
resource "aws_docdb_subnet_group" "main" {
  name        = "${var.project_name}-${var.environment}-docdb-subnet"
  subnet_ids  = var.private_subnet_ids
  description = "DocumentDB subnet group for ${var.project_name}"

  tags = {
    Name        = "${var.project_name}-${var.environment}-docdb-subnet"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# Security group for DocumentDB
resource "aws_security_group" "docdb" {
  name        = "${var.project_name}-${var.environment}-docdb-sg"
  description = "Security group for DocumentDB cluster"
  vpc_id      = var.vpc_id

  ingress {
    description = "DocumentDB port"
    from_port   = 27017
    to_port     = 27017
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-docdb-sg"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# DocumentDB cluster
resource "aws_docdb_cluster" "main" {
  cluster_identifier              = "${var.project_name}-${var.environment}-docdb"
  engine                         = "docdb"
  engine_version                 = "4.0.0"
  master_username                = "admin"
  master_password                = random_password.docdb_password.result
  backup_retention_period        = 7
  preferred_backup_window        = "03:00-05:00"
  preferred_maintenance_window   = "Mon:01:00-Mon:02:00"
  skip_final_snapshot           = false
  final_snapshot_identifier     = "${var.project_name}-${var.environment}-docdb-final"
  storage_encrypted             = true
  kms_key_id                    = aws_kms_key.docdb.arn
  vpc_security_group_ids        = [aws_security_group.docdb.id]
  db_subnet_group_name          = aws_docdb_subnet_group.main.name
  db_cluster_parameter_group_name = aws_docdb_cluster_parameter_group.main.name
  deletion_protection           = true
  apply_immediately             = false

  tags = {
    Name        = "${var.project_name}-${var.environment}-docdb"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
  }
}

# DocumentDB cluster instances
resource "aws_docdb_cluster_instance" "main" {
  count              = length(var.availability_zones)
  identifier         = "${var.project_name}-${var.environment}-docdb-${count.index + 1}"
  cluster_identifier = aws_docdb_cluster.main.id
  instance_class     = var.documentdb_instance_class
  
  auto_minor_version_upgrade = true
  preferred_maintenance_window = "Mon:01:00-Mon:02:00"

  tags = {
    Name        = "${var.project_name}-${var.environment}-docdb-${count.index + 1}"
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    AZ          = var.availability_zones[count.index]
  }
}

# Outputs
output "docdb_cluster_endpoint" {
  description = "The cluster endpoint for DocumentDB"
  value       = aws_docdb_cluster.main.endpoint
}

output "docdb_cluster_instances" {
  description = "List of DocumentDB instance identifiers"
  value       = aws_docdb_cluster_instance.main[*].identifier
}

output "docdb_cluster_resource_id" {
  description = "The DocumentDB cluster resource ID"
  value       = aws_docdb_cluster.main.cluster_resource_id
}

output "docdb_security_group_id" {
  description = "The security group ID for DocumentDB"
  value       = aws_security_group.docdb.id
}