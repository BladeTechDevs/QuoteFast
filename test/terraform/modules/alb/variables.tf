variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB"
  type        = list(string)
}

variable "sg_alb_id" {
  description = "Security group ID for the ALB"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS (optional)"
  type        = string
  default     = ""
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
