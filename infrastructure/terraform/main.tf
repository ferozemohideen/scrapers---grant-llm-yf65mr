# Provider and Terraform Configuration
# AWS Provider version ~> 4.0
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }

  # Remote state configuration with encryption and locking
  backend "s3" {
    bucket         = "${var.project_name}-${var.environment}-tfstate"
    key            = "terraform.tfstate"
    region         = "${var.aws_region}"
    encrypt        = true
    dynamodb_table = "${var.project_name}-${var.environment}-tflock"
    kms_key_id     = "${aws_kms_key.terraform_state.arn}"
  }
}

# AWS Provider configuration
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = local.common_tags
  }
}

# Local variables for common resource tagging
locals {
  common_tags = {
    Project      = var.project_name
    Environment  = var.environment
    ManagedBy    = "terraform"
    LastUpdated  = timestamp()
    Owner        = "technology-transfer-team"
  }
}

# KMS key for application data encryption
resource "aws_kms_key" "encryption_key" {
  description             = "KMS key for encrypting application data and secrets"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region           = true
  tags                   = local.common_tags

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow ECS Service Usage"
        Effect = "Allow"
        Principal = {
          Service = "ecs.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
        Resource = "*"
      }
    ]
  })
}

# KMS key for Terraform state encryption
resource "aws_kms_key" "terraform_state" {
  description             = "KMS key for encrypting Terraform state"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  tags                   = local.common_tags

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      }
    ]
  })
}

# DynamoDB table for Terraform state locking
resource "aws_dynamodb_table" "terraform_lock" {
  name           = "${var.project_name}-${var.environment}-tflock"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"
  
  attribute {
    name = "LockID"
    type = "S"
  }

  point_in_time_recovery {
    enabled = true
  }

  server_side_encryption {
    enabled     = true
    kms_key_arn = aws_kms_key.terraform_state.arn
  }

  tags = local.common_tags
}

# Data source for current AWS account ID
data "aws_caller_identity" "current" {}

# VPC Network outputs
output "vpc_outputs" {
  value = {
    vpc_id              = module.vpc.vpc_id
    private_subnet_ids  = module.vpc.private_subnet_ids
    public_subnet_ids   = module.vpc.public_subnet_ids
    availability_zones  = var.availability_zones
  }
  description = "VPC resource identifiers and network configuration"
}

# Database endpoint outputs
output "database_endpoints" {
  value = {
    rds_endpoint               = module.rds.endpoint
    redis_endpoint            = module.elasticache.endpoint
    documentdb_endpoint       = module.documentdb.endpoint
    database_security_group_id = module.rds.security_group_id
  }
  description = "Database connection endpoints and security configuration"
  sensitive   = true
}

# Module configurations
module "vpc" {
  source = "./vpc"
  # VPC module configuration will be defined in vpc.tf
}

module "ecs" {
  source = "./ecs"
  # ECS module configuration will be defined in ecs.tf
  depends_on = [module.vpc]
}

module "rds" {
  source = "./rds"
  # RDS module configuration will be defined in rds.tf
  depends_on = [module.vpc]
}

module "elasticache" {
  source = "./elasticache"
  # ElastiCache module configuration will be defined in elasticache.tf
  depends_on = [module.vpc]
}

module "documentdb" {
  source = "./documentdb"
  # DocumentDB module configuration will be defined in documentdb.tf
  depends_on = [module.vpc]
}

module "monitoring" {
  source = "./monitoring"
  # Monitoring module configuration will be defined in monitoring.tf
  depends_on = [
    module.ecs,
    module.rds,
    module.elasticache,
    module.documentdb
  ]
}