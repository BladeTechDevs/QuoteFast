output "pdf_worker_arn" {
  description = "ARN of the PDF worker Lambda"
  value       = aws_lambda_function.pdf_worker.arn
}

output "email_worker_arn" {
  description = "ARN of the email worker Lambda"
  value       = aws_lambda_function.email_worker.arn
}

output "expiry_worker_arn" {
  description = "ARN of the expiry worker Lambda"
  value       = aws_lambda_function.expiry_worker.arn
}

output "lambda_role_arn" {
  description = "IAM role ARN used by Lambda functions"
  value       = aws_iam_role.lambda.arn
}
