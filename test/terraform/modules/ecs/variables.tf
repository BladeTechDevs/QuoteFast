variable "environment" {
  description = "Environment name"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for ECS tasks"
  type        = list(string)
}

variable "sg_ecs_id" {
  description = "Security group ID for ECS tasks"
  type        = string
}

variable "target_group_arn" {
  description = "ALB target group ARN"
  type        = string
}

variable "ecr_image_uri" {
  description = "ECR image URI for the API (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/quotefast-api:latest)"
  type        = string
}

variable "cpu" {
  description = "ECS task CPU units"
  type        = number
  default     = 256
}

variable "memory" {
  description = "ECS task memory in MB"
  type        = number
  default     = 512
}

variable "desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

variable "min_capacity" {
  description = "Minimum number of ECS tasks for autoscaling"
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum number of ECS tasks for autoscaling"
  type        = number
  default     = 4
}

variable "database_url_secret_arn" {
  description = "ARN of the Secrets Manager secret containing DATABASE_URL"
  type        = string
}

variable "jwt_secret_arn" {
  description = "ARN of the Secrets Manager secret containing JWT_SECRET"
  type        = string
}

variable "jwt_refresh_secret_arn" {
  description = "ARN of the Secrets Manager secret containing JWT_REFRESH_SECRET"
  type        = string
}

variable "sqs_queue_url" {
  description = "SQS queue URL for async jobs"
  type        = string
}

variable "s3_bucket" {
  description = "S3 bucket name for PDFs"
  type        = string
}

variable "ses_from_email" {
  description = "SES sender email address"
  type        = string
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
