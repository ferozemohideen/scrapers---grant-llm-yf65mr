# Provider version: hashicorp/aws ~> 4.0
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

# EFS File System for Persistent Monitoring Data
resource "aws_efs_file_system" "monitoring" {
  creation_token = "${var.project_name}-${var.environment}-monitoring-efs"
  encrypted      = true

  lifecycle_policy {
    transition_to_ia = "AFTER_30_DAYS"
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-monitoring-efs"
    Environment = var.environment
  }
}

# Security Group for Monitoring Services
resource "aws_security_group" "monitoring" {
  name        = "${var.project_name}-${var.environment}-monitoring-sg"
  description = "Security group for monitoring services"
  vpc_id      = aws_vpc.main.id

  # Prometheus
  ingress {
    from_port   = 9090
    to_port     = 9090
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "Prometheus metrics collection"
  }

  # Grafana
  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "Grafana UI access"
  }

  # Elasticsearch
  ingress {
    from_port   = 9200
    to_port     = 9200
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "Elasticsearch API"
  }

  # Jaeger
  ingress {
    from_port   = 16686
    to_port     = 16686
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
    description = "Jaeger UI"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-monitoring-sg"
    Environment = var.environment
  }
}

# ECS Task Definition for Prometheus
resource "aws_ecs_task_definition" "prometheus" {
  family                   = "${var.project_name}-${var.environment}-prometheus"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = 1024
  memory                  = 2048
  execution_role_arn      = aws_iam_role.ecs_task_execution_role.arn
  task_role_arn           = aws_iam_role.prometheus_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "prometheus"
      image = "prom/prometheus:v2.40.0"
      portMappings = [
        {
          containerPort = 9090
          hostPort      = 9090
          protocol      = "tcp"
        }
      ]
      mountPoints = [
        {
          sourceVolume  = "prometheus_data"
          containerPath = "/prometheus"
          readOnly      = false
        }
      ]
      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/${var.project_name}-${var.environment}/prometheus"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "prometheus"
        }
      }
    }
  ])

  volume {
    name = "prometheus_data"
    efs_volume_configuration {
      file_system_id = aws_efs_file_system.monitoring.id
      root_directory = "/prometheus"
    }
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-prometheus"
    Environment = var.environment
  }
}

# ECS Service for Prometheus
resource "aws_ecs_service" "prometheus" {
  name            = "${var.project_name}-${var.environment}-prometheus"
  cluster         = aws_ecs_cluster.monitoring.id
  task_definition = aws_ecs_task_definition.prometheus.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.monitoring.id]
    assign_public_ip = false
  }

  service_registries {
    registry_arn = aws_service_discovery_service.prometheus.arn
  }
}

# Auto Scaling for Monitoring Services
resource "aws_appautoscaling_target" "monitoring_services" {
  max_capacity       = 4
  min_capacity       = 1
  resource_id        = "service/${aws_ecs_cluster.monitoring.name}/${aws_ecs_service.prometheus.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "monitoring_services" {
  name               = "${var.project_name}-${var.environment}-monitoring-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.monitoring_services.resource_id
  scalable_dimension = aws_appautoscaling_target.monitoring_services.scalable_dimension
  service_namespace  = aws_appautoscaling_target.monitoring_services.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = 75.0
  }
}

# CloudWatch Log Groups for Monitoring Services
resource "aws_cloudwatch_log_group" "monitoring" {
  name              = "/ecs/${var.project_name}-${var.environment}/monitoring"
  retention_in_days = 30

  tags = {
    Environment = var.environment
    Service     = "monitoring"
  }
}

# Service Discovery for Monitoring Services
resource "aws_service_discovery_private_dns_namespace" "monitoring" {
  name        = "${var.project_name}-${var.environment}-monitoring.local"
  description = "Service discovery namespace for monitoring services"
  vpc         = aws_vpc.main.id
}

resource "aws_service_discovery_service" "prometheus" {
  name = "prometheus"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.monitoring.id

    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

# Outputs for Monitoring Endpoints
output "monitoring_endpoints" {
  value = {
    prometheus_endpoint    = "http://${aws_service_discovery_service.prometheus.name}.${aws_service_discovery_private_dns_namespace.monitoring.name}:9090"
    grafana_endpoint      = "http://${aws_service_discovery_service.prometheus.name}.${aws_service_discovery_private_dns_namespace.monitoring.name}:3000"
    elasticsearch_endpoint = "http://${aws_service_discovery_service.prometheus.name}.${aws_service_discovery_private_dns_namespace.monitoring.name}:9200"
    jaeger_endpoint       = "http://${aws_service_discovery_service.prometheus.name}.${aws_service_discovery_private_dns_namespace.monitoring.name}:16686"
  }
  description = "Endpoints for accessing monitoring services"
}