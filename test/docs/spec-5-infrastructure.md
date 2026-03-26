# SPEC 5 — Infrastructure (Terraform + AWS)

## 1. Infrastructure Components

```
┌─────────────────────────────────────────────────────────────┐
│                        AWS Account                          │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Route 53    │───▶│ CloudFront   │───▶│ S3 (Frontend) │  │
│  │ (DNS)       │    │ (CDN + SSL)  │    │ S3 (PDFs)     │  │
│  └─────────────┘    └──────┬───────┘    └───────────────┘  │
│                            │                                │
│                     ┌──────▼───────┐                        │
│                     │     ALB      │                        │
│                     │ (Load Bal.)  │                        │
│                     └──────┬───────┘                        │
│                            │                                │
│  ┌─────────────────────────▼─────────────────────────┐     │
│  │              VPC (10.0.0.0/16)                     │     │
│  │                                                    │     │
│  │  ┌──────────────────┐  ┌────────────────────────┐ │     │
│  │  │ Public Subnets   │  │ Private Subnets        │ │     │
│  │  │ (2 AZs)          │  │ (2 AZs)               │ │     │
│  │  │                  │  │                        │ │     │
│  │  │ • ALB            │  │ • ECS Fargate (API)   │ │     │
│  │  │ • NAT Gateway    │  │ • RDS PostgreSQL      │ │     │
│  │  │                  │  │ • ElastiCache (futuro)│ │     │
│  │  └──────────────────┘  └────────────────────────┘ │     │
│  └────────────────────────────────────────────────────┘     │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │   SQS    │  │  Lambda  │  │   SES    │  │CloudWatch │  │
│  │ (Queues) │─▶│(Workers) │─▶│ (Email)  │  │(Logs/Mon) │  │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘  │
│                                                             │
│  ┌──────────┐  ┌──────────┐                                │
│  │ ECR      │  │ Secrets  │                                │
│  │(Registry)│  │ Manager  │                                │
│  └──────────┘  └──────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Terraform Module Structure

```
terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   ├── staging/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   └── prod/
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── terraform.tfvars
│       └── backend.tf
│
├── modules/
│   ├── networking/
│   │   ├── main.tf              # VPC, subnets, NAT, IGW
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── security-groups.tf
│   │
│   ├── ecs/
│   │   ├── main.tf              # ECS cluster, service, task definition
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── iam.tf               # Task execution role, task role
│   │   └── autoscaling.tf
│   │
│   ├── rds/
│   │   ├── main.tf              # RDS instance, subnet group
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── s3/
│   │   ├── main.tf              # Buckets (PDFs, frontend)
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── sqs/
│   │   ├── main.tf              # Queues + DLQs
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── lambda/
│   │   ├── main.tf              # Lambda functions
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── iam.tf
│   │
│   ├── cloudfront/
│   │   ├── main.tf              # Distribution
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── alb/
│   │   ├── main.tf              # ALB, listeners, target groups
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   └── monitoring/
│       ├── main.tf              # CloudWatch dashboards, alarms
│       ├── variables.tf
│       └── outputs.tf
│
└── shared/
    ├── ecr/
    │   └── main.tf              # ECR repositories (shared across envs)
    └── state/
        └── main.tf              # S3 backend + DynamoDB lock table
```

---

## 3. Environment Configuration

### Dev
```hcl
# environments/dev/terraform.tfvars
environment     = "dev"
aws_region      = "us-east-1"

# ECS
ecs_cpu         = 256        # 0.25 vCPU
ecs_memory      = 512        # 0.5 GB
ecs_desired     = 1
ecs_min         = 1
ecs_max         = 2

# RDS
rds_instance    = "db.t3.micro"
rds_storage     = 20          # GB
rds_multi_az    = false

# Lambda
lambda_memory   = 256
lambda_timeout  = 30

# Flags
enable_cloudfront = false
enable_monitoring = false
```

### Staging
```hcl
# environments/staging/terraform.tfvars
environment     = "staging"
aws_region      = "us-east-1"

ecs_cpu         = 512
ecs_memory      = 1024
ecs_desired     = 1
ecs_min         = 1
ecs_max         = 3

rds_instance    = "db.t3.small"
rds_storage     = 30
rds_multi_az    = false

lambda_memory   = 512
lambda_timeout  = 60

enable_cloudfront = true
enable_monitoring = true
```

### Prod
```hcl
# environments/prod/terraform.tfvars
environment     = "prod"
aws_region      = "us-east-1"

ecs_cpu         = 1024
ecs_memory      = 2048
ecs_desired     = 2
ecs_min         = 2
ecs_max         = 8

rds_instance    = "db.t3.medium"
rds_storage     = 50
rds_multi_az    = true

lambda_memory   = 1024
lambda_timeout  = 120

enable_cloudfront = true
enable_monitoring = true
```

---

## 4. CI/CD Approach

### Pipeline (GitHub Actions)

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Push to │───▶│  Build   │───▶│  Test    │───▶│  Deploy  │
│  branch  │    │  & Lint  │    │          │    │          │
└──────────┘    └──────────┘    └──────────┘    └──────────┘

Branch strategy:
  main     → prod (manual approval)
  staging  → staging (auto)
  develop  → dev (auto)
  feature/* → PR only (no deploy)
```

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [develop, staging, main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build

  deploy-api:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker image
        run: docker build -t quotefast-api .
      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
          docker tag quotefast-api:latest $ECR_URI:$GITHUB_SHA
          docker push $ECR_URI:$GITHUB_SHA
      - name: Update ECS service
        run: |
          aws ecs update-service --cluster quotefast-$ENV --service api --force-new-deployment

  deploy-lambdas:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Package and deploy Lambda functions
        run: |
          zip -r pdf-generator.zip lambdas/pdf-generator/
          aws lambda update-function-code --function-name quotefast-pdf-$ENV --zip-file fileb://pdf-generator.zip

  deploy-frontend:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Build Next.js
        run: npm run build
        working-directory: frontend
      - name: Deploy to S3 / Vercel
        run: vercel deploy --prod  # o sync a S3

  terraform:
    needs: build-and-test
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.message, '[infra]')
    steps:
      - name: Terraform Plan & Apply
        run: |
          terraform -chdir=terraform/environments/$ENV init
          terraform -chdir=terraform/environments/$ENV plan
          terraform -chdir=terraform/environments/$ENV apply -auto-approve
```

---

## 5. Security Best Practices

### Network
- VPC con subnets privadas para ECS y RDS
- RDS no accesible desde internet (solo desde ECS security group)
- ALB con SSL termination (ACM certificate)
- Security groups con principio de mínimo privilegio

### IAM
```
ECS Task Role:
  ├── SQS: SendMessage (pdf-queue, email-queue, tracking-queue)
  ├── S3: PutObject, GetObject (pdf-bucket)
  ├── SES: SendEmail
  └── Secrets Manager: GetSecretValue

Lambda Execution Role:
  ├── SQS: ReceiveMessage, DeleteMessage
  ├── S3: PutObject, GetObject
  ├── SES: SendEmail
  ├── RDS: Connect (via IAM auth o Secrets Manager)
  └── CloudWatch: PutLogEvents

NO wildcards (*) en resources.
```

### Secrets
- Database credentials → AWS Secrets Manager
- JWT secret → AWS Secrets Manager
- API keys → AWS Secrets Manager
- No secrets en variables de entorno ni en código

### Data
- RDS encryption at rest (AES-256)
- S3 encryption at rest (SSE-S3)
- HTTPS everywhere (ALB → ECS también)
- Passwords hasheados con bcrypt (cost factor 12)

---

## 6. Logging & Monitoring

### CloudWatch

```
Logs:
  /ecs/quotefast-api          → Logs de la API NestJS
  /lambda/pdf-generator        → Logs de generación de PDF
  /lambda/email-sender         → Logs de envío de email
  /lambda/tracking-processor   → Logs de tracking

Metrics Dashboard:
  ├── API: Request count, latency (p50, p95, p99), error rate
  ├── ECS: CPU utilization, memory utilization, task count
  ├── RDS: Connections, CPU, free storage, read/write latency
  ├── SQS: Messages in queue, age of oldest message, DLQ depth
  ├── Lambda: Invocations, errors, duration, throttles
  └── Business: Quotes created/day, emails sent/day
```

### Alarms

```
Critical (SNS → PagerDuty/Slack):
  - API error rate > 5% por 5 min
  - RDS CPU > 80% por 10 min
  - RDS free storage < 5 GB
  - DLQ messages > 0
  - ECS task count = 0

Warning (SNS → Slack):
  - API latency p95 > 2s por 5 min
  - SQS message age > 5 min
  - Lambda error rate > 1%
  - ECS CPU > 70% por 15 min
```

---

## 7. Cost Estimation (MVP)

| Service | Config | Costo/mes (estimado) |
|---------|--------|---------------------|
| ECS Fargate | 1 task, 0.25 vCPU, 0.5GB | ~$9 |
| RDS | db.t3.micro (free tier eligible) | $0-15 |
| S3 | < 1GB storage | ~$0.03 |
| SQS | < 1M requests | $0 (free tier) |
| Lambda | < 1M invocations | $0 (free tier) |
| ALB | 1 ALB | ~$16 |
| NAT Gateway | 1 NAT | ~$32 |
| CloudWatch | Basic | ~$3 |
| SES | < 62K emails | $0 (free tier) |
| Route 53 | 1 hosted zone | ~$0.50 |
| **Total MVP** | | **~$60-75/mes** |

### Optimización de costos para MVP
- Considerar usar NAT Instance en vez de NAT Gateway ($32 → ~$4)
- RDS en free tier el primer año
- Lambda y SQS dentro de free tier
- CloudFront solo en staging/prod
- Single AZ para dev (no multi-AZ)
