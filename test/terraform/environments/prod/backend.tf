terraform {
  backend "s3" {
    bucket         = "quotefast-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "quotefast-terraform-locks"
    encrypt        = true
  }
}
