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
| `CRON_SECRET` | Secreto que autentica al cron de Supabase contra `/api/paquetes/sincronizar` (`openssl rand -hex 32`) |
| `VITE_API_URL` | URL base de la API (ej. `https://packen.vercel.app`) |

## Rutas y Endpoints Principales

No hay `/health`: era del Express viejo, que ya no existe. El diagnóstico de la API es simplemente que responda cualquiera de estas rutas (todas requieren `Authorization: Bearer <token>` salvo login/registro y el webhook de ML).

* **Login / registro / refresh / logout:** `POST /api/auth/login`, `/registro`, `/refresh`, `/logout`
* **Listar / escanear / cambiar estado / reasignar / simular entregas paquetes:** `GET /api/paquetes`, `POST /api/paquetes/escanear`, `.../cambiar-estado`, `.../reasignar`, `.../simular-entregas`
* **Sellers / Transportistas:** `GET|POST|DELETE /api/sellers`, `/api/transportistas`
* **Listas de precios / costos:** `GET|POST|DELETE /api/precios`, `/api/costos`
* **Liquidaciones:** `GET /api/liquidaciones` (transportistas + últimas 5), `POST /api/liquidaciones` (crear), `GET /api/liquidaciones?ids=...` (descargar el .xlsx)
* **Conectar seller con Mercado Libre:** `GET /api/ml/conectar` (arranca el OAuth; el callback es `/api/ml/callback`)
* **Consultar envío ML:** `GET /api/envios/:shipmentId?sellerId=...`
* **Webhook de Mercado Libre (público):** `POST /api/webhooks/mercadolibre`
* **Sincronizar estados con ML:** `POST /api/paquetes/sincronizar` (cron con header `x-cron-secret`, o una empresa con `Bearer` para forzarlo a mano)

## Sincronización de estados con Mercado Libre

El estado de un paquete se actualiza solo cuando cambia en ML, por dos caminos que comparten la misma política (`decidirEstadoDesdeML` en `api/_lib/ml.js`):

1. **Webhook** (`/api/webhooks/mercadolibre`) — ML notifica y el paquete se actualiza en segundos. Requiere tener la app de ML suscrita al topic `shipments` con esa URL de callback, en el DevCenter de Mercado Libre.
2. **Sync periódico** (`/api/paquetes/sincronizar`) — cada 15 minutos recorre los paquetes abiertos y le pregunta a ML el estado real. Es la red de contención: recupera toda notificación que se haya perdido.

Solo tres estados de ML pisan el nuestro, porque son hechos del envío: `delivered` → **Entregado**, `cancelled` → **Cancelado**, `not_delivered` → **Reprogramado**. Los demás (`pending`, `handling`, `ready_to_ship`, `shipped`) se ignoran a propósito: *Ingresado* y *En camino* los define el escaneo del transportista, que en Flex va adelante de lo que ML sabe. *Entregado* y *Cancelado* son terminales y no se reescriben.

Puesta en marcha, **en este orden**:

1. Correr `backend/scripts/migration-sync-ml.sql` en Supabase (agrega `estadoml`, `subestadoml`, `ml_sincronizado_en`). Va primero: sin esas columnas cada update falla.
2. Configurar `CRON_SECRET` en Vercel y desplegar.
3. Correr `backend/scripts/cron-sincronizar-ml.sql` en Supabase, con el mismo secreto.

> El cron vive en Supabase (`pg_cron` + `pg_net`) y no en `vercel.json` porque el plan Hobby de Vercel solo permite una ejecución diaria de un cron job.

## Liquidaciones

Lo que la empresa le paga a cada transportista. Se elige uno o varios transportistas y un rango de fechas, y se liquidan los paquetes **entregados** en ese período: el importe de cada uno sale de la lista de costos del transportista (`usuario.idlista_costo`) cruzada con la zona del paquete. Un transportista sin lista asignada no se puede liquidar, porque no habría con qué calcular.

El detalle se guarda congelado en `liquidacion_detalle` (dirección, seller, zona e importe) en vez de recalcularse al descargar: las tarifas y las zonas cambian con el tiempo, y una liquidación vieja tiene que poder reimprimirse igual que el día que se emitió.

El `.xlsx` lo arma `api/_lib/xlsx.js`, un generador mínimo de OOXML sin dependencias (una hoja por transportista). El rango usa el huso de Argentina, no UTC: un paquete entregado 21:30 del último día del período es 00:30 del día siguiente en UTC y se caía al período que viene.

Antes de usar la pantalla hay que correr `backend/scripts/migration-liquidaciones.sql` en Supabase.

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
