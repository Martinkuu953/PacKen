# PacKen — Monorepo

Sistema de gestión logística (envíos Flex). El proyecto está dividido en **frontend** (React) y **backend** (API Node/Express) y se encuentra alojado íntegramente en Vercel.

**🔗 Enlace de Producción:** [https://packen.vercel.app](https://packen.vercel.app)

## Estructura

```text
PacKen/
├── frontend/     # React + Vite + Tailwind
├── backend/      # API Express (Mercado Libre, Microsoft SQL Server)
├── package.json  # npm workspaces
└── README.md

```

## Configuración de Entorno (Vercel)

Las siguientes variables de entorno deben estar configuradas en el panel de Vercel (sección *Environment Variables*) para que el despliegue integrado funcione correctamente:

| Variable | Descripción |
| --- | --- |
| `ML_CLIENT_ID` | App de Mercado Libre |
| `ML_CLIENT_SECRET` | Secreto de la app (solo servidor) |
| `DATABASE_URL` | Connection string de Microsoft SQL Server |
| `VITE_API_URL` | URL base de la API (ej. `https://packen.vercel.app`) |

## Rutas y Endpoints Principales

Las consultas y validaciones se realizan directamente sobre el entorno de producción:

* **Health check:** `GET https://packen.vercel.app/health`
* **Listar paquetes:** `GET https://packen.vercel.app/api/paquetes`
* **Diagnóstico de base de datos:** `GET https://packen.vercel.app/health/db`
* **Consultar Envío ML:** `GET https://packen.vercel.app/api/envios/:shipmentId?sellerId=...`
* **Registrar vendedor:** `POST https://packen.vercel.app/api/vendedores` (Body: `{ "sellerId", "refreshToken" }`)

## Despliegue

Todo el ecosistema (tanto el cliente como la API) funciona mediante los despliegues de **Vercel**. El enrutamiento de la aplicación cliente está gestionado por la configuración en `frontend/vercel.json`, que asegura que las rutas internas de React funcionen redirigiendo el tráfico a `index.html`.

Cada vez que se realiza un push al repositorio, Vercel se encarga de empaquetar el frontend con Vite y levantar los endpoints del backend como Serverless Functions.

## Stack Tecnológico

* **Frontend:** React, Vite, Tailwind CSS
* **Backend:** Express, Microsoft SQL Server
* **Integraciones:** Mercado Libre API

## Equipo

ORT Promoción 2026 — Martín, Tobías y Tobias.

```

```
