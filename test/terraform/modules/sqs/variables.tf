variable "environment" {
  description = "Environment name"
  type        = string
}

variable "message_retention_seconds" {
  description = "SQS message retention period in seconds"
  type        = number
  default     = 86400 # 24 hours
}

variable "visibility_timeout_seconds" {
  description = "SQS visibility timeout in seconds (should be >= Lambda timeout)"
  type        = number
  default     = 300 # 5 minutes
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
