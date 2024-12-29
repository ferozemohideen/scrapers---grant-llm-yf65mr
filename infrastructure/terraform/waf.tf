# AWS Provider version ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# Main WAF Web ACL for application protection
resource "aws_wafv2_web_acl" "main" {
  name        = "${var.project_name}-${var.environment}-waf"
  description = "WAF rules for ${var.project_name} ${var.environment} environment"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rate limiting rule - 1000 requests per minute per IP
  rule {
    name     = "rate-limit"
    priority = 1

    override_action {
      none {}
    }

    statement {
      rate_based_statement {
        limit              = 1000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "WAFRateLimit"
      sampled_requests_enabled  = true
    }
  }

  # SQL Injection protection rule
  rule {
    name     = "sql-injection-protection"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "WAFSQLInjection"
      sampled_requests_enabled  = true
    }
  }

  # Common attack protection rule
  rule {
    name     = "common-attack-protection"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "WAFCommonAttacks"
      sampled_requests_enabled  = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "${var.project_name}-${var.environment}-waf-main"
    sampled_requests_enabled  = true
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-waf"
    Environment = var.environment
    Project     = var.project_name
  }
}

# WAF Web ACL Association with Application Load Balancer
resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = aws_wafv2_web_acl.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# CloudWatch Log Group for WAF Logs
resource "aws_cloudwatch_log_group" "waf_logs" {
  name              = "/aws/waf/${var.project_name}-${var.environment}"
  retention_in_days = 90

  tags = {
    Name        = "${var.project_name}-${var.environment}-waf-logs"
    Environment = var.environment
    Project     = var.project_name
  }
}

# WAF Logging Configuration
resource "aws_wafv2_web_acl_logging_configuration" "main" {
  log_destination_configs = [aws_cloudwatch_log_group.waf_logs.arn]
  resource_arn           = aws_wafv2_web_acl.main.arn

  redacted_fields {
    single_header {
      name = "authorization"
    }
    single_header {
      name = "x-api-key"
    }
  }

  logging_filter {
    default_behavior = "DROP"

    filter {
      behavior = "KEEP"
      requirement = "MEETS_ANY"
      condition {
        action_condition {
          action = "BLOCK"
        }
      }
    }
  }
}

# Output the WAF Web ACL ARN for use in other configurations
output "web_acl_arn" {
  description = "ARN of the WAF Web ACL"
  value       = aws_wafv2_web_acl.main.arn
}