output "sender_email" {
  description = "Verified SES sender email address"
  value       = aws_ses_email_identity.sender.email
}

output "configuration_set_name" {
  description = "SES configuration set name"
  value       = aws_ses_configuration_set.main.name
}
