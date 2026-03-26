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

# Lambda Execution Role
resource "aws_iam_role" "lambda" {
  name = "${local.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
    }]
  })

  tags = local.common_tags
}

# Basic Lambda execution (CloudWatch Logs + VPC networking)
resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name = "${local.name_prefix}-lambda-permissions"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SQSAccess"
        Effect = "Allow"
        Action = [
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes",
          "sqs:ChangeMessageVisibility"
        ]
        Resource = [var.sqs_queue_arn]
      },
      {
        Sid    = "S3PDFAccess"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:PutObjectAcl"]
        Resource = ["${var.s3_bucket_arn}/*"]
      },
      {
        Sid    = "SESSendEmail"
        Effect = "Allow"
        Action = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = ["*"]
      },
      {
        Sid    = "SecretsManagerAccess"
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [var.database_url_secret_arn]
      },
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = ["arn:aws:logs:${var.aws_region}:*:log-group:/lambda/${local.name_prefix}-*:*"]
      }
    ]
  })
}
