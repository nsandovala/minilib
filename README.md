# MiniLibreta

> Tu libreta personal. Siempre contigo. Sin internet, sin complicaciones.

MiniLibreta es una PWA (Progressive Web App) de planificación diaria pensada para personas mayores y usuarios no técnicos. Funciona 100 % offline, guarda todos los datos localmente en el dispositivo y se instala con un solo toque desde Chrome en Android.

---

## Características principales

- **100 % offline** — IndexedDB via Dexie.js. Sin servidor, sin cuentas, sin contraseñas.
- **Notas** — Crea, edita y busca notas con editor de pantalla completa.
- **Tareas** — Listas de compras, pendientes del hogar y cuentas por pagar.
- **Medicamentos** — Control de dosis, horarios y recordatorios.
- **Citas médicas** — Agenda con especialidad, lugar y recordatorios.
- **Dibujos** — Lienzo libre para bocetos y anotaciones visuales.
- **Recordatorios locales** — Notificaciones del navegador y banners in-app.
- **Diseño accesible** — Targets táctiles mínimos de 48 px, tipografía clara, alto contraste y modo oscuro optimizado para pantallas AMOLED.

---

## Stack técnico

| Tecnología | Uso |
|-----------|-----|
| [Next.js 14](https://nextjs.org/) (App Router) | Framework React con SSG para PWA |
| [TypeScript](https://www.typescriptlang.org/) strict | Tipado estático en todo el proyecto |
| [Tailwind CSS](https://tailwindcss.com/) + CSS Variables | Diseño atómico y tema oscuro coherente |
| [Dexie.js](https://dexie.org/) + dexie-react-hooks | Base de datos local en IndexedDB con queries reactivas |
| [next-pwa](https://github.com/shadowwalker/next-pwa) | Service Worker, precache y manifest para instalación |

---

## Instalación y desarrollo

Requisitos: Node.js ≥ 18, npm

```bash
# Clonar el repositorio
git clone https://github.com/nsandovala/minilib.git
cd minilib

# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Type checking
npm run typecheck

# Build de producción
npm run build
```

---

## Instalación en Android (distribución vía WhatsApp)

1. Toca el enlace compartido por WhatsApp.
2. Abre la página en **Chrome**.
3. Toca **"Agregar a pantalla de inicio"** o espera el banner de instalación.
4. ¡Listo! La app funciona como cualquier aplicación nativa, incluso sin conexión.

---

## Estructura del proyecto

```
src/
  app/              # Rutas de Next.js (App Router)
  components/       # Componentes React reutilizables
    notes/          # Tarjetas y editor de notas
    ui/             # Shell: navegación, banners, init
  db/               # Capa de datos Dexie (CRUD puro)
  hooks/            # Hooks reactivos con useLiveQuery
  lib/              # Utilidades del navegador (notificaciones)
  types/            # Interfaces TypeScript compartidas
public/
  manifest.json     # Configuración PWA
  icons/            # Iconos 192×192 y 512×512
```

---

## Agentes de automatización

El proyecto incluye un sistema de agentes orquestados desde `agents/orchestrator/router.py`:

| Comando | Descripción |
|---------|-------------|
| `scaffold` | Generar componentes o características nuevas |
| `validate-db` | Validar esquema e integridad de IndexedDB |
| `review` | Revisiones automáticas de código |
| `test-gen` | Generación de tests |
| `release` | Preparar un release |

---

## Licencia

MIT © [nsandovala](https://github.com/nsandovala)
