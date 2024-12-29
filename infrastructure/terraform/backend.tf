# AWS Provider version: ~> 4.0
# Purpose: Configures Terraform backend state storage using AWS S3 and DynamoDB
# Security: Implements encryption, versioning, and cross-region replication
# High Availability: Uses S3 versioning and DynamoDB point-in-time recovery

terraform {
  backend "s3" {
    # Primary state bucket configuration
    bucket = "${var.project_name}-${var.environment}-tfstate"
    key    = "terraform.tfstate"
    region = "${var.aws_region}"
    
    # Enable encryption and state locking
    encrypt        = true
    dynamodb_table = "${var.project_name}-${var.environment}-tflock"
    kms_key_id     = "alias/terraform-state"
    
    # Workspace and versioning configuration
    workspace_key_prefix = "${var.environment}"
  }
}

# Primary state bucket
resource "aws_s3_bucket" "terraform_state" {
  bucket = "${var.project_name}-${var.environment}-tfstate"

  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name               = "Terraform State"
    Project           = "${var.project_name}"
    Environment       = "${var.environment}"
    ManagedBy         = "terraform"
    SecurityLevel     = "Critical"
    DataClassification = "Infrastructure-Config"
  }
}

# Enable versioning for state bucket
resource "aws_s3_bucket_versioning" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Configure server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = "alias/terraform-state"
      sse_algorithm     = "aws:kms"
    }
  }
}

# Configure cross-region replication
resource "aws_s3_bucket_replication_configuration" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id
  role   = "arn:aws:iam::ACCOUNT_ID:role/terraform-state-replication"

  rule {
    id     = "tfstate_replication"
    status = "Enabled"

    destination {
      bucket        = "${var.project_name}-${var.environment}-tfstate-replica"
      storage_class = "STANDARD_IA"
    }
  }

  depends_on = [aws_s3_bucket_versioning.terraform_state]
}

# DynamoDB table for state locking
resource "aws_dynamodb_table" "terraform_lock" {
  name         = "${var.project_name}-${var.environment}-tflock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  # Enable encryption and point-in-time recovery
  server_side_encryption {
    enabled = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = {
    Name               = "Terraform Lock Table"
    Project           = "${var.project_name}"
    Environment       = "${var.environment}"
    ManagedBy         = "terraform"
    SecurityLevel     = "Critical"
    DataClassification = "Infrastructure-Config"
  }
}

# Block public access to state bucket
resource "aws_s3_bucket_public_access_block" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable bucket logging
resource "aws_s3_bucket_logging" "terraform_state" {
  bucket = aws_s3_bucket.terraform_state.id

  target_bucket = "${var.project_name}-${var.environment}-logs"
  target_prefix = "terraform-state-logs/"
}