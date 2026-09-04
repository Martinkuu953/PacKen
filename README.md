# PacKen — Monorepo

Sistema de gestión logística (envíos Flex). Todo corre en Vercel: el cliente React y la API como Serverless Functions dentro de `frontend/api`. La base es Supabase (Postgres).

**🔗 Enlace de Producción:** [https://packen.vercel.app](https://packen.vercel.app)

## Estructura

```text
PacKen/
├── frontend/
│   ├── src/       # React + Vite + Tailwind
│   ├── api/       # Serverless Functions (la API que corre en producción)
│   ├── shared/    # Código común entre src/ y api/ (estados de paquete)
│   └── middleware.js  # Edge Middleware: autentica todo /api/* por defecto
├── backend/
│   └── scripts/   # Migraciones SQL y utilidades de línea de comandos
├── package.json   # npm workspaces
└── README.md

```

## Configuración de Entorno (Vercel)

Las siguientes variables de entorno deben estar configuradas en el panel de Vercel (sección *Environment Variables*) para que el despliegue integrado funcione correctamente:

| Variable | Descripción |
| --- | --- |
| `ML_CLIENT_ID` | App de Mercado Libre |
| `ML_CLIENT_SECRET` | Secreto de la app (solo servidor) |
| `SUPABASE_URL` | URL del proyecto de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (solo servidor; bypasea RLS) |
| `JWT_SECRET` | Secreto de firma de los JWT (mínimo 32 caracteres) |
| `DATABASE_URL` | Connection string de Postgres, solo para los scripts de `backend/scripts` |
| `VITE_API_URL` | URL base de la API (ej. `https://packen.vercel.app`) |

## Rutas y Endpoints Principales

No hay `/health`: era del Express viejo, que ya no existe. El diagnóstico de la API es simplemente que responda cualquiera de estas rutas (todas requieren `Authorization: Bearer <token>` salvo login/registro y el webhook de ML).

* **Login / registro / refresh / logout:** `POST /api/auth/login`, `/registro`, `/refresh`, `/logout`
* **Listar / escanear / cambiar estado / reasignar / simular entregas paquetes:** `GET /api/paquetes`, `POST /api/paquetes/escanear`, `.../cambiar-estado`, `.../reasignar`, `.../simular-entregas`
* **Sellers / Transportistas:** `GET|POST|DELETE /api/sellers`, `/api/transportistas`
* **Listas de precios / costos:** `GET|POST|DELETE /api/precios`, `/api/costos`
* **Conectar seller con Mercado Libre:** `GET /api/ml/conectar` (arranca el OAuth; el callback es `/api/ml/callback`)
* **Consultar envío ML:** `GET /api/envios/:shipmentId?sellerId=...`
* **Webhook de Mercado Libre (público):** `POST /api/webhooks/mercadolibre`

## Despliegue

Todo el ecosistema (tanto el cliente como la API) funciona mediante los despliegues de **Vercel**. El enrutamiento de la aplicación cliente está gestionado por la configuración en `frontend/vercel.json`, que asegura que las rutas internas de React funcionen redirigiendo el tráfico a `index.html`.

Cada vez que se realiza un push al repositorio, Vercel empaqueta el cliente con Vite y publica cada archivo de `frontend/api` como Serverless Function.

> El plan Hobby de Vercel permite 12 Serverless Functions. Por eso varias rutas se agrupan en dispatchers (`/api/auth/[action]`, `/api/paquetes/[action]`, `/api/ml/[action]`) en vez de tener un archivo por endpoint.

`backend/` ya no contiene un servidor: solo quedan las migraciones SQL y scripts de línea de comandos que se corren a mano.

## Stack Tecnológico

* **Frontend:** React, Vite, Tailwind CSS
* **Backend:** Vercel Serverless Functions, Supabase (Postgres)
* **Integraciones:** Mercado Libre API

## Equipo

ORT Promoción 2026 — Martín, Tobías y Tobias.

```

```
