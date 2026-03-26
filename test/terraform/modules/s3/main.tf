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

# S3 bucket for generated PDFs (Requisito 4.4, 11.2)
resource "aws_s3_bucket" "pdfs" {
  bucket = "${local.name_prefix}-pdfs"

  tags = merge(local.common_tags, {
    Name    = "${local.name_prefix}-pdfs"
    Purpose = "quote-pdfs"
  })
}

# Block all public access — PDFs served via signed URLs only
resource "aws_s3_bucket_public_access_block" "pdfs" {
  bucket = aws_s3_bucket.pdfs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Encryption at rest (Requisito 12 — security)
resource "aws_s3_bucket_server_side_encryption_configuration" "pdfs" {
  bucket = aws_s3_bucket.pdfs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Versioning for PDFs
resource "aws_s3_bucket_versioning" "pdfs" {
  bucket = aws_s3_bucket.pdfs.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle: move old PDFs to cheaper storage after 90 days
resource "aws_s3_bucket_lifecycle_configuration" "pdfs" {
  bucket = aws_s3_bucket.pdfs.id

  rule {
    id     = "archive-old-pdfs"
    status = "Enabled"

    filter {}

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }
  }
}

# CORS configuration for direct browser downloads
resource "aws_s3_bucket_cors_configuration" "pdfs" {
  bucket = aws_s3_bucket.pdfs.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET"]
    allowed_origins = ["*"]
    max_age_seconds = 3600
  }
}
