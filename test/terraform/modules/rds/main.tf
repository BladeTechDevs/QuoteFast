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

# Random password for RDS master user
resource "random_password" "db" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Store DB credentials in Secrets Manager
resource "aws_secretsmanager_secret" "db_credentials" {
  name                    = "${local.name_prefix}/rds/credentials"
  description             = "RDS master credentials for QuoteFast ${var.environment}"
  recovery_window_in_days = 7

  tags = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db.result
    host     = aws_db_instance.main.address
    port     = 5432
    dbname   = var.db_name
    url      = "postgresql://${var.db_username}:${random_password.db.result}@${aws_db_instance.main.address}:5432/${var.db_name}?schema=public"
  })
}

# RDS Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-db-subnet-group"
  })
}

# RDS Parameter Group for PostgreSQL 15
resource "aws_db_parameter_group" "main" {
  name   = "${local.name_prefix}-pg15"
  family = "postgres15"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  tags = local.common_tags
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-postgres"

  engine               = "postgres"
  engine_version       = "15.10"
  instance_class       = var.instance_class
  allocated_storage    = var.allocated_storage
  max_allocated_storage = var.allocated_storage * 2 # Enable storage autoscaling

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.sg_rds_id]
  parameter_group_name   = aws_db_parameter_group.main.name

  multi_az               = var.multi_az
  publicly_accessible    = false
  deletion_protection    = var.environment == "prod" ? true : false
  skip_final_snapshot    = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${local.name_prefix}-final-snapshot" : null

  # Encryption at rest (Requisito 12 — security)
  storage_encrypted = true

  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  performance_insights_enabled = var.environment == "prod" ? true : false

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-postgres"
  })
}
