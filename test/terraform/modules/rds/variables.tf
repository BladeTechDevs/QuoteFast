variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for RDS subnet group"
  type        = list(string)
}

variable "sg_rds_id" {
  description = "Security group ID for RDS"
  type        = string
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Allocated storage in GB"
  type        = number
  default     = 20
}

variable "multi_az" {
  description = "Enable Multi-AZ deployment"
  type        = bool
  default     = false
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "quotefast"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "quotefast_admin"
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}
