# AWS Route 53 Configuration for Technology Transfer Data Aggregation System
# Provider version: hashicorp/aws ~> 4.0

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Domain name variable for the technology transfer system
variable "domain_name" {
  description = "Base domain name for the technology transfer system"
  type        = string
  default     = "tech-transfer.tech"
}

# Primary Route 53 hosted zone for the application
resource "aws_route53_zone" "tech_transfer_zone" {
  name    = "${var.project_name}-${var.environment}.tech"
  comment = "Managed by Terraform"

  tags = {
    Name        = "${var.project_name}-${var.environment}-zone"
    Environment = var.environment
  }
}

# Web application DNS record with CloudFront distribution alias
resource "aws_route53_record" "web_app" {
  zone_id = aws_route53_zone.tech_transfer_zone.zone_id
  name    = "app.${var.project_name}-${var.environment}.tech"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.tech_transfer_distribution.domain_name
    zone_id               = aws_cloudfront_distribution.tech_transfer_distribution.hosted_zone_id
    evaluate_target_health = true
  }
}

# API endpoint DNS record with ALB alias
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.tech_transfer_zone.zone_id
  name    = "api.${var.project_name}-${var.environment}.tech"
  type    = "A"

  alias {
    name                   = aws_lb.api_alb.dns_name
    zone_id               = aws_lb.api_alb.zone_id
    evaluate_target_health = true
  }
}

# Health check for web application endpoint
resource "aws_route53_health_check" "web_app_health" {
  fqdn              = "app.${var.project_name}-${var.environment}.tech"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = "3"
  request_interval  = "30"

  tags = {
    Name        = "${var.project_name}-${var.environment}-web-health"
    Environment = var.environment
  }
}

# Health check for API endpoint
resource "aws_route53_health_check" "api_health" {
  fqdn              = "api.${var.project_name}-${var.environment}.tech"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/api/health"
  failure_threshold = "3"
  request_interval  = "30"

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-health"
    Environment = var.environment
  }
}

# Output the Route 53 zone details for DNS configuration
output "route53_zone" {
  value = {
    zone_id       = aws_route53_zone.tech_transfer_zone.zone_id
    name_servers  = aws_route53_zone.tech_transfer_zone.name_servers
  }
  description = "Route 53 zone details for DNS configuration"
}

# Output the domain names for application and API endpoints
output "domain_names" {
  value = {
    web_app_domain = aws_route53_record.web_app.name
    api_domain     = aws_route53_record.api.name
  }
  description = "Domain names for application and API endpoints"
}