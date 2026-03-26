# Recomendaciones — Seguridad

## Estado Actual

El proyecto tiene buenas bases de seguridad:
- ✅ bcrypt con 12 rondas (fuerte)
- ✅ JWT con refresh token rotation
- ✅ Tokens en cookies (no localStorage) — protección XSS
- ✅ No revela si el email existe en login
- ✅ Validación de DTOs con whitelist/forbid
- ✅ Ownership validation en todos los endpoints

Lo que falta es principalmente hardening adicional y headers de seguridad.

---

## 1. Headers de Seguridad HTTP 🔴 Crítico

Sin headers de seguridad, el navegador no tiene instrucciones sobre cómo proteger la app.

**En NestJS (`main.ts`):**
```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // Tailwind necesita esto
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.API_URL],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  hsts: {
    maxAge: 31536000,  // 1 año
    includeSubDomains: true,
    preload: true,
  },
}));
```

**En Next.js (`next.config.mjs`):**
```javascript
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

export default {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

---

## 2. CORS Restrictivo 🔴 Crítico

Si `app.enableCors()` está sin opciones, acepta requests de cualquier origen. Esto permite que cualquier sitio web haga requests a la API con las cookies del usuario.

**Configurar CORS correctamente:**
```typescript
app.enableCors({
  origin: [
    process.env.FRONTEND_URL,
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
  ],
  credentials: true,  // Necesario para cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

---

## 3. Sanitización de Inputs 🟡 Importante

`class-validator` valida el tipo y formato, pero no sanitiza HTML/scripts. Un usuario podría inyectar `<script>alert('xss')</script>` en el título de una cotización.

**Instalar:**
```bash
npm install dompurify @types/dompurify
```

**O usar `class-sanitizer`:**
```bash
npm install class-sanitizer
```

```typescript
import { Trim, Escape } from 'class-sanitizer';

export class CreateQuoteDto {
  @Trim()
  @Escape()  // Escapa caracteres HTML
  @IsString()
  @MaxLength(200)
  title: string;
}
```

Para el contenido de notas y términos (que puede renderizarse en la vista pública), sanitizar en el frontend antes de renderizar con `DOMPurify.sanitize()`.

---

## 4. Logout Completo (Invalidar Refresh Token) 🟡 Importante

Actualmente no hay endpoint de logout. El refresh token queda válido hasta que expire (7 días). Si el token se filtra, el atacante tiene acceso por 7 días.

**Agregar endpoint de logout:**
```typescript
// auth.controller.ts
@Post('logout')
@UseGuards(JwtAuthGuard)
async logout(@CurrentUser() user: { sub: string }) {
  await this.authService.logout(user.sub);
  return { message: 'Logged out successfully' };
}

// auth.service.ts
async logout(userId: string) {
  await this.prisma.user.update({
    where: { id: userId },
    data: { refreshToken: null },  // Invalida el refresh token
  });
}
```

**En el frontend, limpiar cookies al hacer logout:**
```typescript
async function logout() {
  await api.post('/auth/logout');
  clearTokens();
  router.push('/login');
}
```

---

## 5. Protección contra Enumeración de Cotizaciones Públicas 🟡 Importante

El `publicId` es un UUID, lo cual es bueno. Pero si alguien adivina o enumera UUIDs, puede ver cotizaciones de otros usuarios.

**Verificaciones adicionales:**
- Asegurarse de que las cotizaciones expiradas no sean accesibles públicamente
- Agregar un campo `isPublic` o verificar que el status sea `SENT`, `VIEWED`, `ACCEPTED` (no `DRAFT`)

```typescript
// public-quotes.service.ts
async findByPublicId(publicId: string) {
  const quote = await this.prisma.quote.findUnique({
    where: { publicId },
  });

  if (!quote) throw new NotFoundException();

  // No mostrar borradores ni cotizaciones eliminadas
  if (quote.status === 'DRAFT' || quote.deletedAt) {
    throw new NotFoundException();  // No revelar que existe
  }

  return quote;
}
```

---

## 6. Límite de Tamaño de Request 🟡 Importante

Sin límite de tamaño, un atacante puede enviar requests enormes para consumir memoria/CPU.

**En NestJS:**
```typescript
// main.ts
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
```

Para uploads de archivos (si se agregan logos), usar límites más específicos con `multer`.

---

## 7. Logging de Eventos de Seguridad 🟡 Importante

No hay registro de intentos de login fallidos, cambios de contraseña, o accesos sospechosos. Esto dificulta detectar ataques de fuerza bruta o cuentas comprometidas.

**Eventos a loggear:**
```typescript
// En auth.service.ts
async login(dto: LoginDto) {
  const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

  if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
    // Loggear intento fallido (sin revelar si el email existe)
    this.logger.warn(`Failed login attempt for email: ${dto.email}`, {
      ip: /* obtener del request */,
      timestamp: new Date().toISOString(),
    });
    throw new UnauthorizedException('Invalid credentials');
  }

  this.logger.log(`Successful login for user: ${user.id}`);
  // ...
}
```

---

## 8. Dependency Scanning 🟢 Nice to have

Las dependencias pueden tener vulnerabilidades conocidas. Automatizar el escaneo.

**GitHub Actions:**
```yaml
- name: Security audit
  run: npm audit --audit-level=high
```

**O usar Dependabot** (configurar en `.github/dependabot.yml`):
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/backend"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule:
      interval: "weekly"
```

---

## 9. Secrets en Código 🟢 Nice to have

Verificar que no haya secrets hardcodeados en el código. Usar `git-secrets` o `truffleHog` en el pipeline.

```yaml
# .github/workflows/security.yml
- name: Scan for secrets
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: ${{ github.event.repository.default_branch }}
    head: HEAD
```

---

## Checklist de Seguridad Pre-Launch

- [ ] Headers de seguridad configurados (Helmet + Next.js)
- [ ] CORS restrictivo (solo el dominio del frontend)
- [ ] Rate limiting en todos los endpoints públicos
- [ ] Logout invalida el refresh token
- [ ] Cotizaciones en DRAFT no accesibles públicamente
- [ ] Límite de tamaño de request configurado
- [ ] Variables de entorno validadas al arrancar
- [ ] Backups de RDS configurados
- [ ] Secrets en AWS Secrets Manager (no en .env en producción)
- [ ] HTTPS forzado (ALB redirige HTTP → HTTPS)
- [ ] Dependency audit sin vulnerabilidades críticas
