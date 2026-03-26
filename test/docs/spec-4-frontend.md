# SPEC 4 — Frontend (UX & Implementation)

## 1. Page Structure

```
/                          → Landing page (pública, SSR para SEO)
/login                     → Login
/register                  → Registro
/dashboard                 → Dashboard principal (cotizaciones recientes, métricas)
/quotes                    → Lista de cotizaciones (con filtros)
/quotes/new                → Crear cotización
/quotes/:id                → Ver/Editar cotización
/quotes/:id/preview        → Preview antes de enviar
/clients                   → Lista de clientes
/clients/:id               → Detalle de cliente
/templates                 → Gestión de plantillas
/settings                  → Configuración de cuenta
/q/:publicId               → Vista pública de cotización (sin auth)
```

---

## 2. Component Hierarchy

```
app/
├── (public)/                          # Rutas públicas
│   ├── layout.tsx                     # Layout sin sidebar
│   ├── page.tsx                       # Landing
│   ├── login/page.tsx
│   ├── register/page.tsx
│   └── q/[publicId]/page.tsx          # Vista pública de cotización
│
├── (app)/                             # Rutas autenticadas
│   ├── layout.tsx                     # Layout con sidebar + topbar
│   ├── dashboard/page.tsx
│   ├── quotes/
│   │   ├── page.tsx                   # Lista
│   │   ├── new/page.tsx               # Crear
│   │   └── [id]/
│   │       ├── page.tsx               # Editar
│   │       └── preview/page.tsx       # Preview
│   ├── clients/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── templates/page.tsx
│   └── settings/page.tsx
│
└── components/
    ├── ui/                            # Componentes base reutilizables
    │   ├── Button.tsx
    │   ├── Input.tsx
    │   ├── Select.tsx
    │   ├── Modal.tsx
    │   ├── Badge.tsx
    │   ├── Card.tsx
    │   ├── Table.tsx
    │   ├── EmptyState.tsx
    │   ├── LoadingSpinner.tsx
    │   └── Toast.tsx
    │
    ├── layout/
    │   ├── Sidebar.tsx
    │   ├── Topbar.tsx
    │   ├── MobileNav.tsx
    │   └── PageHeader.tsx
    │
    ├── quotes/
    │   ├── QuoteForm.tsx              # Formulario principal
    │   ├── QuoteItemRow.tsx           # Fila de item (inline edit)
    │   ├── QuoteItemList.tsx          # Lista de items (drag & drop)
    │   ├── QuoteSummary.tsx           # Subtotal, tax, total
    │   ├── QuoteStatusBadge.tsx       # Badge de status con color
    │   ├── QuoteCard.tsx              # Card en lista
    │   ├── QuotePreview.tsx           # Preview completo
    │   ├── QuoteTrackingPanel.tsx     # Panel de tracking/analytics
    │   └── SendQuoteModal.tsx         # Modal para enviar
    │
    ├── clients/
    │   ├── ClientForm.tsx
    │   ├── ClientCard.tsx
    │   └── ClientSelect.tsx           # Selector de cliente en quote
    │
    └── public/
        ├── PublicQuoteView.tsx         # Vista pública completa
        ├── AcceptRejectButtons.tsx
        └── TrackingPixel.tsx           # Componente invisible para tracking
```

---

## 3. State Management

### Approach: Server State + Minimal Client State

```
Server State (TanStack Query / React Query):
├── Quotes list, detail, tracking
├── Clients list, detail
├── Templates
├── User profile
└── Dashboard metrics

Client State (React useState/useReducer):
├── Quote form state (items being edited)
├── UI state (modals, sidebars, filters)
├── Toast notifications
└── Drag & drop order

Auth State (Context + cookies):
├── JWT token (httpOnly cookie)
├── User info
└── Plan info
```

**¿Por qué no Redux/Zustand?**
- TanStack Query maneja el 90% del estado (server state)
- El estado local es mínimo y no necesita store global
- Menos boilerplate, menos complejidad
- Si crece la necesidad, Zustand es fácil de agregar después

### Hooks Personalizados

```typescript
// hooks/useQuotes.ts
export function useQuotes(filters?: QuoteFilters) {
  return useQuery({
    queryKey: ['quotes', filters],
    queryFn: () => api.quotes.list(filters),
  });
}

// hooks/useCreateQuote.ts
export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.quotes.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });
}

// hooks/useQuoteTracking.ts
export function useQuoteTracking(quoteId: string) {
  return useQuery({
    queryKey: ['quotes', quoteId, 'tracking'],
    queryFn: () => api.quotes.getTracking(quoteId),
    refetchInterval: 30000, // Refresh cada 30 seg
  });
}
```

---

## 4. UX Flows

### Flow 1: Crear Cotización (< 2 minutos)

```
1. Click "Nueva Cotización" (botón prominente en dashboard)
   → Navega a /quotes/new

2. Formulario inline (NO wizard de pasos):
   ┌─────────────────────────────────────────────┐
   │  [Título de la cotización          ]        │
   │                                              │
   │  Cliente: [Buscar o crear...    ▼]          │
   │                                              │
   │  ─── Items ───────────────────────────────  │
   │  │ Servicio          │ Cant │ Precio │ Total│
   │  │ [Diseño UI/UX   ] │ [1]  │ [2500] │ 2500│
   │  │ [Desarrollo      ] │ [1]  │ [4000] │ 4000│
   │  │ + Agregar item                           │
   │  ──────────────────────────────────────────  │
   │                                              │
   │                        Subtotal:  $6,500.00  │
   │                        IVA (16%): $1,040.00  │
   │                        Total:     $7,540.00  │
   │                                              │
   │  Notas: [                              ]    │
   │  Términos: [                           ]    │
   │  Válida hasta: [2026-04-24]                 │
   │                                              │
   │  [Guardar borrador]  [Preview]  [Enviar →]  │
   └─────────────────────────────────────────────┘

3. Todo es inline y en tiempo real
   - Items se agregan con Enter
   - Totales se calculan al escribir
   - Auto-save cada 5 segundos
   - Tab navega entre campos

4. Click "Enviar" → Modal de confirmación
   → Email del destinatario (pre-llenado si hay cliente)
   → Mensaje opcional
   → Confirmar → Enviado
```

### Flow 2: Dashboard

```
┌─────────────────────────────────────────────────────┐
│  QuoteFast                          [Juan] [⚙️]     │
├──────────┬──────────────────────────────────────────┤
│          │                                           │
│ Dashboard│  Buenos días, Juan 👋                     │
│ Quotes   │                                           │
│ Clients  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐    │
│ Templates│  │  12  │ │   5  │ │   3  │ │  $45K│    │
│          │  │Draft │ │ Sent │ │Accept│ │Total │    │
│          │  └──────┘ └──────┘ └──────┘ └──────┘    │
│ Settings │                                           │
│          │  Cotizaciones recientes                   │
│          │  ┌────────────────────────────────────┐   │
│          │  │ Rediseño Web    │ SENT   │ $7,540 │   │
│          │  │ App Móvil       │ VIEWED │ $12,000│   │
│          │  │ SEO Campaign    │ DRAFT  │ $3,200 │   │
│          │  └────────────────────────────────────┘   │
│          │                                           │
│          │  [+ Nueva Cotización]                     │
└──────────┴──────────────────────────────────────────┘
```

### Flow 3: Vista Pública (lo que ve el cliente)

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│  [Logo Mi Agencia]                                   │
│                                                      │
│  COTIZACIÓN                                          │
│  Propuesta de Rediseño Web                           │
│                                                      │
│  De: Mi Agencia — Juan Pérez                         │
│  Para: Empresa XYZ                                   │
│  Fecha: 24 Mar 2026                                  │
│  Válida hasta: 24 Abr 2026                           │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │ Servicio              │ Cant │ Precio  │ Total │  │
│  ├───────────────────────┼──────┼─────────┼───────┤  │
│  │ Diseño UI/UX          │  1   │ $2,500  │$2,500 │  │
│  │ 5 pantallas principales                        │  │
│  ├───────────────────────┼──────┼─────────┼───────┤  │
│  │ Desarrollo Frontend   │  1   │ $4,000  │$4,000 │  │
│  │ Implementación Next.js                         │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│                          Subtotal:     $6,500.00     │
│                          IVA (16%):    $1,040.00     │
│                          Total:        $7,540.00     │
│                                                      │
│  Notas: Incluye 2 rondas de revisión                │
│  Términos: 50% anticipo, 50% al entregar            │
│                                                      │
│  [✅ Aceptar Cotización]  [❌ Rechazar]  [📄 PDF]   │
│                                                      │
│  Powered by QuoteFast                                │
└─────────────────────────────────────────────────────┘
```

---

## 5. Reusable Components

### UI Kit (Tailwind-based)

```typescript
// Button — variantes: primary, secondary, ghost, danger
<Button variant="primary" size="md" loading={false}>
  Enviar Cotización
</Button>

// Input — con label, error, helper text
<Input
  label="Título"
  placeholder="Propuesta de..."
  error="El título es requerido"
/>

// Badge — para status
<Badge variant="sent">Enviada</Badge>
// Variantes: draft (gray), sent (blue), viewed (yellow), accepted (green), rejected (red)

// Card — contenedor con sombra
<Card>
  <Card.Header>Título</Card.Header>
  <Card.Body>Contenido</Card.Body>
</Card>

// EmptyState — cuando no hay datos
<EmptyState
  icon={<FileIcon />}
  title="Sin cotizaciones"
  description="Crea tu primera cotización"
  action={<Button>Crear cotización</Button>}
/>

// Modal — para confirmaciones y formularios
<Modal open={isOpen} onClose={close} title="Enviar cotización">
  <Modal.Body>...</Modal.Body>
  <Modal.Footer>
    <Button variant="ghost" onClick={close}>Cancelar</Button>
    <Button variant="primary" onClick={send}>Enviar</Button>
  </Modal.Footer>
</Modal>

// Table — con sorting y paginación
<Table
  columns={columns}
  data={quotes}
  onSort={handleSort}
  pagination={pagination}
/>
```

### Quote-Specific Components

```typescript
// QuoteItemRow — edición inline
<QuoteItemRow
  item={item}
  onChange={handleChange}
  onDelete={handleDelete}
  onEnter={addNewItem}  // Enter en último campo → nueva fila
/>

// QuoteSummary — cálculos en tiempo real
<QuoteSummary
  subtotal={6500}
  taxRate={16}
  discount={0}
  currency="USD"
/>
// Renderiza: Subtotal, Descuento (si aplica), IVA, Total

// QuoteStatusBadge
<QuoteStatusBadge status="VIEWED" />
// Muestra: 🟡 Vista (con tooltip: "Vista hace 2 horas")

// ClientSelect — combo de búsqueda + crear
<ClientSelect
  value={selectedClient}
  onChange={setClient}
  onCreate={openNewClientModal}
/>
```

---

## 6. Design Principles

1. **Notion-like simplicity:** Interfaz limpia, sin clutter. Cada pantalla tiene un propósito claro.
2. **Inline editing:** No formularios en modales. Todo se edita en contexto.
3. **Keyboard-first:** Tab, Enter, Escape funcionan intuitivamente.
4. **Real-time feedback:** Totales se calculan al escribir. Auto-save visible.
5. **Progressive disclosure:** Features avanzadas (tracking, analytics) no estorban al flujo principal.
6. **Mobile-responsive:** Dashboard y lista de cotizaciones funcionan en móvil. Edición optimizada para desktop.

### Color Palette (sugerida)
```
Primary:    #2563EB (blue-600)    — Acciones principales
Success:    #16A34A (green-600)   — Aceptada, positivo
Warning:    #D97706 (amber-600)   — Vista, pendiente
Danger:     #DC2626 (red-600)     — Rechazada, eliminar
Neutral:    #6B7280 (gray-500)    — Texto secundario
Background: #F9FAFB (gray-50)     — Fondo general
Surface:    #FFFFFF               — Cards, modales
```
