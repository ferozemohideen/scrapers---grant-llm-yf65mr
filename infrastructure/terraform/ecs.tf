# AWS Provider configuration with exact version pinning
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "4.67.0"
    }
  }
}

# ECS Cluster with container insights and service mesh enabled
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  setting {
    name  = "serviceMesh"
    value = "enabled"
  }

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    capacity_provider = "FARGATE"
    weight           = 1
    base            = 1
  }

  tags = {
    Name          = "${var.project_name}-${var.environment}-ecs"
    Project       = var.project_name
    Environment   = var.environment
    ManagedBy     = "terraform"
    CostCenter    = "tech-transfer"
    SecurityScan  = "required"
  }
}

# ECS Task Definition for API Service
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-${var.environment}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode            = "awsvpc"
  cpu                     = 1024
  memory                  = 2048
  execution_role_arn      = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name         = "api"
      image        = "${aws_ecr_repository.api.repository_url}:latest"
      essential    = true
      portMappings = [
        {
          containerPort = 8000
          hostPort     = 8000
          protocol     = "tcp"
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
          awslogs-group         = "/ecs/${var.project_name}-${var.environment}/api"
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "api"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  proxy_configuration {
    type           = "APPMESH"
    container_name = "envoy"
    properties = {
      AppPorts         = "8000"
      ProxyIngressPort = "15000"
      ProxyEgressPort  = "15001"
    }
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-task"
    Project     = var.project_name
    Environment = var.environment
  }
}

# ECS Service for API
resource "aws_ecs_service" "api" {
  name                               = "${var.project_name}-${var.environment}-api"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.api.arn
  desired_count                     = var.min_capacity
  launch_type                       = "FARGATE"
  platform_version                  = "LATEST"
  health_check_grace_period_seconds = 60

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_tasks.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8000
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  service_registries {
    registry_arn = aws_service_discovery_service.api.arn
  }

  tags = {
    Name        = "${var.project_name}-${var.environment}-api-service"
    Project     = var.project_name
    Environment = var.environment
  }
}

# Auto Scaling for API Service
resource "aws_appautoscaling_target" "api" {
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu" {
  name               = "${var.project_name}-${var.environment}-api-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api.resource_id
  scalable_dimension = aws_appautoscaling_target.api.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}

# CloudWatch Alarms for ECS Service
resource "aws_cloudwatch_metric_alarm" "service_cpu_high" {
  alarm_name          = "${var.project_name}-${var.environment}-api-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "CPUUtilization"
  namespace          = "AWS/ECS"
  period             = "60"
  statistic          = "Average"
  threshold          = "85"
  alarm_description  = "CPU utilization is too high"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
    ServiceName = aws_ecs_service.api.name
  }
}

# Service Discovery for ECS Services
resource "aws_service_discovery_private_dns_namespace" "main" {
  name        = "${var.project_name}-${var.environment}.local"
  description = "Service discovery namespace for ECS services"
  vpc         = var.vpc_id
}

resource "aws_service_discovery_service" "api" {
  name = "api"

  dns_config {
    namespace_id = aws_service_discovery_private_dns_namespace.main.id
    
    dns_records {
      ttl  = 10
      type = "A"
    }
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}

# Outputs
output "ecs_cluster_id" {
  value       = aws_ecs_cluster.main.id
  description = "The ID of the ECS cluster"
}

output "ecs_task_execution_role_arn" {
  value       = aws_iam_role.ecs_execution.arn
  description = "The ARN of the ECS task execution role"
}