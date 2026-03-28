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

variable "jwt_secret_value" {
  description = "JWT access token signing key (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "jwt_refresh_secret_value" {
  description = "JWT refresh token signing key (min 32 chars)"
  type        = string
  sensitive   = true
}

variable "cors_allow_origins" {
  description = "Allowed CORS origins for API Gateway"
  type        = list(string)
  default     = ["https://app.quotefast.io"]
}
