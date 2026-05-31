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

```
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

```
features/<dominio>/
  components/   # Componentes React del dominio
  hooks/        # Hooks de datos/lógica del dominio
  …
```

## Flujo de autenticación

1. Login → `POST /auth/login` devuelve `accessToken` (JWT)
2. El refresh token viaja en cookie `httpOnly` (no visible en JS)
3. El interceptor de axios en `src/lib/api/client.ts` renueva el token automáticamente en 401
4. Para usuarios de empresa: tras el login se hace `POST /auth/switch-company` para obtener un token con `companyId`
5. El estado de sesión persiste en `localStorage` (clave `sgd-auth`) pero **el accessToken vive solo en memoria** (Zustand) para prevenir XSS

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
