locals {
  name_prefix = "quotefast-${var.environment}"
  common_tags = merge(
    {
      Project     = "quotefast"
      Environment = var.environment
      ManagedBy   = "terraform"
    },
    var.tags
  )
}

# Verify the sender email address with SES
resource "aws_ses_email_identity" "sender" {
  email = var.from_email
}

# Configuration set for tracking email delivery metrics
resource "aws_ses_configuration_set" "main" {
  name = "${local.name_prefix}-config-set"

  delivery_options {
    tls_policy = "Require"
  }
}

# CloudWatch event destination for bounce/complaint tracking
resource "aws_ses_event_destination" "cloudwatch" {
  name                   = "${local.name_prefix}-cw-destination"
  configuration_set_name = aws_ses_configuration_set.main.name
  enabled                = true

  matching_types = ["bounce", "complaint", "delivery"]

  cloudwatch_destination {
    default_value  = "0"
    dimension_name = "EmailType"
    value_source   = "messageTag"
  }
}
