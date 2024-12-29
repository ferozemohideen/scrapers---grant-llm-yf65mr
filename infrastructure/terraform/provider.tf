# Provider configuration for Technology Transfer Data Aggregation System
# Version: 1.0
# Last Updated: 2024-02-20

terraform {
  # Specify required provider versions for enterprise stability
  required_version = ">= 1.0"
  
  required_providers {
    # AWS provider for core infrastructure management
    # Version ~> 4.0 includes enterprise features and security controls
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
    
    # Random provider for generating unique resource identifiers
    # Version ~> 3.0 provides enhanced randomization features
    random = {
      source  = "hashicorp/random"
      version = "~> 3.0"
    }
  }
}

# Configure AWS Provider with enterprise-grade settings
provider "aws" {
  region = var.aws_region

  # Enterprise-wide resource tagging strategy for governance and cost allocation
  default_tags {
    tags = {
      Project             = "tech-transfer"
      Environment         = var.environment
      ManagedBy          = "terraform"
      System             = "data-aggregation"
      SecurityCompliance = "required"
      BackupRequired     = "true"
      CostCenter         = "research-innovation"
      LastUpdated        = formatdate("YYYY-MM-DD", timestamp())
      Owner              = "technology-transfer-team"
      DataClassification = "confidential"
      BusinessUnit       = "research-commercialization"
      MaintenanceWindow  = "sun:04:00-sun:06:00"
    }
  }

  # Enhanced security configurations
  assume_role {
    role_arn = "arn:aws:iam::${var.aws_account_id}:role/TerraformExecutionRole"
  }

  # Enable AWS provider features for enterprise use
  default_tags_enabled = true
  
  # Configure retry behavior for API calls
  retry_mode = "standard"
  max_retries = 3

  # Configure endpoints for enhanced security (VPC endpoints)
  endpoints {
    s3 = "https://s3.${var.aws_region}.amazonaws.com"
    dynamodb = "https://dynamodb.${var.aws_region}.amazonaws.com"
  }
}

# Configure the Random provider for resource naming
provider "random" {
  # Random provider doesn't require additional configuration
}

# Provider configuration for secondary region (disaster recovery)
provider "aws" {
  alias  = "dr"
  region = "us-east-1" # Secondary region for disaster recovery

  # Maintain consistent tagging strategy across regions
  default_tags {
    tags = {
      Project             = "tech-transfer"
      Environment         = var.environment
      ManagedBy          = "terraform"
      System             = "data-aggregation"
      SecurityCompliance = "required"
      BackupRequired     = "true"
      CostCenter         = "research-innovation"
      LastUpdated        = formatdate("YYYY-MM-DD", timestamp())
      Owner              = "technology-transfer-team"
      DataClassification = "confidential"
      BusinessUnit       = "research-commercialization"
      MaintenanceWindow  = "sun:04:00-sun:06:00"
      Region            = "dr"
    }
  }
}