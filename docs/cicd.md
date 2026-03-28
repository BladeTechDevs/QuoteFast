# CI/CD

Pipeline: **GitHub Actions**
Archivo: `.github/workflows/ci.yml`

## Triggers

El pipeline se ejecuta en:
- Push a `main`, `staging`, `develop`
- Pull Request hacia `main`, `staging`, `develop`

## Jobs

### Backend — Lint & Test

1. Checkout del código
2. Setup Node.js 20 con caché de npm
3. Instalar dependencias (`npm ci`)
4. Lint con ESLint
5. Generar cliente Prisma
6. Aplicar migraciones en la DB de test (PostgreSQL 16 en servicio de GitHub Actions)
7. Ejecutar tests con Jest (`npm run test:run`)
8. Build de producción (`npm run build`)

Variables de entorno usadas en CI:
```
DATABASE_URL=postgresql://quotefast:quotefast_test@localhost:5432/quotefast_test
```

### Frontend — Lint & Build

1. Checkout del código
2. Setup Node.js 20
3. Instalar dependencias
4. Lint con ESLint
5. Type check con TypeScript
6. Build de producción (`npm run build`)

### Security — Audit

1. `npm audit` en backend
2. `npm audit` en frontend

Detecta vulnerabilidades conocidas en dependencias.

---

## Flujo recomendado de ramas

```
feature/* → develop → staging → main
```

- `develop` — integración continua, deploy automático a entorno dev
- `staging` — QA, deploy automático a entorno staging
- `main` — producción, deploy manual o con aprobación

---

## Agregar deploy automático

Para agregar deploy a ECS al hacer merge en `main`, agregar un job al workflow:

```yaml
deploy:
  needs: [backend, frontend, security]
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - uses: aws-actions/configure-aws-credentials@v4
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-east-1

    - name: Build and push to ECR
      run: |
        docker build -t quotefast-api ./backend
        docker push <ecr-url>/quotefast-api:latest

    - name: Deploy to ECS
      run: |
        aws ecs update-service --cluster quotefast-prod \
          --service quotefast-api --force-new-deployment
```

Secrets requeridos en GitHub:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
