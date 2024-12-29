# AWS Provider version ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Variables for KMS configuration
variable "deletion_window" {
  description = "Number of days before permanent key deletion"
  type        = number
  default     = 30
}

variable "key_rotation_enabled" {
  description = "Enable automatic key rotation"
  type        = bool
  default     = true
}

variable "secondary_region" {
  description = "AWS region for KMS key replication"
  type        = string
  default     = "us-west-2"
}

# Local variables for common tags
locals {
  common_tags = {
    Project             = var.project_name
    Environment         = var.environment
    ManagedBy          = "terraform"
    SecurityLevel      = "high"
    ComplianceStandard = "FIPS140-2"
    EncryptionType     = "AES256"
  }
}

# Primary KMS key for application data encryption
resource "aws_kms_key" "primary_key" {
  description              = "Primary KMS key for encrypting application data with FIPS 140-2 compliance"
  deletion_window_in_days  = var.deletion_window
  enable_key_rotation     = var.key_rotation_enabled
  multi_region            = true
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage               = "ENCRYPT_DECRYPT"
  policy                  = data.aws_iam_policy_document.kms_key_policy.json
  tags                    = local.common_tags
}

# Alias for primary KMS key
resource "aws_kms_alias" "primary_key_alias" {
  name          = "alias/${var.project_name}-${var.environment}-primary"
  target_key_id = aws_kms_key.primary_key.key_id
}

# Database-specific KMS key for RDS and DocumentDB
resource "aws_kms_key" "database_key" {
  description              = "KMS key for encrypting database data (RDS, DocumentDB) with FIPS 140-2 compliance"
  deletion_window_in_days  = var.deletion_window
  enable_key_rotation     = var.key_rotation_enabled
  customer_master_key_spec = "SYMMETRIC_DEFAULT"
  key_usage               = "ENCRYPT_DECRYPT"
  policy                  = data.aws_iam_policy_document.database_key_policy.json
  tags                    = local.common_tags
}

# Alias for database KMS key
resource "aws_kms_alias" "database_key_alias" {
  name          = "alias/${var.project_name}-${var.environment}-database"
  target_key_id = aws_kms_key.database_key.key_id
}

# Multi-region replica of primary key for disaster recovery
resource "aws_kms_replica_key" "primary_key_replica" {
  description             = "Multi-region replica of primary KMS key for disaster recovery"
  primary_key_arn        = aws_kms_key.primary_key.arn
  deletion_window_in_days = var.deletion_window
  provider               = aws.secondary_region
  tags                   = local.common_tags
}

# KMS key policy for primary key
data "aws_iam_policy_document" "kms_key_policy" {
  statement {
    sid    = "Enable IAM User Permissions"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "Allow Application Services"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = [
        "application-autoscaling.amazonaws.com",
        "ecs.amazonaws.com",
        "elasticache.amazonaws.com"
      ]
    }
    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKey*",
      "kms:CreateGrant",
      "kms:ListGrants",
      "kms:DescribeKey"
    ]
    resources = ["*"]
  }
}

# KMS key policy for database key
data "aws_iam_policy_document" "database_key_policy" {
  statement {
    sid    = "Enable IAM User Permissions"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
    actions   = ["kms:*"]
    resources = ["*"]
  }

  statement {
    sid    = "Allow Database Services"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = [
        "rds.amazonaws.com",
        "docdb.amazonaws.com"
      ]
    }
    actions = [
      "kms:Decrypt",
      "kms:GenerateDataKey*",
      "kms:CreateGrant",
      "kms:ListGrants",
      "kms:DescribeKey"
    ]
    resources = ["*"]
  }
}

# Get current AWS account ID
data "aws_caller_identity" "current" {}

# Outputs for use in other modules
output "kms_key_ids" {
  value = {
    primary_key_id         = aws_kms_key.primary_key.key_id
    primary_key_arn        = aws_kms_key.primary_key.arn
    database_key_id        = aws_kms_key.database_key.key_id
    database_key_arn       = aws_kms_key.database_key.arn
    primary_key_replica_arn = aws_kms_key.primary_key_replica.arn
  }
  description = "KMS key identifiers for use in other resources"
}