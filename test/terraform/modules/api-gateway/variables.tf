variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the VPC Link"
  type        = list(string)
}

variable "sg_api_gateway_id" {
  description = "Security group ID for the API Gateway VPC Link"
  type        = string
}

variable "ecs_listener_arn" {
  description = "ARN of the ECS service Cloud Map service discovery or NLB listener"
  type        = string
}

variable "allow_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["*"]
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
