# PacKen — Monorepo

Sistema de gestión logística (envíos Flex). El proyecto está dividido en **frontend** (React) y **backend** (API Node/Express).

## Estructura

```
PacKen/
├── frontend/     # React + Vite + Tailwind
├── backend/      # API Express (Mercado Libre, Supabase)
├── package.json  # npm workspaces
└── README.md
```

## Requisitos

- Node.js 20+

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
|----------|-------------|
| `ML_CLIENT_ID` | App de Mercado Libre |
| `ML_CLIENT_SECRET` | Secreto de la app (solo servidor) |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service role (nunca en el frontend) |
| `FRONTEND_URL` | Origen del front para CORS (ej. `http://localhost:5173`) |

3. (Opcional) Frontend en producción con API en otro dominio:

```bash
# frontend/.env
VITE_API_URL=https://tu-api.com
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

- Health check: `GET http://localhost:3001/health`
- Envío ML: `GET /api/envios/:shipmentId?sellerId=...`
- Registrar vendedor: `POST /api/vendedores` `{ "sellerId", "refreshToken" }`

## Stack

- **Frontend:** React, Vite, Tailwind CSS
- **Backend:** Express, Supabase (PostgreSQL)
- **Integraciones:** Mercado Libre API

## Equipo

ORT Promoción 2026 — Martín, Tobías y Tobias.
