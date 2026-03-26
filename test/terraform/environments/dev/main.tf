terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "quotefast"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

module "networking" {
  source      = "../../modules/networking"
  environment = var.environment
}

module "alb" {
  source            = "../../modules/alb"
  environment       = var.environment
  vpc_id            = module.networking.vpc_id
  public_subnet_ids = module.networking.public_subnet_ids
  sg_alb_id         = module.networking.sg_alb_id
  certificate_arn   = var.certificate_arn
}

module "rds" {
  source             = "../../modules/rds"
  environment        = var.environment
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  sg_rds_id          = module.networking.sg_rds_id
  instance_class     = "db.t3.micro"
  allocated_storage  = 20
  multi_az           = false
}

module "s3" {
  source      = "../../modules/s3"
  environment = var.environment
}

module "ses" {
  source      = "../../modules/ses"
  environment = var.environment
  from_email  = var.ses_from_email
}

module "sqs" {
  source      = "../../modules/sqs"
  environment = var.environment
}

module "lambda" {
  source                  = "../../modules/lambda"
  environment             = var.environment
  aws_region              = var.aws_region
  private_subnet_ids      = module.networking.private_subnet_ids
  sg_lambda_id            = module.networking.sg_lambda_id
  sqs_queue_arn           = module.sqs.queue_arn
  sqs_queue_url           = module.sqs.queue_url
  s3_bucket               = module.s3.pdfs_bucket_name
  s3_bucket_arn           = module.s3.pdfs_bucket_arn
  database_url_secret_arn = module.rds.db_credentials_secret_arn
  ses_from_email          = var.ses_from_email
  memory_size             = 256
  timeout                 = 30
}

module "ecs" {
  source                  = "../../modules/ecs"
  environment             = var.environment
  aws_region              = var.aws_region
  vpc_id                  = module.networking.vpc_id
  private_subnet_ids      = module.networking.private_subnet_ids
  sg_ecs_id               = module.networking.sg_ecs_id
  target_group_arn        = module.alb.target_group_arn
  ecr_image_uri           = var.ecr_image_uri
  cpu                     = 256
  memory                  = 512
  desired_count           = 1
  min_capacity            = 1
  max_capacity            = 2
  database_url_secret_arn = module.rds.db_credentials_secret_arn
  jwt_secret_arn          = var.jwt_secret_arn
  jwt_refresh_secret_arn  = var.jwt_refresh_secret_arn
  sqs_queue_url           = module.sqs.queue_url
  s3_bucket               = module.s3.pdfs_bucket_name
  ses_from_email          = var.ses_from_email
}
