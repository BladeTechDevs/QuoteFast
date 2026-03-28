variable "environment" {
  description = "Environment name"
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

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
