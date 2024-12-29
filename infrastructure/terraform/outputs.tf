# VPC and Networking Outputs
output "vpc_outputs" {
  description = "Enhanced VPC networking information including availability zones and routing configuration"
  value = {
    vpc_id              = aws_vpc.main.id
    private_subnet_ids  = aws_subnet.private[*].id
    public_subnet_ids   = aws_subnet.public[*].id
    database_subnet_ids = aws_subnet.database[*].id
    availability_zones  = var.availability_zones
    nat_gateway_ips    = aws_nat_gateway.main[*].public_ip
    network_acls       = aws_network_acl.main.id
    flow_logs_enabled  = true
    flow_logs_group    = aws_cloudwatch_log_group.vpc_flow_log.name
  }
}

# Database Connection Endpoints
output "database_endpoints" {
  description = "Secure database connection endpoints with enhanced metadata and monitoring information"
  value = {
    rds_endpoint       = aws_db_instance.main.endpoint
    redis_endpoint     = aws_elasticache_cluster.main.cache_nodes[0].address
    documentdb_endpoint = aws_docdb_cluster.main.endpoint
    
    connection_strings = {
      rds = "postgresql://${aws_db_instance.main.username}@${aws_db_instance.main.endpoint}:${aws_db_instance.main.port}/${aws_db_instance.main.name}"
      redis = "redis://${aws_elasticache_cluster.main.cache_nodes[0].address}:${aws_elasticache_cluster.main.port}"
      documentdb = "mongodb://${aws_docdb_cluster.main.master_username}@${aws_docdb_cluster.main.endpoint}:${aws_docdb_cluster.main.port}"
    }
    
    backup_status = {
      rds_last_backup = aws_db_instance.main.latest_restorable_time
      rds_backup_window = aws_db_instance.main.backup_window
      documentdb_backup_window = aws_docdb_cluster.main.preferred_backup_window
      backup_retention_period = var.backup_retention_days
    }
    
    encryption_status = {
      rds_encrypted = aws_db_instance.main.storage_encrypted
      redis_encryption_at_rest = aws_elasticache_cluster.main.at_rest_encryption_enabled
      documentdb_encrypted = aws_docdb_cluster.main.storage_encrypted
    }
  }
  sensitive = true
}

# ECS Cluster and Service Information
output "ecs_outputs" {
  description = "Comprehensive ECS cluster information with capacity metrics and scaling configurations"
  value = {
    cluster_name = aws_ecs_cluster.main.name
    cluster_arn  = aws_ecs_cluster.main.arn
    
    services = {
      names = aws_ecs_service.services[*].name
      arns  = aws_ecs_service.services[*].id
    }
    
    capacity_metrics = {
      desired_count = aws_ecs_service.services[*].desired_count
      running_count = aws_ecs_service.services[*].running_count
      pending_count = aws_ecs_service.services[*].pending_count
      minimum_capacity = var.min_capacity
      maximum_capacity = var.max_capacity
    }
    
    scaling_policies = {
      policy_arns = aws_appautoscaling_policy.ecs_policy[*].arn
      target_tracking = aws_appautoscaling_policy.ecs_policy[*].name
    }
    
    task_definition = {
      family = aws_ecs_task_definition.main.family
      revision = aws_ecs_task_definition.main.revision
    }
  }
}

# Monitoring and Observability Endpoints
output "monitoring_endpoints" {
  description = "Comprehensive monitoring and observability endpoints with authentication information"
  value = {
    prometheus = {
      endpoint = aws_instance.prometheus.public_dns
      health_check = "${aws_instance.prometheus.public_dns}/-/healthy"
      metrics_path = "${aws_instance.prometheus.public_dns}/metrics"
      alert_manager = "${aws_instance.prometheus.public_dns}/alerts"
    }
    
    grafana = {
      endpoint = aws_instance.grafana.public_dns
      health_check = "${aws_instance.grafana.public_dns}/api/health"
      oauth_endpoint = "${aws_instance.grafana.public_dns}/oauth"
      dashboards_path = "${aws_instance.grafana.public_dns}/dashboards"
    }
    
    elasticsearch = {
      endpoint = aws_elasticsearch_domain.main.endpoint
      kibana = "${aws_elasticsearch_domain.main.endpoint}/_plugin/kibana"
      health_check = "${aws_elasticsearch_domain.main.endpoint}/_cluster/health"
      metrics_endpoint = "${aws_elasticsearch_domain.main.endpoint}/_nodes/stats"
    }
    
    cloudwatch = {
      log_groups = {
        vpc_flow_logs = aws_cloudwatch_log_group.vpc_flow_log.name
        application_logs = aws_cloudwatch_log_group.application.name
        ecs_logs = aws_cloudwatch_log_group.ecs.name
      }
      metrics_namespace = "${var.project_name}-${var.environment}"
    }
  }
}

# Security and Compliance Information
output "security_outputs" {
  description = "Security and compliance-related configuration information"
  value = {
    vpc_flow_logs_enabled = true
    encryption_at_rest_enabled = var.enable_encryption
    backup_retention_period = var.backup_retention_days
    
    compliance_status = {
      multi_az_enabled = length(var.availability_zones) >= 2
      backup_compliant = var.backup_retention_days >= 30
      encryption_compliant = var.enable_encryption
    }
  }
}