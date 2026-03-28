variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for Lambda VPC config"
  type        = list(string)
}

variable "sg_lambda_id" {
  description = "Security group ID for Lambda functions"
  type        = string
}

variable "sqs_queue_arn" {
  description = "ARN of the SQS jobs queue"
  type        = string
}

variable "sqs_queue_url" {
  description = "URL of the SQS jobs queue"
  type        = string
}

variable "s3_bucket" {
  description = "S3 bucket name for PDFs"
  type        = string
}

variable "s3_bucket_arn" {
  description = "S3 bucket ARN for PDFs"
  type        = string
}

variable "database_url_secret_arn" {
  description = "ARN of the Secrets Manager secret containing DATABASE_URL"
  type        = string
}

variable "ses_from_email" {
  description = "SES sender email address"
  type        = string
}

variable "memory_size" {
  description = "Lambda memory size in MB"
  type        = number
  default     = 512
}

variable "timeout" {
  description = "Lambda timeout in seconds"
  type        = number
  default     = 60
}

variable "ephemeral_storage_size" {
  description = "Lambda ephemeral storage in MB (/tmp) — 512 MB según estimado AWS"
  type        = number
  default     = 512
}

variable "workers_artifact_path" {
  description = "Path to the workers zip artifact"
  type        = string
  default     = "../../../workers/dist/workers.zip"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
