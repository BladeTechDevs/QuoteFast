variable "environment" {
  description = "Environment name"
  type        = string
}

variable "from_email" {
  description = "Email address to verify with SES for sending"
  type        = string
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
