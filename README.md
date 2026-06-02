# SGD Frontend — Sistema de Gestión Documental

Frontend web del sistema de gestión documental de Helisa S.A.S, construido con React 19, TypeScript y Vite.

## Stack

| Categoría           | Librería                                      |
| ------------------- | --------------------------------------------- |
| Framework           | React 19 + TypeScript                         |
| Build               | Vite 7                                        |
| Routing             | TanStack Router (file-based)                  |
| Data fetching       | TanStack Query                                |
| UI                  | shadcn/ui + Tailwind CSS v4                   |
| Estado global       | Zustand                                       |
| i18n                | i18next (es/en)                               |
| Tests unitarios     | Vitest + Testing Library                      |
| Tests E2E           | Playwright                                    |
| Mocks de desarrollo | MSW v2                                        |
| Observabilidad      | Sentry (opcional, requiere `VITE_SENTRY_DSN`) |

## Requisitos

- Node.js 20+
- npm 10+
- Backend SGD corriendo localmente **o** `VITE_USE_MOCKS=true` para desarrollo sin backend

## Setup local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env según el entorno (ver sección Variables de entorno)

# 3. (Opcional) Instalar browsers de Playwright para E2E
npx playwright install --with-deps chromium

# 4. Iniciar el servidor de desarrollo
npm run dev
```

La app queda disponible en `http://localhost:5173`.

## Variables de entorno

| Variable          | Obligatoria | Descripción                                                  |
| ----------------- | ----------- | ------------------------------------------------------------ |
| `VITE_API_URL`    | Sí          | URL base del API Gateway. Ej: `http://localhost:8000/api/v1` |
| `VITE_USE_MOCKS`  | Sí          | `true` para usar MSW sin backend, `false` para backend real  |
| `VITE_SENTRY_DSN` | No          | DSN de Sentry. Si está vacío, Sentry no envía eventos        |

Ver `.env.example` para comentarios detallados y las variables de despliegue (`RAILWAY_API_URL`).

## Scripts disponibles

```bash
npm run dev          # Servidor de desarrollo con HMR
npm run build        # Build de producción (dist/)
npm run preview      # Preview del build de producción
npm run typecheck    # Verificación de tipos TypeScript
npm run lint         # ESLint
npm run format       # Prettier

npm run test         # Tests unitarios (run una vez)
npm run test:watch   # Tests en modo watch
npm run test:cov     # Tests con reporte de cobertura

npm run e2e          # Tests E2E con Playwright (headless)
npm run e2e:headed   # Tests E2E con ventana visible
npm run e2e:debug    # Tests E2E en modo debug
npm run e2e:report   # Abrir el último reporte de Playwright
```

## Arquitectura de carpetas

```text
src/
├── assets/              # Imágenes, SVGs estáticos
├── components/
│   └── ui/              # Primitivos shadcn/ui (Button, Input, Dialog…)
├── features/            # Módulos por dominio
│   ├── audit/           # Tabla y hook de auditoría
│   ├── company-users/   # Usuarios de una organización
│   ├── companies/       # Listado de organizaciones (vista admin)
│   ├── dashboard/       # Dashboards de admin y de organización
│   ├── doc-governance/  # Tipos de documentos (tipologías)
│   ├── notifications/   # Campana SSE + listado
│   ├── org-structure/   # Estructura org (departamentos, áreas, cargos)
│   ├── profile/         # Perfil de usuario, context-switcher
│   ├── roles/           # Roles y permisos
│   └── workflows/       # Flujos de aprobación de documentos
├── hooks/               # Hooks compartidos
├── i18n/
│   └── locales/         # Archivos de traducción (en.json, es.json)
├── lib/
│   ├── api/             # Módulos de cliente HTTP por dominio
│   └── …                # Utilidades (formatters, jwt, validations…)
├── mocks/               # Handlers MSW para desarrollo
│   └── handlers/
├── routes/              # Rutas file-based de TanStack Router
│   └── dashboard/
├── store/               # Stores Zustand (authStore…)
├── types/               # Tipos TypeScript compartidos
├── instrument.ts        # Inicialización de Sentry (se importa primero en main.tsx)
└── main.tsx             # Entry point
```

Cada carpeta de feature sigue la convención:

```text
features/<dominio>/
  components/   # Componentes React del dominio
  hooks/        # Hooks de datos/lógica del dominio
  …
```

## Flujo de autenticación

### Login y resolución de contexto

```
Usuario                  Frontend                    Backend
  |                         |                            |
  |--- credenciales ------->|                            |
  |                         |-- POST /auth/login ------->|
  |                         |<-- { accessToken (global) }|
  |                         |                            |
  |                         | [decode JWT]               |
  |                         | ¿tiene companyId?          |
  |                         |-- POST /auth/me/companies->|
  |                         |<-- [orgIds]                |
  |                         |                            |
  |                         | si orgIds.length === 1:    |
  |                         |-- POST /auth/switch-company|
  |                         |<-- { accessToken (scoped) }|
  |                         |                            |
  |                         | redirect /dashboard        |
  |<--- sesión activa ------|                            |
```

El `accessToken` con `companyId` es el token de trabajo. El token global (sin `companyId`) solo se usa como paso intermedio durante el login o para el flujo de super-admin.

### Silent refresh (renovación silenciosa)

El `accessToken` expira. El `refreshToken` viaja solo en una cookie `httpOnly` — el JS nunca puede leerlo.

```
Frontend                    Backend
  |                            |
  |-- GET /cualquier-endpoint->| → 401 Unauthorized
  |                            |
  | [interceptor en client.ts] |
  | (otras peticiones en cola) |
  |-- POST /auth/refresh ------>|  (cookie httpOnly enviada automáticamente)
  |<-- { accessToken nuevo }   |
  |                            |
  | [si token sin companyId y  |
  |  user.companyId existe]    |
  |-- POST /auth/switch-company|  (restaura el token de empresa)
  |<-- { accessToken scoped }  |
  |                            |
  | [vaciar cola con token nuevo]
  |-- peticiones reintentadas->|
```

Las peticiones concurrentes que lleguen mientras el refresh está en curso se encolan en `pendingQueue` y se reintentan con el nuevo token una vez obtenido. Si el refresh falla, se limpia la sesión y se redirige a `/login`.

### Flujo super-admin ↔ empresa

Un super-admin puede entrar al contexto de una empresa y volver al contexto global:

```
Estado global              Estado empresa
(sin companyId)            (con companyId)
       |                          |
       |-- enterCompany() ------->|
       |   POST /auth/switch-company
       |   token global guardado en _superAdminToken (memoria)
       |                          |
       |                     [trabaja en empresa]
       |                          |
       |<-- exitCompany() --------|
       |   1. ¿_superAdminToken válido en memoria? → usarlo directamente
       |   2. si no: POST /auth/exit-company
       |      (cookie httpOnly de la empresa enviada automáticamente)
       |      servidor recupera el refresh token global y emite nuevo par
       |
       | [tras logout o recarga de página el token de memoria se pierde;
       |  hasSuperAdminContext:true en localStorage dispara el paso 2]
```

Ficheros clave: `src/store/authStore.ts` (`enterCompany`, `exitCompany`), `src/lib/api/client.ts` (safety net en el interceptor de 401).

### Notificaciones SSE con ticket de un solo uso

Las notificaciones en tiempo real usan Server-Sent Events. El JWT no puede enviarse en la URL (quedaría en logs de proxy y acceso del servidor), así que se usa un ticket efímero:

```
Frontend                    Backend
  |                            |
  |-- POST /notifications/     |
  |        stream/ticket ------>|  (Authorization: Bearer <JWT> en header)
  |<-- { ticket, expiresIn }   |  (ticket válido ~30 s, un solo uso)
  |                            |
  |-- GET /notifications/      |
  |        stream?ticket=xxx -->|  (sin header de auth — el ticket lo sustituye)
  |<===== SSE stream ===========|
  |                            |
  | [evento "notification"]    |
  | invalidateQueries(['notifications-list'])
  |
  | [error / reconexión]
  | backoff exponencial (1 s → 30 s máx)
  | nuevo ticket → nueva conexión SSE
```

Fichero clave: `src/features/notifications/hooks/use-notifications.ts`.

## Decisiones de arquitectura

### Organización feature-based

Cada dominio de negocio (`company-users`, `workflows`, `roles`…) agrupa sus propios componentes, hooks y tipos bajo `src/features/<dominio>/`. Esta estructura evita que un cambio en un dominio obligue a tocar carpetas globales y facilita entender el alcance de una modificación leyendo solo la carpeta relevante.

Los elementos verdaderamente transversales (primitivos UI, cliente HTTP, store de auth) viven en `src/components/ui/`, `src/lib/` y `src/store/` respectivamente.

### Seguridad de tokens y XSS

| Dato                          | Dónde vive                       | Por qué                                                               |
| ----------------------------- | -------------------------------- | --------------------------------------------------------------------- |
| `accessToken`                 | Memoria (Zustand, no persistido) | Un payload XSS no puede robarlo con `localStorage.getItem()`          |
| `refreshToken`                | Cookie `httpOnly`                | Inaccesible para JavaScript; el browser la envía automáticamente      |
| Datos de sesión (user, flags) | `localStorage` (`sgd-auth`)      | Necesarios para hidratar el estado tras recargar; no contienen tokens |

### Sistema de permisos

Los permisos son verificados en el cliente (**UI gating**) a través de `useMyPermissions`, que cruza las asignaciones de rol del usuario (`/users/me/org-roles`) con los permisos de cada rol (`/roles`). Esto controla la visibilidad de tabs y botones.

**El backend aplica su propia validación en cada endpoint** — el UI gating es solo una capa de UX, no la barrera de seguridad definitiva.

## Convenciones

- **Componentes**: PascalCase, un componente por archivo
- **Hooks**: `use-kebab-case.ts`
- **i18n**: todas las cadenas visibles pasan por `t()` de react-i18next
- **Colores de marca**: usar `bg-brand`, `text-brand`, `border-brand-border` (tokens CSS definidos en `src/index.css`) en lugar de hex hardcodeados
- **API calls**: siempre a través de los módulos en `src/lib/api/`, nunca `fetch`/`axios` directo en componentes

## Despliegue

El frontend se despliega en **Vercel**. El archivo `vercel.json` configura:

- Headers de seguridad (`CSP`, `X-Frame-Options`, etc.)
- Proxy server-side `/api/*` → `${RAILWAY_API_URL}/api/*` (evita CORS en producción)
- SPA fallback: todas las rutas no encontradas sirven `index.html`

La variable `RAILWAY_API_URL` se configura en el dashboard de Vercel (no en `.env`).
