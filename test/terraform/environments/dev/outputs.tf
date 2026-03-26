output "alb_dns_name" {
  description = "ALB DNS name — use this as the API base URL"
  value       = module.alb.alb_dns_name
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "db_credentials_secret_arn" {
  description = "ARN of the secret containing DATABASE_URL"
  value       = module.rds.db_credentials_secret_arn
}

output "sqs_queue_url" {
  description = "SQS jobs queue URL"
  value       = module.sqs.queue_url
}

output "s3_pdfs_bucket" {
  description = "S3 bucket name for PDFs"
  value       = module.s3.pdfs_bucket_name
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = module.ecs.cluster_name
}
