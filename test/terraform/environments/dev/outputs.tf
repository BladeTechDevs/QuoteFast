output "api_gateway_url" {
  description = "API Gateway invoke URL — use this as the API base URL"
  value       = module.api_gateway.api_gateway_url
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

output "jwt_secret_arn" {
  description = "ARN of the JWT secret in Secrets Manager"
  value       = module.secrets_manager.jwt_secret_arn
}

output "jwt_refresh_secret_arn" {
  description = "ARN of the JWT refresh secret in Secrets Manager"
  value       = module.secrets_manager.jwt_refresh_secret_arn
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
