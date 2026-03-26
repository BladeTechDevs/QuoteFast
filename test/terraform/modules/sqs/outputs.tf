output "queue_url" {
  description = "URL of the main jobs SQS queue"
  value       = aws_sqs_queue.jobs.url
}

output "queue_arn" {
  description = "ARN of the main jobs SQS queue"
  value       = aws_sqs_queue.jobs.arn
}

output "dlq_url" {
  description = "URL of the Dead Letter Queue"
  value       = aws_sqs_queue.jobs_dlq.url
}

output "dlq_arn" {
  description = "ARN of the Dead Letter Queue"
  value       = aws_sqs_queue.jobs_dlq.arn
}
