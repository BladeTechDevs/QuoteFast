locals {
  name_prefix = "quotefast-${var.environment}"
  common_tags = merge(
    {
      Project     = "quotefast"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# ECS Task Execution Role — used by ECS agent to pull images and write logs
resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow ECS execution role to read secrets from Secrets Manager
resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "${local.name_prefix}-ecs-execution-secrets"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["secretsmanager:GetSecretValue"]
      Resource = [
        var.database_url_secret_arn,
        var.jwt_secret_arn,
        var.jwt_refresh_secret_arn,
      ]
    }]
  })
}

# ECS Task Role — permissions the application itself needs at runtime
resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "ecs_task_permissions" {
  name = "${local.name_prefix}-ecs-task-permissions"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SQSSendMessage"
        Effect = "Allow"
        Action = ["sqs:SendMessage", "sqs:GetQueueAttributes"]
        Resource = ["arn:aws:sqs:${var.aws_region}:*:quotefast-${var.environment}-*"]
      },
      {
        Sid    = "S3PDFAccess"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject"]
        Resource = ["arn:aws:s3:::${var.s3_bucket}/*"]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = ["arn:aws:logs:${var.aws_region}:*:log-group:/ecs/${local.name_prefix}-api:*"]
      }
    ]
  })
}
