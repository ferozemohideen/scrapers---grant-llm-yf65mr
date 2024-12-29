# AWS Provider configuration
# Provider version: ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Primary S3 bucket for technology transfer assets
resource "aws_s3_bucket" "tech_transfer_assets" {
  bucket        = "${var.project_name}-${var.environment}-assets"
  force_destroy = false

  tags = {
    Name         = "${var.project_name}-${var.environment}-assets"
    Environment  = var.environment
    Purpose      = "Technology Transfer Documents Storage"
    CostCenter   = "TechTransfer"
    ManagedBy    = "Terraform"
    LastModified = timestamp()
  }
}

# Enable versioning for document history and recovery
resource "aws_s3_bucket_versioning" "tech_transfer_assets_versioning" {
  bucket = aws_s3_bucket.tech_transfer_assets.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Configure server-side encryption using KMS
resource "aws_s3_bucket_server_side_encryption_configuration" "tech_transfer_assets_encryption" {
  bucket = aws_s3_bucket.tech_transfer_assets.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.s3_key.arn
    }
    bucket_key_enabled = true
  }
}

# Configure lifecycle rules for cost optimization
resource "aws_s3_bucket_lifecycle_configuration" "tech_transfer_assets_lifecycle" {
  bucket = aws_s3_bucket.tech_transfer_assets.id

  rule {
    id     = "intelligent_tiering"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "INTELLIGENT_TIERING"
    }
  }

  rule {
    id     = "archive_old_documents"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }
  }

  rule {
    id     = "cleanup_old_versions"
    status = "Enabled"

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }

  rule {
    id     = "abort_multipart_uploads"
    status = "Enabled"

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Configure cross-region replication for disaster recovery
resource "aws_s3_bucket_replication_configuration" "tech_transfer_assets_replication" {
  bucket = aws_s3_bucket.tech_transfer_assets.id
  role   = aws_iam_role.replication.arn

  rule {
    id     = "disaster_recovery"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.tech_transfer_assets_replica.arn
      storage_class = "STANDARD_IA"
    }
  }
}

# Enable access logging for audit compliance
resource "aws_s3_bucket_logging" "tech_transfer_assets_logging" {
  bucket        = aws_s3_bucket.tech_transfer_assets.id
  target_bucket = aws_s3_bucket.logs.id
  target_prefix = "s3-access-logs/"
}

# Configure metrics for monitoring
resource "aws_s3_bucket_metric" "tech_transfer_assets_metrics" {
  bucket = aws_s3_bucket.tech_transfer_assets.id
  name   = "EntireBucket"
}

# Enable transfer acceleration for improved performance
resource "aws_s3_bucket_accelerate_configuration" "tech_transfer_assets_acceleration" {
  bucket = aws_s3_bucket.tech_transfer_assets.id
  status = "Enabled"
}

# Configure event notifications for document processing
resource "aws_s3_bucket_notification" "tech_transfer_assets_notification" {
  bucket = aws_s3_bucket.tech_transfer_assets.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.processor.arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "uploads/"
  }
}

# Public access block for enhanced security
resource "aws_s3_bucket_public_access_block" "tech_transfer_assets_public_access" {
  bucket = aws_s3_bucket.tech_transfer_assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration for web access
resource "aws_s3_bucket_cors_configuration" "tech_transfer_assets_cors" {
  bucket = aws_s3_bucket.tech_transfer_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://*.${var.project_name}.com"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Bucket policy for CloudFront access
resource "aws_s3_bucket_policy" "tech_transfer_assets_policy" {
  bucket = aws_s3_bucket.tech_transfer_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.oai.iam_arn
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.tech_transfer_assets.arn}/*"
      }
    ]
  })
}

# Outputs for use in other modules
output "tech_transfer_assets_bucket" {
  value = {
    id                          = aws_s3_bucket.tech_transfer_assets.id
    arn                         = aws_s3_bucket.tech_transfer_assets.arn
    bucket_regional_domain_name = aws_s3_bucket.tech_transfer_assets.bucket_regional_domain_name
    bucket_acceleration_status  = aws_s3_bucket_accelerate_configuration.tech_transfer_assets_acceleration.status
  }
  description = "S3 bucket configuration for technology transfer assets"
}