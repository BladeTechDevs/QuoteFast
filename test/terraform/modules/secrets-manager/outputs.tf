output "jwt_secret_arn" {
  description = "ARN of the JWT secret"
  value       = aws_secretsmanager_secret.jwt_secret.arn
}

output "jwt_refresh_secret_arn" {
  description = "ARN of the JWT refresh secret"
  value       = aws_secretsmanager_secret.jwt_refresh_secret.arn
}
