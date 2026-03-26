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

# Dead Letter Queue for failed jobs
resource "aws_sqs_queue" "jobs_dlq" {
  name                      = "${local.name_prefix}-jobs-dlq"
  message_retention_seconds = 1209600 # 14 days — keep failed messages for investigation

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-jobs-dlq"
  })
}

# Main jobs queue (PDF generation + email sending)
resource "aws_sqs_queue" "jobs" {
  name                       = "${local.name_prefix}-jobs"
  visibility_timeout_seconds = var.visibility_timeout_seconds
  message_retention_seconds  = var.message_retention_seconds

  # Retry up to 3 times before sending to DLQ (Requisito 4.7)
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 3
  })

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-jobs"
  })
}

# CloudWatch alarm for DLQ messages (alert when jobs fail)
resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "${local.name_prefix}-dlq-messages"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 60
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Messages in DLQ — worker jobs are failing"
  treat_missing_data  = "notBreaching"

  dimensions = {
    QueueName = aws_sqs_queue.jobs_dlq.name
  }

  tags = local.common_tags
}
