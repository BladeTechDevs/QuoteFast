locals {
  common_env = {
    NODE_ENV       = var.environment
    APP_AWS_REGION = var.aws_region
    S3_BUCKET      = var.s3_bucket
    SQS_QUEUE_URL  = var.sqs_queue_url
    SES_FROM_EMAIL = var.ses_from_email
  }
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "pdf_worker" {
  name              = "/lambda/${local.name_prefix}-pdf-worker"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "email_worker" {
  name              = "/lambda/${local.name_prefix}-email-worker"
  retention_in_days = 30
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "expiry_worker" {
  name              = "/lambda/${local.name_prefix}-expiry-worker"
  retention_in_days = 30
  tags              = local.common_tags
}

# PDF Worker Lambda — triggered by SQS
resource "aws_lambda_function" "pdf_worker" {
  function_name = "${local.name_prefix}-pdf-worker"
  role          = aws_iam_role.lambda.arn
  handler       = "pdf-worker.handler"
  runtime       = "nodejs20.x"
  memory_size   = var.memory_size
  timeout       = var.timeout
  filename      = var.workers_artifact_path

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.sg_lambda_id]
  }

  environment {
    variables = merge(local.common_env, {
      DATABASE_URL_SECRET_ARN = var.database_url_secret_arn
    })
  }

  depends_on = [aws_cloudwatch_log_group.pdf_worker]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-pdf-worker"
  })
}

# Email Worker Lambda — triggered by SQS
resource "aws_lambda_function" "email_worker" {
  function_name = "${local.name_prefix}-email-worker"
  role          = aws_iam_role.lambda.arn
  handler       = "email-worker.handler"
  runtime       = "nodejs20.x"
  memory_size   = var.memory_size
  timeout       = var.timeout
  filename      = var.workers_artifact_path

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.sg_lambda_id]
  }

  environment {
    variables = merge(local.common_env, {
      DATABASE_URL_SECRET_ARN = var.database_url_secret_arn
    })
  }

  depends_on = [aws_cloudwatch_log_group.email_worker]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-email-worker"
  })
}

# Expiry Worker Lambda — triggered by EventBridge schedule (every hour)
resource "aws_lambda_function" "expiry_worker" {
  function_name = "${local.name_prefix}-expiry-worker"
  role          = aws_iam_role.lambda.arn
  handler       = "expiry-worker.handler"
  runtime       = "nodejs20.x"
  memory_size   = 256
  timeout       = 120
  filename      = var.workers_artifact_path

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [var.sg_lambda_id]
  }

  environment {
    variables = merge(local.common_env, {
      DATABASE_URL_SECRET_ARN = var.database_url_secret_arn
    })
  }

  depends_on = [aws_cloudwatch_log_group.expiry_worker]

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-expiry-worker"
  })
}

# SQS → PDF Worker trigger
resource "aws_lambda_event_source_mapping" "sqs_pdf" {
  event_source_arn                   = var.sqs_queue_arn
  function_name                      = aws_lambda_function.pdf_worker.arn
  batch_size                         = 1
  maximum_batching_window_in_seconds = 0

  filter_criteria {
    filter {
      pattern = jsonencode({ body = { type = ["GENERATE_PDF"] } })
    }
  }
}

# SQS → Email Worker trigger
resource "aws_lambda_event_source_mapping" "sqs_email" {
  event_source_arn                   = var.sqs_queue_arn
  function_name                      = aws_lambda_function.email_worker.arn
  batch_size                         = 1
  maximum_batching_window_in_seconds = 0

  filter_criteria {
    filter {
      pattern = jsonencode({ body = { type = ["SEND_EMAIL", "SEND_QUOTE"] } })
    }
  }
}

# EventBridge rule — trigger expiry worker every hour (Requisito 7.2)
resource "aws_cloudwatch_event_rule" "expiry_schedule" {
  name                = "${local.name_prefix}-expiry-schedule"
  description         = "Trigger expiry worker every hour to mark expired quotes"
  schedule_expression = "rate(1 hour)"

  tags = local.common_tags
}

resource "aws_cloudwatch_event_target" "expiry_lambda" {
  rule      = aws_cloudwatch_event_rule.expiry_schedule.name
  target_id = "ExpiryWorkerLambda"
  arn       = aws_lambda_function.expiry_worker.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.expiry_worker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.expiry_schedule.arn
}
