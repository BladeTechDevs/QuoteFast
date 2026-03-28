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

# ── Networking: VPC, subnets, 1 NAT Gateway (1 AZ), security groups ──────────
module "networking" {
  source      = "../../modules/networking"
  environment = var.environment
}

# ── Secrets Manager: JWT secrets (DB secret lo crea el módulo RDS) ────────────
module "secrets_manager" {
  source                   = "../../modules/secrets-manager"
  environment              = var.environment
  jwt_secret_value         = var.jwt_secret_value
  jwt_refresh_secret_value = var.jwt_refresh_secret_value
}

# ── RDS PostgreSQL: db.t3.micro, 20 GB gp2, Single-AZ ───────────────────────
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

# ── S3: bucket para PDFs (~0.25 GB/mes) ──────────────────────────────────────
module "s3" {
  source      = "../../modules/s3"
  environment = var.environment
}

# ── SES: envío de emails transaccionales (~100/mes) ──────────────────────────
module "ses" {
  source      = "../../modules/ses"
  environment = var.environment
  from_email  = var.ses_from_email
}

# ── SQS: cola de jobs + DLQ (~200 mensajes/mes) ──────────────────────────────
module "sqs" {
  source      = "../../modules/sqs"
  environment = var.environment
}

# ── Lambda: workers email + PDF + expiry (x86, 512 MB, ~200 invocaciones/mes)
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
  memory_size             = 512
  timeout                 = 60
  ephemeral_storage_size  = 512
}

# ── ECS Fargate: 1 tarea continua, Linux x86, 730 h/mes ─────────────────────
module "ecs" {
  source                  = "../../modules/ecs"
  environment             = var.environment
  aws_region              = var.aws_region
  vpc_id                  = module.networking.vpc_id
  private_subnet_ids      = module.networking.private_subnet_ids
  sg_ecs_id               = module.networking.sg_ecs_id
  ecr_image_uri           = var.ecr_image_uri
  cpu                     = 256
  memory                  = 512
  desired_count           = 1
  min_capacity            = 1
  max_capacity            = 1
  database_url_secret_arn = module.rds.db_credentials_secret_arn
  jwt_secret_arn          = module.secrets_manager.jwt_secret_arn
  jwt_refresh_secret_arn  = module.secrets_manager.jwt_refresh_secret_arn
  sqs_queue_url           = module.sqs.queue_url
  s3_bucket               = module.s3.pdfs_bucket_name
  ses_from_email          = var.ses_from_email
}

# ── API Gateway: HTTP API → VPC Link → ECS (~10 000 req/mes) ─────────────────
module "api_gateway" {
  source             = "../../modules/api-gateway"
  environment        = var.environment
  vpc_id             = module.networking.vpc_id
  private_subnet_ids = module.networking.private_subnet_ids
  sg_api_gateway_id  = module.networking.sg_api_gateway_id
  ecs_listener_arn   = module.ecs.service_name
  allow_origins      = ["*"]
}
