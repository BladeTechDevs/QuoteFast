variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "ecr_image_uri" {
  description = "ECR image URI for the API"
  type        = string
}

variable "ses_from_email" {
  description = "SES sender email address"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

variable "jwt_secret_arn" {
  description = "ARN of Secrets Manager secret for JWT_SECRET"
  type        = string
}

variable "jwt_refresh_secret_arn" {
  description = "ARN of Secrets Manager secret for JWT_REFRESH_SECRET"
  type        = string
}
