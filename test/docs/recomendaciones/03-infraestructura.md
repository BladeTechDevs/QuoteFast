# Recomendaciones — Infraestructura (AWS + Terraform + CI/CD)

## 1. Backups Automáticos en RDS 🔴 Crítico

No hay configuración de backups. Si la base de datos se corrompe o se borra accidentalmente, no hay forma de recuperarla.

**En el módulo Terraform de RDS:**
```hcl
resource "aws_db_instance" "main" {
  # ... configuración existente

  # Backups
  backup_retention_period   = var.environment == "prod" ? 30 : 7
  backup_window             = "03:00-04:00"  # UTC, fuera de horario pico
  maintenance_window        = "Mon:04:00-Mon:05:00"

  # Point-in-time recovery
  delete_automated_backups  = false

  # Protección contra borrado accidental
  deletion_protection       = var.environment == "prod" ? true : false
  skip_final_snapshot       = var.environment == "prod" ? false : true
  final_snapshot_identifier = "${var.environment}-quotefast-final-snapshot"
}
```

---

## 2. Reemplazar NAT Gateway por NAT Instance (MVP) 🔴 Crítico

El NAT Gateway cuesta ~$32/mes solo por existir, más $0.045/GB de datos. Para MVP con tráfico bajo, una NAT Instance en t3.micro cuesta ~$4/mes.

**En el módulo de networking:**
```hcl
# Reemplazar aws_nat_gateway por:
resource "aws_instance" "nat" {
  count                  = var.environment == "prod" ? 0 : 1  # Solo en dev/staging
  ami                    = data.aws_ami.nat.id  # AMI de NAT de Amazon
  instance_type          = "t3.micro"
  subnet_id              = aws_subnet.public[0].id
  source_dest_check      = false
  vpc_security_group_ids = [aws_security_group.nat.id]

  tags = { Name = "nat-instance-${var.environment}" }
}

# En prod, mantener NAT Gateway para alta disponibilidad
resource "aws_nat_gateway" "main" {
  count         = var.environment == "prod" ? length(var.availability_zones) : 0
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
}
```

**Ahorro estimado: ~$28/mes en dev/staging.**

---

## 3. WAF Básico en ALB 🟡 Importante

Los endpoints públicos de QuoteFast (vista de cotización, tracking) son accesibles sin autenticación. Sin WAF, son vulnerables a bots, scraping y ataques básicos.

```hcl
resource "aws_wafv2_web_acl" "main" {
  name  = "quotefast-waf-${var.environment}"
  scope = "REGIONAL"

  default_action { allow {} }

  # Regla 1: Rate limiting global
  rule {
    name     = "RateLimitRule"
    priority = 1
    action { block {} }
    statement {
      rate_based_statement {
        limit              = 2000  # req por 5 min por IP
        aggregate_key_type = "IP"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # Regla 2: AWS Managed Rules (SQL injection, XSS, etc.)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "QuoteFastWAF"
    sampled_requests_enabled   = true
  }
}

# Asociar WAF al ALB
resource "aws_wafv2_web_acl_association" "main" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}
```

---

## 4. Blue/Green Deployment con CodeDeploy 🟡 Importante

El deploy actual (`force-new-deployment`) causa un breve downtime mientras ECS reemplaza las tasks. Con blue/green, el tráfico se migra gradualmente sin downtime.

**En el módulo ECS:**
```hcl
resource "aws_ecs_service" "api" {
  # ... configuración existente

  deployment_controller {
    type = "CODE_DEPLOY"  # Cambiar de ECS a CODE_DEPLOY
  }

  # Dos target groups: blue y green
  load_balancer {
    target_group_arn = aws_lb_target_group.blue.arn
    container_name   = "api"
    container_port   = 3000
  }
}

resource "aws_codedeploy_deployment_group" "api" {
  app_name               = aws_codedeploy_app.api.name
  deployment_group_name  = "quotefast-api-${var.environment}"
  service_role_arn       = aws_iam_role.codedeploy.arn
  deployment_config_name = "CodeDeployDefault.ECSAllAtOnce"

  ecs_service {
    cluster_name = aws_ecs_cluster.main.name
    service_name = aws_ecs_service.api.name
  }

  load_balancer_info {
    target_group_pair_info {
      prod_traffic_route { listener_arns = [aws_lb_listener.https.arn] }
      target_group { name = aws_lb_target_group.blue.name }
      target_group { name = aws_lb_target_group.green.name }
    }
  }
}
```

---

## 5. VPC Flow Logs 🟡 Importante

Sin flow logs, no hay visibilidad del tráfico de red. Si hay un incidente de seguridad, no hay forma de investigarlo.

```hcl
resource "aws_flow_log" "main" {
  vpc_id          = aws_vpc.main.id
  traffic_type    = "ALL"
  iam_role_arn    = aws_iam_role.flow_logs.arn
  log_destination = aws_cloudwatch_log_group.flow_logs.arn
}

resource "aws_cloudwatch_log_group" "flow_logs" {
  name              = "/vpc/quotefast-${var.environment}"
  retention_in_days = 30
}
```

---

## 6. Rotación Automática de Secrets 🟡 Importante

Los secrets en AWS Secrets Manager no se rotan automáticamente. Si una credencial se filtra, puede ser usada indefinidamente.

```hcl
resource "aws_secretsmanager_secret_rotation" "db_password" {
  secret_id           = aws_secretsmanager_secret.db_password.id
  rotation_lambda_arn = aws_lambda_function.rotate_secret.arn

  rotation_rules {
    automatically_after_days = 30
  }
}
```

Para JWT secrets, la rotación es más compleja (requiere invalidar tokens existentes). Documentar el proceso manual de rotación como mínimo.

---

## 7. Alarmas de CloudWatch Mejoradas 🟡 Importante

Las alarmas actuales son básicas. Agregar alarmas de negocio además de las de infraestructura.

**Alarmas de negocio:**
```hcl
# Alerta si no se crean cotizaciones en 24h (posible problema de prod)
resource "aws_cloudwatch_metric_alarm" "no_quotes_created" {
  alarm_name          = "quotefast-no-quotes-24h"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "QuotesCreated"
  namespace           = "QuoteFast/Business"
  period              = 86400  # 24 horas
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "No se han creado cotizaciones en 24 horas"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}

# Alerta si la DLQ tiene mensajes (jobs fallidos)
resource "aws_cloudwatch_metric_alarm" "dlq_messages" {
  alarm_name          = "quotefast-dlq-not-empty"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  dimensions = {
    QueueName = aws_sqs_queue.pdf_dlq.name
  }
  alarm_actions = [aws_sns_topic.alerts.arn]
}
```

---

## 8. Docker Compose para Desarrollo Local 🟡 Importante

No hay forma fácil de levantar el entorno local. Cada dev tiene que configurar PostgreSQL manualmente.

**Crear `docker-compose.yml` en la raíz:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: quotefast
      POSTGRES_USER: quotefast
      POSTGRES_PASSWORD: quotefast_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  # LocalStack para simular AWS SQS/S3/SES en local
  localstack:
    image: localstack/localstack
    ports:
      - "4566:4566"
    environment:
      SERVICES: sqs,s3,ses
      DEFAULT_REGION: us-east-1

volumes:
  postgres_data:
```

---

## 9. GitHub Actions Mejorado 🟢 Nice to have

El pipeline actual no tiene caché de dependencias ni paralelización óptima.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'  # Cachear node_modules
      - run: npm ci --prefer-offline
      - run: npm run lint
      - run: npm run test:run
      - uses: codecov/codecov-action@v4  # Subir cobertura

  deploy-api:
    needs: test
    if: github.ref == 'refs/heads/main'
    # ... resto del deploy
```

---

## 10. Multi-región para LATAM 🟢 Nice to have

El spec menciona LATAM como mercado principal, pero toda la infraestructura está en `us-east-1`. La latencia desde Buenos Aires o Ciudad de México a us-east-1 es ~100-150ms.

**Opciones por costo:**
1. **CloudFront** (ya planeado): Reduce latencia para assets estáticos y cotizaciones públicas (caché en edge)
2. **us-east-1 + sa-east-1 (São Paulo)**: Para usuarios de Brasil/Cono Sur
3. **us-east-1 + us-west-2**: Para México/Centroamérica

Para MVP, CloudFront es suficiente. Multi-región es para cuando haya usuarios reales que se quejen de latencia.
