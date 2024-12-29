# AWS Provider version ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# CloudFront Origin Access Identity for secure S3 access
resource "aws_cloudfront_origin_access_identity" "tech_transfer_oai" {
  comment = "${var.project_name}-${var.environment}-oai"
}

# Security Headers Policy for enhanced content security
resource "aws_cloudfront_response_headers_policy" "security_headers" {
  name = "${var.project_name}-${var.environment}-security-headers"

  security_headers_config {
    # Enable HSTS for secure transport
    strict_transport_security {
      override        = true
      max_age_sec    = 31536000 # 1 year
      include_subdomains = true
      preload        = true
    }

    # Configure Content Security Policy
    content_security_policy {
      override                = true
      content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
    }

    # Prevent clickjacking attacks
    frame_options {
      override     = true
      frame_option = "DENY"
    }
  }
}

# Main CloudFront Distribution
resource "aws_cloudfront_distribution" "tech_transfer_distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name}-${var.environment} distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_All" # Global distribution for optimal performance

  # S3 Origin Configuration
  origin {
    domain_name = aws_s3_bucket.tech_transfer_assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.tech_transfer_assets.id}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.tech_transfer_oai.cloudfront_access_identity_path
    }
  }

  # Default Cache Behavior
  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.tech_transfer_assets.id}"

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy     = "redirect-to-https"
    min_ttl                   = 0
    default_ttl               = 3600  # 1 hour
    max_ttl                   = 86400 # 24 hours
    compress                  = true
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers.id
  }

  # Cache Behavior for JavaScript Files
  ordered_cache_behavior {
    path_pattern     = "*.js"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.tech_transfer_assets.id}"

    forwarded_values {
      query_string = false
      headers      = ["Origin"]
      cookies {
        forward = "none"
      }
    }

    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    min_ttl               = 0
    default_ttl           = 86400    # 24 hours
    max_ttl               = 31536000 # 1 year
  }

  # Cache Behavior for CSS Files
  ordered_cache_behavior {
    path_pattern     = "*.css"
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${aws_s3_bucket.tech_transfer_assets.id}"

    forwarded_values {
      query_string = false
      headers      = ["Origin"]
      cookies {
        forward = "none"
      }
    }

    compress               = true
    viewer_protocol_policy = "redirect-to-https"
    min_ttl               = 0
    default_ttl           = 86400    # 24 hours
    max_ttl               = 31536000 # 1 year
  }

  # Custom Error Responses for SPA
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  # Geo Restrictions - None as per requirements
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL/TLS Configuration
  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  # WAF Integration
  web_acl_id = aws_wafv2_web_acl.cloudfront_waf.arn

  # Access Logging Configuration
  logging_config {
    bucket          = aws_s3_bucket.logs.bucket_domain_name
    prefix          = "cloudfront/"
    include_cookies = false
  }

  # Resource Tags
  tags = {
    Name        = "${var.project_name}-${var.environment}-distribution"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Output values for use in other modules
output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.tech_transfer_distribution.id
  description = "ID of the CloudFront distribution"
}

output "cloudfront_domain_name" {
  value       = aws_cloudfront_distribution.tech_transfer_distribution.domain_name
  description = "Domain name of the CloudFront distribution"
}

output "cloudfront_arn" {
  value       = aws_cloudfront_distribution.tech_transfer_distribution.arn
  description = "ARN of the CloudFront distribution"
}

output "cloudfront_hosted_zone_id" {
  value       = aws_cloudfront_distribution.tech_transfer_distribution.hosted_zone_id
  description = "Route 53 hosted zone ID for the CloudFront distribution"
}