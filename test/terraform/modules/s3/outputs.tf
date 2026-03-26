output "pdfs_bucket_name" {
  description = "Name of the PDFs S3 bucket"
  value       = aws_s3_bucket.pdfs.bucket
}

output "pdfs_bucket_arn" {
  description = "ARN of the PDFs S3 bucket"
  value       = aws_s3_bucket.pdfs.arn
}

output "pdfs_bucket_domain_name" {
  description = "Domain name of the PDFs S3 bucket"
  value       = aws_s3_bucket.pdfs.bucket_domain_name
}
