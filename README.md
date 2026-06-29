# PacKen — Monorepo

Sistema de gestión logística (envíos Flex). El proyecto está dividido en **frontend** (React) y **backend** (API Node/Express).

## Estructura

```text
PacKen/
├── frontend/     # React + Vite + Tailwind
├── backend/      # API Express (Mercado Libre, Microsoft SQL Server)
├── package.json  # npm workspaces
└── README.md

```

## Requisitos

* Node.js 20+

## Configuración

1. Instalar dependencias desde la raíz:

```bash
npm install

```

2. Copiar variables de entorno del backend:

```bash
cp backend/.env.example backend/.env

```

Completar en `backend/.env`:

| Variable | Descripción |
| --- | --- |
| `ML_CLIENT_ID` | App de Mercado Libre |
| `ML_CLIENT_SECRET` | Secreto de la app (solo servidor) |
| `DATABASE_URL` | Connection string de Microsoft SQL Server |
| `FRONTEND_URL` | Origen del front para CORS (ej. `https://tu-dominio-en-vercel.vercel.app`) |

3. Frontend en producción con API en otro dominio:

Para que el frontend desplegado sepa a dónde hacer las peticiones, debes configurar esta variable:

```bash
# frontend/.env (o en el panel de variables de entorno de Vercel)
VITE_API_URL=[https://tu-api-backend.com](https://tu-api-backend.com)

```

En desarrollo no hace falta: Vite hace proxy de `/api` → `http://localhost:3001`.

## Desarrollo

Levantar front y back a la vez:

```bash
npm run dev

```

Por separado:

```bash
npm run dev:frontend   # http://localhost:5173
npm run dev:backend    # http://localhost:3001

```

* Health check: `GET http://localhost:3001/health`
* Listar paquetes: `GET /api/paquetes`
* Diagnóstico base de datos: `GET http://localhost:3001/health/db`
* Probar conexión en terminal: `node backend/scripts/test-db.mjs`
* Envío ML: `GET /api/envios/:shipmentId?sellerId=...`
* Registrar vendedor: `POST /api/vendedores` `{ "sellerId", "refreshToken" }`

## Despliegue en Vercel (Frontend)

El frontend está optimizado para desplegarse directamente en **Vercel**. El archivo `frontend/vercel.json` incluido en el proyecto ya maneja los `rewrites` para que el enrutamiento de la aplicación (React Router) funcione correctamente al recargar la página, redirigiendo el tráfico a `index.html`.

**Pasos de despliegue:**

1. Importa el repositorio desde tu cuenta de Vercel.
2. Configura el **Root Directory** seleccionando la carpeta `frontend`.
3. Vercel debería detectar automáticamente que el *Framework Preset* es **Vite**.
4. En la sección *Environment Variables* de Vercel, agrega la variable `VITE_API_URL` apuntando a la URL pública donde tengas alojado tu backend.
5. Haz clic en **Deploy**.

## Stack

* **Frontend:** React, Vite, Tailwind CSS
* **Backend:** Express, Microsoft SQL Server
* **Integraciones:** Mercado Libre API

## Equipo

ORT Promoción 2026 — Martín, Tobías y Tobias.

```

```
