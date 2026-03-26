terraform {
  backend "s3" {
    bucket         = "quotefast-terraform-state"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "quotefast-terraform-locks"
    encrypt        = true
  }
}
