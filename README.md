# SGD Frontend — Sistema de Gestión Documental

Frontend web del sistema de gestión documental de Helisa S.A.S, construido con React 19, TypeScript y Vite.

## Stack

| Categoría           | Librería                                         |
| ------------------- | ------------------------------------------------ |
| Framework           | React 19 + TypeScript                            |
| Build               | Vite 7                                           |
| Routing             | TanStack Router (file-based)                     |
| Data fetching       | TanStack Query + `@tanstack/react-virtual`       |
| UI                  | shadcn/ui + Tailwind CSS v4                      |
| Estado global       | Zustand                                          |
| i18n                | i18next (es/en)                                  |
| Formularios         | React Hook Form + Zod                            |
| Excel               | ExcelJS (export de auditoría y plantillas)       |
| Tests unitarios     | Vitest + Testing Library                         |
| Tests E2E           | Playwright + Argos CI (visual) + axe-core (a11y) |
| Mocks de desarrollo | MSW v2                                           |
| Documentación UI    | Storybook                                        |
| Observabilidad      | Sentry (opcional, requiere `VITE_SENTRY_DSN`)    |
| Git hooks           | Husky + lint-staged                              |

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
npm run e2e:build    # Build previo a los tests E2E en CI
npm run e2e:report   # Abrir el último reporte de Playwright

npm run storybook        # Servidor de Storybook en puerto 6006
npm run storybook:build  # Build estático de Storybook
```

## Arquitectura de carpetas

```text
src/
├── assets/              # Imágenes, SVGs estáticos
├── components/
│   └── ui/              # Primitivos shadcn/ui (Button, Input, Dialog…)
├── features/            # Módulos por dominio
│   ├── audit/           # Tabla, filtros y exportación Excel de auditoría
│   ├── company-users/   # Usuarios de una organización
│   ├── companies/       # Listado de organizaciones (vista admin)
│   ├── dashboard/       # Dashboards de admin y de organización
│   ├── doc-governance/  # Tipos de documentos (tipologías)
│   ├── notifications/   # Campana SSE + listado
│   ├── org-structure/   # Estructura org (departamentos, áreas, cargos)
│   ├── profile/         # Perfil de usuario, context-switcher
│   ├── roles/           # Roles y permisos
│   ├── users/           # Gestión global de usuarios (vista admin)
│   └── workflows/       # Flujos de aprobación de documentos
├── hooks/               # Hooks compartidos
├── i18n/
│   └── locales/         # Archivos de traducción (en.json, es.json)
├── lib/
│   ├── api/             # Módulos de cliente HTTP por dominio
│   ├── constants/       # Constantes compartidas
│   ├── utils/           # Funciones de utilidad
│   ├── validations/     # Esquemas Zod reutilizables
│   ├── formatters.ts    # Formateadores de fecha, números, etc.
│   ├── jwt.ts           # Decodificación de JWT (URL-safe base64)
│   ├── login-throttle.ts # Protección contra fuerza bruta (ver sección)
│   ├── use-idle-timeout.ts # Auto-logout por inactividad (ver sección)
│   └── utils.ts         # cn() y otras utilidades CSS
├── mocks/               # Handlers MSW para desarrollo
│   └── handlers/
├── routes/              # Rutas file-based de TanStack Router
│   ├── __root.tsx       # Layout raíz (providers, guards globales)
│   ├── index.tsx        # Redirección inicial
│   ├── login.tsx
│   ├── forgot-password.tsx
│   ├── reset-password.tsx
│   ├── complete-registration.tsx  # Flujo de invitación (token de registro)
│   └── dashboard/
│       ├── index.tsx    # Dashboard de organización
│       └── admin.tsx    # Dashboard de super-admin
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

```text
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

```text
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

```text
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

### Flujo de invitación (complete-registration)

Cuando un administrador invita a un usuario, el backend emite un token de registro por email con TTL corto. El usuario aterriza en `/complete-registration?token=<uuid>` donde establece su contraseña y activa la cuenta.

### Notificaciones SSE con ticket de un solo uso

Las notificaciones en tiempo real usan Server-Sent Events. El JWT no puede enviarse en la URL (quedaría en logs de proxy y acceso del servidor), así que se usa un ticket efímero:

```text
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

### Protección contra fuerza bruta (`login-throttle.ts`)

El formulario de login lleva su propio contador de intentos fallidos en `sessionStorage` con fallback en memoria (para modo privado o cuando el storage no está disponible):

- **WARN_THRESHOLD = 3**: a partir del tercer intento fallido se muestra un aviso visible.
- **FAIL_LOCK_THRESHOLD = 5**: al quinto intento consecutivo se bloquea el formulario 30 segundos.
- El estado se saneea al leer de storage: tipos inválidos, valores negativos e `Infinity` se colapsan a cero para evitar manipulación externa.
- `trackSuccess()` solo se llama cuando el login completó íntegramente (JWT válido decodificado + navegación exitosa), no en el primer 2xx de la respuesta.

### Auto-logout por inactividad (`use-idle-timeout.ts`)

Si el usuario no interactúa durante un período configurable, el hook dispara un logout silencioso. La señal se propaga a otras pestañas abiertas a través de `BroadcastChannel('sgd-session')`. Los mensajes del canal se validan estructuralmente antes de procesarlos.

## Cliente HTTP (`src/lib/api/client.ts`)

### CSRF — Double-Submit Cookie

El backend protege todos los endpoints de escritura con el patrón **Double-Submit Cookie**:

1. Al hacer login, el backend devuelve `{ accessToken, csrfToken }`. El `csrfToken` se guarda en tres capas para sobrevivir recargas y modos de navegación distintos:

   ```
   Prioridad  Dónde                   Cuándo se usa
   ──────────────────────────────────────────────────────────
   1ª         Memoria (_csrfToken)    Petición normal sin recarga
   2ª         sessionStorage          Misma pestaña tras recargar
   3ª         Cookie sgd_csrf_token   Fallback si sessionStorage falla
   ```

2. En cada request `POST / PUT / PATCH / DELETE` autenticado el interceptor lee `getCsrfToken()` y lo adjunta como header `x-csrf-token`. El backend compara el header con la cookie — un atacante cross-origin puede disparar la cookie pero no puede leer ni inyectar el header.

3. **Limpieza de cookie legada**: al cargar el módulo se expira el cookie `sgd_csrf_token` con `path=/api/v1/auth`. Versiones anteriores del backend lo emitían con esa ruta más específica; el browser lo enviaba junto al nuevo cookie de `path=/`, provocando un `401 Invalid CSRF token`. El `max-age=0` elimina el cookie viejo sin afectar el nuevo.

### Retry de red (no de HTTP)

```
axiosRetry → retries: 3, exponential backoff
retryCondition: solo axiosRetry.isNetworkError()
```

Los errores HTTP 5xx **no se reintentan** a nivel de Axios intencionalmente. React Query está configurado con `retry: 1` global — si Axios también reintentara los 5xx, una sola query fallida dispararía hasta 8 intentos y el usuario tardaría 2+ minutos en ver el error cuando el backend está lento pero alcanzable.

Los errores de red puros (ECONNRESET, DNS, timeout de conexión antes del `response`) sí se reintentan porque no llegan a React Query.

### Cola de peticiones concurrentes durante el refresh

Cuando el interceptor de 401 inicia un refresh, las peticiones que llegan mientras el refresh está en vuelo no se descartan — se encolan en `pendingQueue`. Cuando el refresh completa, todas se reintentan con el nuevo `accessToken`.

```
Petición A  ──► 401 ──► inicia refresh ──────────────────► reintenta A
Petición B  ──► 401 ──► entra en cola ──────────────────► reintenta B
Petición C  ──► 401 ──► entra en cola ──────────────────► reintenta C
                                │
                         POST /auth/refresh
                         POST /auth/switch-company (si aplica)
```

Si el refresh falla (cookie expirada, revocada), `clearAuth()` limpia la sesión y se redirige a `/login`.

### Safety net: cookie de login desactualizada

Si tras el refresh el `accessToken` no contiene `companyId` pero el store sí tiene `user.companyId`, el cliente hace automáticamente un `POST /auth/switch-company` antes de reintentar las peticiones. Esto ocurre cuando el usuario tenía una cookie de refresh del contexto global (emitida antes del primer `switch-company`) y recarga la página.

### Endpoints públicos vs. protegidos

Los endpoints de `PUBLIC_PATHS` (login, forgot-password, reset-password, complete-registration) no reciben header `Authorization`. Los de `SKIP_REFRESH_PATHS` no disparan el ciclo de refresh si reciben un 401 — evita bucles infinitos en `/auth/refresh` o `/auth/logout`.

---

## Desarrollo con MSW (`src/mocks/`)

[MSW v2](https://mswjs.io/) intercepta las peticiones de red a nivel de Service Worker, permitiendo desarrollar sin backend real.

### Activación

```bash
# .env
VITE_USE_MOCKS=true
```

Con esta variable activa, `main.tsx` arranca el Service Worker antes de montar la app:

```ts
if (import.meta.env.VITE_USE_MOCKS === 'true') {
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}
```

`onUnhandledRequest: 'bypass'` significa que las peticiones que no tienen handler MSW pasan directamente al backend real. Esto permite activar los mocks para algunos dominios mientras se trabaja con endpoints reales en otros.

### Credenciales de prueba

Cuando `VITE_USE_MOCKS=true`, el formulario de login muestra un hint con las credenciales del mock:

| Campo    | Valor                  |
| -------- | ---------------------- |
| Email    | `admin@sgd.helisa.com` |
| Password | `admin123`             |

Estas credenciales están hardcodeadas en `src/mocks/handlers/auth.ts`. Cualquier otra combinación devuelve 401.

### Estructura de handlers

Un archivo por dominio, cada uno exporta un array nombrado:

```
src/mocks/
├── browser.ts          # Punto de entrada — compone todos los handlers
└── handlers/
    ├── auth.ts         # authHandlers       — login, logout, refresh, exit-company
    ├── users.ts        # usersHandlers      — CRUD usuarios, roles, permisos
    ├── companies.ts    # companiesHandlers  — organizaciones
    ├── roles.ts        # rolesHandlers      — roles y permisos
    ├── workflows.ts    # workflowsHandlers  — flujos de aprobación
    └── notifications.ts # notificationsHandlers — SSE ticket + listado
```

`browser.ts` los compone todos:

```ts
export const worker = setupWorker(
  ...authHandlers,
  ...usersHandlers,
  ...workflowsHandlers,
  ...rolesHandlers,
  ...companiesHandlers,
  ...notificationsHandlers,
);
```

### Agregar un handler nuevo

1. Localizar el archivo del dominio correspondiente en `src/mocks/handlers/`.
2. Añadir el handler con `http.get / http.post / …` de MSW v2.
3. Si es un dominio nuevo, crear `handlers/<dominio>.ts`, exportar el array y añadirlo en `browser.ts`.

```ts
// src/mocks/handlers/audit.ts
import { http, HttpResponse } from 'msw';

export const auditHandlers = [
  http.get('*/audit/logs', () => HttpResponse.json({ data: [], total: 0 })),
];
```

### MSW en tests unitarios

Los tests unitarios **no usan `browser.ts`** — cada archivo de test crea su propio servidor con `setupServer` de `msw/node` y define los handlers que necesita con `server.use()`. El `afterEach(() => server.resetHandlers())` restaura los handlers base entre tests.

### Build de producción

El Vite plugin personalizado en `vite.config.ts` elimina `mockServiceWorker.js` del bundle de producción, independientemente del valor de `VITE_USE_MOCKS`. Los mocks nunca llegan al usuario final.

---

## Storybook (`.storybook/`)

[Storybook](https://storybook.js.org/) permite desarrollar y documentar componentes de forma aislada, sin necesitar la app completa.

```bash
npm run storybook        # servidor en http://localhost:6006
npm run storybook:build  # build estático en storybook-static/
```

### Convención de archivos

Las stories se colocan **junto al componente** que documentan:

```
src/components/ui/
├── button.tsx
└── button.stories.tsx   ← story del mismo componente
```

El glob `src/**/*.stories.@(ts|tsx)` recoge automáticamente cualquier archivo con esa extensión en cualquier subcarpeta de `src/`.

### Escribir una story

```tsx
// src/components/ui/button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  component: Button,
  tags: ['autodocs'], // genera página de docs automática
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: 'Guardar', variant: 'default' },
};

export const Destructive: Story = {
  args: { children: 'Eliminar', variant: 'destructive' },
};
```

### Lo que viene preconfigurado

| Feature             | Detalle                                                                                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Tailwind CSS v4** | Los estilos de `index.css` se importan en `preview.tsx` — los tokens `brand-*` y el tema funcionan igual que en la app                   |
| **Modo oscuro**     | El decorator `DarkModeDecorator` pone/quita la clase `.dark` en `<html>` al cambiar el fondo en la toolbar — sin configuración adicional |
| **i18n**            | `src/i18n` se importa en `preview.tsx`, por lo que `useTranslation()` funciona en cualquier componente                                   |
| **Alias `@/`**      | Resuelto a `src/` — los imports de la app funcionan sin cambios en las stories                                                           |
| **Autodocs**        | Activado con `tag` — solo genera docs automáticas en las stories que incluyan `tags: ['autodocs']`                                       |

### Plugins excluidos en Storybook

`viteFinal` en `main.ts` elimina dos plugins del Vite config de la app antes de pasarlo a Storybook:

- `tanstack-router-vite-plugin` — el enrutado file-based no tiene sentido en historias aisladas; incluirlo causa errores de compilación buscando archivos de ruta inexistentes
- `sonner-no-inject-css` — workaround CSP para los toasts, innecesario en el entorno de Storybook

---

## Auth Store (`src/store/authStore.ts`)

### Shape del store

| Campo                  | Tipo               | Dónde vive                  | Notas                                                                                                                              |
| ---------------------- | ------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `user`                 | `AuthUser \| null` | `localStorage` (`sgd-auth`) | Se hidrata al cargar; incluye `companyId` / `companyName` cuando hay contexto de empresa                                           |
| `accessToken`          | `string \| null`   | **Memoria** (Zustand)       | Siempre `null` al iniciar — lo rellena el login o el silent refresh. Nunca se escribe en storage                                   |
| `isAuthenticated`      | `boolean`          | `localStorage`              | Permite mostrar UI autenticada antes del primer refresh                                                                            |
| `isSuperAdmin`         | `boolean`          | `localStorage`              | Se actualiza al decodificar cada token nuevo (puede cambiar con `updateAccessToken`)                                               |
| `hasSuperAdminContext` | `boolean`          | `localStorage`              | `true` cuando el super-admin está dentro de una empresa. Sobrevive recargas para disparar el path de recuperación en `exitCompany` |

Adicionalmente existe `_superAdminToken` — una **variable de módulo** (fuera del estado Zustand) que guarda el access token global del super-admin durante la sesión de pestaña. Se pierde al recargar la página.

### Hidratación al iniciar

Al importar el módulo, `hydrate()` lee `localStorage` y repuebla `user`, `isAuthenticated`, `isSuperAdmin` y `hasSuperAdminContext`. **`accessToken` siempre arranca como `null`** — el silent refresh del primer request autenticado lo rellena usando la cookie httpOnly de refresh.

### Métodos

**`setAuth(user, accessToken, isSuperAdmin)`** — login completo. Persiste el usuario en `localStorage`. Si es super-admin en contexto global (sin `companyId`), guarda el token en `_superAdminToken`.

**`updateAccessToken(accessToken)`** — llamado por el interceptor de 401 de `client.ts` tras un refresh exitoso. Decodifica el token para actualizar `isSuperAdmin` en storage y, si el usuario sigue siendo super-admin en contexto global, actualiza también `_superAdminToken`.

**`clearAuth()`** — logout. Borra `sgd-auth` y `sgd-companies-cache` de `localStorage`, nulifica `_superAdminToken` y llama a `Sentry.setUser(null)`.

**`enterCompany(companyId, companyName, companyToken)`** — switch a contexto de empresa. Guarda el token actual en `_superAdminToken` (solo si `wasAdmin` era true — usuarios regulares que cambian de empresa no deben contaminar esta variable). Activa `hasSuperAdminContext: true` para que la UI muestre el botón de volver.

**`exitCompany()`** — restaura el contexto global. Devuelve `Promise<boolean>` (`false` si la restauración falla). Sigue dos estrategias en orden:

```
1. ¿_superAdminToken en memoria y no expirado?
   └─► usarlo directamente (fast path, sin red)

2. Si no:
   └─► POST /auth/exit-company
       (cookie httpOnly de empresa enviada automáticamente)
       (header x-csrf-token desde sessionStorage o cookie legible)
       └─► server devuelve nuevo accessToken global
```

Antes de aplicar el token devuelto, `exitCompany` lo valida: debe ser token de super-admin (`isSuperAdmin: true`) sin `companyId`. Si la validación falla, devuelve `false` y el caller puede mostrar un error recuperable.

### Sentry

`setUser()` se llama en `setAuth` y `enterCompany` con `{ id, email, companyId }`. `setUser(null)` se llama en `clearAuth`. Esto asocia los errores de Sentry al usuario autenticado sin exponer el access token.

---

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

## CI/CD

Hay dos workflows en `.github/workflows/`:

| Archivo      | Disparador                       | Propósito                         |
| ------------ | -------------------------------- | --------------------------------- |
| `ci.yml`     | PR hacia `dev`, `test`, `master` | Valida el código antes del merge  |
| `deploy.yml` | Push a `dev`, `test`, `master`   | Despliega en Vercel tras el merge |

### `ci.yml` — validación en PRs

Los jobs corren en este orden:

```
┌─────────────────────────────────────────────────────────────┐
│  job: ci                                                    │
│  Typecheck → Lint → Build → Unit tests                      │
└───────────────────────────────┬─────────────────────────────┘
                                │ needs: ci
                                ▼
┌─────────────────────────────────────────────────────────────┐
│  job: e2e                                                   │
│  Install Playwright → Run E2E → Upload report (si falla)   │
└─────────────────────────────────────────────────────────────┘
```

**Build en CI** usa variables fijas:

```
VITE_API_URL=/api/v1     # URL relativa — el proxy de Vercel gestiona el destino real
VITE_USE_MOCKS=false     # MSW desactivado para que el build sea idéntico a producción
```

**E2E en CI** — no necesita backend real. Todas las llamadas de red son interceptadas por `page.route()` de Playwright. `VITE_USE_MOCKS=false` igualmente, porque `page.route()` trabaja a nivel de red del browser de prueba, sin MSW.

**Visual regression (Argos CI)** — opcional. Si el secret `ARGOS_TOKEN` está configurado en el repositorio, cada PR sube capturas de pantalla a Argos CI y compara contra el baseline de `master`. La primera ejecución establece el baseline; las siguientes generan un diff visual en el PR.

El reporte de Playwright se sube como artefacto (retención 7 días) únicamente cuando el job `e2e` falla — no en ejecuciones exitosas para no consumir storage de Actions innecesariamente.

### `deploy.yml` — despliegue en Vercel

Se dispara en push a las ramas de integración (tras merge del PR). Mapeo de rama a entorno:

| Rama     | GitHub Environment | Vercel flag    |
| -------- | ------------------ | -------------- |
| `dev`    | `dev`              | `--` (preview) |
| `test`   | `test`             | `--` (preview) |
| `master` | `production`       | `--prod`       |

El deploy a `production` usa un [GitHub Environment](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment) que puede requerir aprobación manual — configurar en **repo → Settings → Environments → production**.

**Inyección de `RAILWAY_API_URL`**: la URL del backend no es una variable de Vite sino la URL de destino del proxy en `vercel.json`. El workflow la sustituye en tiempo de deploy con `jq`:

```bash
# Antes del deploy, vercel.json contiene:
#   "dest": "${RAILWAY_API_URL}/api/$1"
# El workflow lo reemplaza con el valor real del Environment variable RAILWAY_API_URL:
jq --arg url "$RAILWAY_API_URL" \
  '(.routes[] | select(.src == "/api/(.*)") | .dest) |= gsub("\\$\\{RAILWAY_API_URL\\}"; $url)' \
  vercel.json > vercel.tmp.json && mv vercel.tmp.json vercel.json
```

`RAILWAY_API_URL` es una **variable de entorno** de GitHub (no secret) — va en **repo → Settings → Environments → `<env>` → Variables**.

### Secrets requeridos

| Secret / Variable   | Tipo                     | Dónde configurar        |
| ------------------- | ------------------------ | ----------------------- |
| `VERCEL_ORG_ID`     | Secret                   | Repositorio             |
| `VERCEL_PROJECT_ID` | Secret                   | Repositorio             |
| `VERCEL_TOKEN`      | Secret                   | Repositorio             |
| `RAILWAY_API_URL`   | **Variable** (no secret) | Cada GitHub Environment |
| `ARGOS_TOKEN`       | Secret (opcional)        | Repositorio             |

---

## Despliegue

El frontend se despliega en **Vercel**. El archivo `vercel.json` configura:

- Headers de seguridad (`CSP`, `X-Frame-Options`, etc.)
- Proxy server-side `/api/*` → `${RAILWAY_API_URL}/api/*` (evita CORS en producción)
- SPA fallback: todas las rutas no encontradas sirven `index.html`

La variable `RAILWAY_API_URL` se configura en el dashboard de Vercel (no en `.env`).
