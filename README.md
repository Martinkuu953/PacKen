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
* **Recalcular la zona de paquetes ya cargados:** `POST /api/paquetes/rezonificar` (simula; `{"aplicar":true}` escribe)
* **Sellers / Transportistas:** `GET|POST|DELETE /api/sellers`, `/api/transportistas`
* **Listas de precios / costos:** `GET|POST|DELETE /api/precios`, `/api/costos`
* **Liquidaciones:** `GET /api/liquidaciones` (transportistas liquidables), `GET /api/liquidaciones?transportistaIds=...` (+ las últimas 5 de cada uno), `POST /api/liquidaciones` (crear), `GET /api/liquidaciones?ids=...` (descargar el .xlsx), `GET /api/liquidaciones?ids=...&modo=separado` (un .zip con un .xlsx por liquidación), `GET /api/liquidaciones?ids=...&formato=json` (detalle para la vista previa)
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

## Rezonificar paquetes

La zona de un paquete se resuelve una sola vez, al escanearlo, con el mapeo barrio→zona vigente en ese momento. Si después se crean zonas o se reasignan barrios, los paquetes viejos siguen apuntando a la zona vieja. `POST /api/paquetes/rezonificar` los vuelve a resolver contra el mapeo actual: le pregunta el barrio a ML por cada `idenvioml` (hay que volver a preguntarlo porque el barrio no se guarda en `paquete`, solo queda el `idzona`).

Simula por defecto y devuelve qué cambiaría; recién con `{"aplicar": true}` escribe. Un barrio que no esté mapeado a ninguna zona **no** mueve el paquete: se reporta en `sinMapear` y el paquete queda como está. Mandarlo a `General` sería peor que no hacer nada, porque esa zona no puede tener tarifa —es la zona global, con `idempresa` NULL, y las listas solo siembran tarifas para las zonas de la empresa—, así que el paquete pasaría a liquidar en $0 sin avisar.

El orden correcto es: mapear los barrios en "Establecer zonas", después rezonificar, y por último cargar la tarifa de esas zonas en la lista de costos de cada transportista.

Rezonificar también completa `paquete.idarea` cuando falta, y de ahí sale el **partido** que lista la pantalla de Paquetes (`area_flex.nombre`: "Belgrano", "Villa Soldati"). Un paquete escaneado antes de que existiera esa columna no tiene barrio guardado y aparece con "—" hasta que se lo rezonifique.

## Liquidaciones

Lo que la empresa le paga a cada transportista. Se elige uno o varios transportistas y un rango de fechas, y se liquidan los paquetes **entregados** en ese período: el importe de cada uno sale de la lista de costos del transportista (`usuario.idlista_costo`) cruzada con la zona del paquete. Un transportista sin lista asignada no se puede liquidar, porque no habría con qué calcular.

El detalle se guarda congelado en `liquidacion_detalle` (dirección, seller, zona e importe) en vez de recalcularse al descargar: las tarifas y las zonas cambian con el tiempo, y una liquidación vieja tiene que poder reimprimirse igual que el día que se emitió.

El historial es **las últimas 5 de cada transportista**, no las últimas 5 de la empresa: con una flota de varios, las cinco últimas de toda la empresa podían ser todas del mismo. Por eso hay que elegir primero de quién se quiere ver (`?transportistaIds=`) y el panel arranca sin historial. Una liquidación cuyo transportista se dio de baja (`idtransportista` quedó NULL) no aparece en ningún historial: sigue en la base, pero ya no hay a quién elegir para llegar a ella.

El `.xlsx` lo arma `api/_lib/xlsx.js`, un generador mínimo de OOXML sin dependencias. Con varios transportistas se puede bajar todo en un libro (una hoja por transportista), un archivo por transportista dentro de un `.zip` (`&modo=separado`, para mandarle a cada uno el suyo sin que vea lo que cobran los demás) o solo la de uno. El `.zip` lo arma el mismo ZIP que envuelve al `.xlsx`, reusado: el navegador bloquea las descargas múltiples disparadas de a una. El rango usa el huso de Argentina, no UTC: un paquete entregado 21:30 del último día del período es 00:30 del día siguiente en UTC y se caía al período que viene.

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
