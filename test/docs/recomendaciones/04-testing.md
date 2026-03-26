# Recomendaciones — Testing

## Estado Actual

El proyecto tiene property-based tests (PBT) con `fast-check` en áreas críticas:
- `auth.service.spec.ts` — Auth
- `quotes.service.pbt.spec.ts` — Servicio de cotizaciones
- `quotes.expiry.pbt.spec.ts` — Expiración de cotizaciones
- `quotes.publicid.pbt.spec.ts` — Generación de IDs públicos
- `quote-items.totals.pbt.spec.ts` — Cálculo de totales
- `dashboard.metrics.pbt.spec.ts` — Métricas del dashboard
- `tracking.viewedat.pbt.spec.ts` — Tracking

Esto es excelente. Los PBT son más robustos que los unit tests tradicionales para lógica de negocio.

**Lo que falta:** Tests de integración, tests de frontend, y cobertura en módulos sin tests.

---

## 1. Tests de Integración con Base de Datos Real 🔴 Crítico

Los tests actuales mockean Prisma. Esto significa que los tests pasan aunque las queries estén mal escritas.

**Configurar test database:**
```typescript
// test/setup.ts
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

beforeAll(async () => {
  // Aplicar migraciones a la DB de test
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: process.env.TEST_DATABASE_URL },
  });
});

afterEach(async () => {
  // Limpiar datos entre tests (orden importa por FK constraints)
  await prisma.$transaction([
    prisma.trackingEvent.deleteMany(),
    prisma.quoteItem.deleteMany(),
    prisma.quote.deleteMany(),
    prisma.client.deleteMany(),
    prisma.template.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});
```

**En `docker-compose.yml`, agregar DB de test:**
```yaml
postgres-test:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: quotefast_test
    POSTGRES_USER: quotefast
    POSTGRES_PASSWORD: quotefast_test
  ports:
    - "5433:5432"
```

---

## 2. Tests de Integración para Endpoints Críticos 🟡 Importante

Usar `@nestjs/testing` con `supertest` para testear los endpoints end-to-end.

**Ejemplo para el flujo de cotización:**
```typescript
// quotes.integration.spec.ts
describe('Quotes Integration', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    // Registrar usuario y obtener token
    const { body } = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'test@test.com', password: 'Test1234!', name: 'Test' });
    authToken = body.accessToken;
  });

  it('should create a quote', async () => {
    const { body, status } = await request(app.getHttpServer())
      .post('/quotes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Test Quote', currency: 'USD' });

    expect(status).toBe(201);
    expect(body.title).toBe('Test Quote');
    expect(body.status).toBe('DRAFT');
    expect(body.total).toBe('0.00');
  });

  it('should enforce free plan limit', async () => {
    // Crear 5 cotizaciones (límite del plan FREE)
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/quotes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: `Quote ${i}` });
    }

    // La 6ta debe fallar
    const { status } = await request(app.getHttpServer())
      .post('/quotes')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Quote 6' });

    expect(status).toBe(403);
  });
});
```

---

## 3. Tests de Frontend con Vitest + Testing Library 🟡 Importante

No hay tests en el frontend. Los componentes críticos (QuoteForm, QuoteItemRow, totales) deberían tener tests.

**Instalar:**
```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom
```

**Ejemplo para `QuoteSummary`:**
```typescript
// QuoteSummary.test.tsx
import { render, screen } from '@testing-library/react';
import { QuoteSummary } from './QuoteSummary';

describe('QuoteSummary', () => {
  it('calculates totals correctly', () => {
    render(
      <QuoteSummary subtotal={6500} taxRate={16} discount={0} currency="USD" />
    );

    expect(screen.getByText('$6,500.00')).toBeInTheDocument();
    expect(screen.getByText('$1,040.00')).toBeInTheDocument(); // 16% de 6500
    expect(screen.getByText('$7,540.00')).toBeInTheDocument(); // total
  });

  it('applies discount correctly', () => {
    render(
      <QuoteSummary subtotal={1000} taxRate={0} discount={100} currency="USD" />
    );
    expect(screen.getByText('$900.00')).toBeInTheDocument();
  });
});
```

---

## 4. Tests E2E con Playwright 🟢 Nice to have

Los tests de integración cubren el backend, pero no el flujo completo usuario → UI → API → DB.

**Instalar:**
```bash
npm install -D @playwright/test
npx playwright install
```

**Flujo crítico a testear:**
```typescript
// e2e/create-quote.spec.ts
test('user can create and send a quote', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name=email]', 'test@test.com');
  await page.fill('[name=password]', 'Test1234!');
  await page.click('button[type=submit]');

  // Crear cotización
  await page.click('text=Nueva Cotización');
  await page.fill('[name=title]', 'Propuesta de prueba');
  await page.click('text=Agregar item');
  await page.fill('[name=items.0.name]', 'Diseño UI');
  await page.fill('[name=items.0.unitPrice]', '2500');

  // Verificar total
  await expect(page.locator('[data-testid=total]')).toHaveText('$2,500.00');

  // Enviar
  await page.click('text=Enviar');
  await expect(page.locator('[data-testid=status-badge]')).toHaveText('Enviada');
});
```

---

## 5. Cobertura de Código 🟡 Importante

No hay configuración de cobertura mínima. Esto permite que el código crítico quede sin testear.

**En `jest.config.js` del backend:**
```javascript
module.exports = {
  // ... configuración existente
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    // Cobertura más estricta para lógica de negocio crítica
    './src/quotes/': {
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
};
```

---

## 6. Módulos sin Tests (Prioridad) 🟡 Importante

Módulos que actualmente no tienen tests y deberían tenerlos:

| Módulo | Prioridad | Qué testear |
|--------|-----------|-------------|
| `clients.service.ts` | Alta | CRUD, ownership validation |
| `templates.service.ts` | Media | CRUD, default templates |
| `public-quotes.service.ts` | Alta | Vista pública, accept/reject, tracking |
| `quotes-send.service.ts` | Alta | Envío de email, cambio de status |
| `quote-items.service.ts` | Alta | Cálculo de totales, reordenamiento |
| `auth.service.ts` | Alta | Ya tiene spec, ampliar casos edge |

---

## 7. Mutation Testing 🟢 Nice to have

Los tests pueden pasar aunque el código tenga bugs si los assertions son débiles. Mutation testing verifica que los tests realmente detectan cambios en el código.

**Instalar Stryker:**
```bash
npm install -D @stryker-mutator/core @stryker-mutator/jest-runner
```

Ejecutar en los módulos más críticos (quotes, auth) para verificar la calidad de los tests existentes.
