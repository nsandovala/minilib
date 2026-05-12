<div align="center">

# Liev

### Una libreta tranquila para lo cotidiano.

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Dexie-IndexedDB-FF6D00?style=flat-square" />
  <img src="https://img.shields.io/badge/Neon-PostgreSQL-00E599?style=flat-square&logo=postgresql" />
  <img src="https://img.shields.io/badge/Clerk-Auth-6C47FF?style=flat-square" />
  <img src="https://img.shields.io/badge/PWA-Offline-5A0FC8?style=flat-square" />
</p>

</div>

Liev es una **libreta personal offline-first** que transforma texto desordenado en estructuras útiles: listas de compras, pagos, recordatorios de salud, citas y más. Escribe como hablas. Liev entiende, ordena y guarda.

> **Anoto desordenado → Liev entiende → crea una card útil → descanso mental.**

---

## ✨ Características

### 🧠 Inteligencia silenciosa (determinística)
- **Parser cognitivo** — detecta automáticamente si escribes una lista de compras, un pago, una cita médica o una nota.
- **list_builder** — convierte `"comprar en el super, fideos, huevos, leche"` en una lista interactiva con categorías (`lácteos`, `despensa`, `frutas/verduras`, ...).
- **Parser CLP** — entiende precios chilenos: `$2.900`, `12.500`, `15k`, `2 lucas`, `220.000`.
- **Puente Finanzas** — al completar una lista de compras, Liev crea automáticamente un movimiento financiero con el total.

### 🛒 Listas de compras inteligentes
- Ítems con precio, cantidad y unidad (`fideos 2 unidades 1.200`).
- Progreso visual: ítems marcados, total estimado y total comprado en CLP.
- Categorización automática: supermercado, feria, farmacia.

### 💰 Finanzas personales
- Seguimiento de ingresos y egresos.
- Visualización por categoría (cuentas fijas, salud, mascota, gasto cotidiano).
- Suma automática de gastos desde listas de compras.

### 📅 Calendario y citas
- Extracción de fechas desde lenguaje natural: `hoy`, `mañana`, `viernes`, `15 de junio`.
- Agenda médica con especialidad, hora y lugar.
- Recordatorios locales del navegador.

### 🏥 Salud y mascotas
- Control de medicamentos: dosis, horarios, stock.
- Recordatorios de citas y vacunas.
- Tarjetas dedicadas para mascotas.

### 🌑 Diseño calmado
- Paleta oscura premium optimizada para OLED.
- Tipografía clara, targets táctiles ≥ 48 px.
- Cards compactas con jerarquía visual mínima.
- Animaciones suaves sin distracción.

---

## 🏗 Arquitectura

Liev sigue una arquitectura **offline-first híbrida**:

```
Usuario escribe → Parser determinístico → Dexie (local)
                                           ↓
                                    Sync en background
                                           ↓
                                     Neon PostgreSQL
```

| Capa | Tecnología | Descripción |
|------|-----------|-------------|
| **Local DB** | Dexie.js (IndexedDB v7) | Fuente de verdad primaria. Tablas: `entries`, `checklist_items`, `medications`, `appointments`, ... |
| **Cloud DB** | Drizzle ORM + Neon PostgreSQL | Sync/backup cuando hay conexión y autenticación. |
| **Auth** | Clerk (`@clerk/nextjs`) | Autenticación con email, Google, Apple. |
| **Sync** | Push/Pull API (`/api/sync/*`) | Last-write-wins por `updatedAt`. Metadata JSON viaja completa. |
| **Parser** | Agentes determinísticos | `list_builder`, `parser-agent`, `normalizer-agent`, `safety-agent`. |
| **UI** | Next.js 14 App Router | Todas las páginas son client components con `useLiveQuery` reactivo. |

### Flujo de datos

1. El usuario escribe en `UniversalInput`.
2. `orchestrator.ts` ejecuta `safety-check → parseTokens → normalizeEntry`.
3. El resultado se guarda en Dexie `entries`.
4. Si hay internet y sesión activa, el sync engine hace **pull-first, then push**.
5. Los datos viajan a Neon como JSON serializable (`EntryPayload`).

---

## 🚀 Stack técnico

- **Next.js 14** — App Router, SSR/SSG híbrido, API routes.
- **TypeScript** — Strict mode. Tipos compartidos en `src/types/`.
- **Tailwind CSS + CSS Variables** — Tema oscuro coherente, sin clases arbitrarias.
- **Dexie.js + dexie-react-hooks** — Queries reactivas sobre IndexedDB.
- **Drizzle ORM** — Schema-first PostgreSQL en Neon.
- **Clerk** — Auth completo con middleware de protección de rutas.
- **next-pwa** — Service worker, precache, manifest para instalación en Android/iOS.

---

## 🛠 Instalación y desarrollo

Requisitos: Node.js ≥ 18, npm

```bash
# Clonar
git clone https://github.com/nsandovala/minilib.git
cd minilib

# Instalar
npm install

# Variables de entorno (copiar y completar)
cp .env.example .env.local

# Desarrollo
npm run dev

# Type checking
npm run typecheck

# Build de producción
npm run build

# Lint
npm run lint

# DB cloud (requiere .env)
npm run db:push
npm run db:studio
```

### Comandos de agentes

```bash
# Pre-release completo (typecheck + build + docs + db)
python3 agents/orchestrator/router.py pre-release

# Revisión de código
python3 agents/orchestrator/router.py review

# Validación de esquema
python3 agents/orchestrator/router.py validate-db

# Check de documentación
python3 agents/orchestrator/router.py docs-check
```

---

## 📁 Estructura del proyecto

```
src/
  app/                    # Rutas Next.js 14 (App Router)
    api/sync/push         # Push dirty entries → Neon
    api/sync/pull         # Pull server state → Dexie
    purchases/            # Dashboard de compras
    payments/             # Dashboard de finanzas
    health/               # Salud y medicamentos
    pets/                 # Mascotas
    ...
  components/
    UniversalInput.tsx    # Input único con preview de tipo
    TimelineView.tsx      # Timeline agrupado con checklist interactivo
    ui/                   # Shell: navegación, banners, init
  core/agents/
    list-builder-agent.ts # Construye listas de compras determinísticas
    parser-agent.ts       # Extrae fechas, horas, montos, ítems
    normalizer-agent.ts   # Normaliza tokens en ParsedEntry
    safety-agent.ts       # Valida input antes de parsear
    orchestrator.ts       # Pipeline: safety → parse → normalize
  core/queries/           # Queries de filtrado y agrupación
  core/insights/          # Micro-insights sobre patrones de uso
  core/timeline/          # Agrupación y ordenamiento de entries
  db/
    index.ts              # Dexie schema v7 (entries, checklist_items, ...)
    entries.ts            # CRUD de entries + toggleShoppingItem
    checklist.ts          # CRUD de checklist_items (legacy)
    cloud/
      schema.ts           # Drizzle schema (entries, checklist_items)
      queries.ts          # Queries server-side para sync
  lib/
    money.ts              # normalizeCLP — parser de montos chilenos
    entries.ts            # Utilidades: formatCLP, prioridades, pins
    sync/                 # Engine push/pull con last-write-wins
  types/
    index.ts              # Tipos compartidos: TimelineEntry, ShoppingMetadata, ...

public/
  manifest.json           # Configuración PWA
  icons/                  # Iconos 192×192 y 512×512
  sw.js                   # Service worker (generado por next-pwa)

docs/
  LIEV_PRODUCT_CONTEXT.md # Contexto de producto y UX
  DATABASE.md             # Esquema Dexie + Drizzle
  OFFLINE_SYNC.md         # Motor de sync y resolución de conflictos
  MVP_STATUS.md           # Estado del MVP
  ARCHITECTURE.md         # Arquitectura general
  RADAR_AGENT.md          # Documentación del parser determinístico

agents/
  orchestrator/router.py  # Router de comandos de agentes
  prompts/                # Prompts de agentes cognitivos
  checklists/             # Checklists pre-commit/build
```

---

## 🔐 Offline-first y sync

Liev está diseñado para funcionar sin internet:

- **Todas las escrituras** van primero a Dexie (IndexedDB).
- **Dirty flag**: `syncedAt = null` indica cambios pendientes.
- **Sync automático** al volver a tener conexión (pull → merge → push).
- **Conflictos**: resueltos por `updatedAt` (last-write-wins).
- **Soft-delete**: propagado entre dispositivos vía `deletedAt`.

Ver `docs/OFFLINE_SYNC.md` para detalles técnicos.

---

## 🧪 Testing y calidad

```bash
# TypeScript strict
npm run typecheck

# Build de producción
npm run build

# Pre-release completo
python3 agents/orchestrator/router.py pre-release
```

---

## 📄 Licencia

MIT © [nsandovala](https://github.com/nsandovala)

---

<div align="center">

**Liev** — una libreta tranquila para lo cotidiano.

Hecho con calma en Chile.

</div>
