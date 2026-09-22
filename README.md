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
* **Liquidaciones y facturas:** las dos rutas tienen exactamente la misma forma — `GET /api/liquidaciones` y `GET /api/facturas` (las contrapartes emitibles), `?contraparteIds=...` (+ las últimas 5 de cada una), `POST` (crear), `?ids=...` (descargar el .xlsx), `?ids=...&modo=separado` (un .zip con un archivo por documento), `?ids=...&formato=json` (detalle para la vista previa)
* **Conectar seller con Mercado Libre:** `GET /api/ml/conectar` (arranca el OAuth; el callback es `/api/ml/callback`)
* **Consultar envío ML:** `GET /api/envios/:shipmentId?sellerId=...`
* **Webhook de Mercado Libre (público):** `POST /api/webhooks/mercadolibre`
* **Sincronizar estados con ML:** `POST /api/paquetes/sincronizar` (cron con header `x-cron-secret`, o una empresa con `Bearer` para forzarlo a mano)

## Sincronización de estados con Mercado Libre

El estado de un paquete se actualiza cuando cambia en ML, por dos caminos que comparten la misma política (`decidirEstadoDesdeML` en `api/_lib/ml.js`):

1. **Webhook** (`/api/webhooks/mercadolibre`) — ML notifica y el paquete se actualiza en segundos. Requiere tener la app de ML suscrita al topic `shipments` con esa URL de callback, en el DevCenter de Mercado Libre.
2. **Sync periódico** (`/api/paquetes/sincronizar`) — cada 15 minutos recorre los paquetes abiertos y le pregunta a ML el estado real. Es la red de contención: recupera toda notificación que se haya perdido.

Solo tres estados de ML pisan el nuestro, porque son hechos del envío: `delivered` → **Entregado**, `cancelled` → **Cancelado**, `not_delivered` → **Reprogramado**. Los demás (`pending`, `handling`, `ready_to_ship`, `shipped`) se ignoran a propósito: *Ingresado* y *En camino* los define el escaneo del transportista, que en Flex va adelante de lo que ML sabe. *Entregado* y *Cancelado* son terminales y no se reescriben.

El **escaneo** es el tercer camino y usa la misma tabla de hechos, con `decidirEstadoDeEscaneo`:

| Al escanear en… | ML dice | Queda |
| --- | --- | --- |
| Colecta | cualquier cosa | Ingresado |
| Reparto | `delivered` | Entregado (con `fechaentrega`) |
| Reparto | `cancelled` | Cancelado |
| Reparto | `not_delivered` | Reprogramado |
| Reparto | `shipped`, `ready_to_ship`, `handling`, `pending` | En camino |
| Cualquiera | cualquier cosa, si el paquete ya está Entregado o Cancelado | como estaba |

La diferencia con el sync es el último caso de reparto: ahí el escaneo sí decide, porque ML todavía no sabe nada (el seller imprimió la etiqueta y nada más) y el paquete ya está físicamente en la camioneta. Cuando ML informa un hecho, ese hecho gana: marcar "En camino" un envío que ML ya dio por entregado o cancelado es inventar un viaje que no va a pasar. El escaneo también guarda `estadoml` / `subestadoml` / `ml_sincronizado_en`, igual que los otros dos caminos.

Un paquete terminal no se reabre por un re-escaneo, en ninguno de los dos tipos: es la misma regla `TERMINALES` del sync, y evita que un entregado vuelva a *Ingresado* (lo que además descuadraría la facturación, que se calcula sobre los entregados).

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

## Liquidaciones y facturas

Son el mismo documento mirado desde puntas opuestas, y por eso comparten todo el código:

| | Liquidación | Factura |
| --- | --- | --- |
| A quién | al **transportista** que entregó | al **seller** que despachó |
| Qué | se le **paga** | se le **cobra** |
| Con qué lista | de costos (`usuario.idlista_costo`) | de precios (`seller.idlista`) |
| Tablas | `liquidacion` / `liquidacion_detalle` | `factura` / `factura_detalle` |
| La otra punta, en el detalle | el seller | el transportista |

La diferencia entre las dos por un mismo paquete es lo que gana la empresa.

El flujo es idéntico: se eligen una o varias contrapartes y un rango de fechas, y se emiten los paquetes **entregados** en ese período. El importe de cada uno sale de la lista de esa contraparte cruzada con la zona del paquete —y la zona se resuelve *contra esa lista*, porque el mismo barrio puede caer en zonas distintas según con qué acuerdo se lo mire—. Una contraparte sin lista asignada no se puede emitir, porque no habría con qué calcular.

Todo el motor vive en `api/_lib/emision.js`; `api/liquidaciones/index.js` y `api/facturas/index.js` son dos líneas cada uno que le pasan su configuración (`TIPOS.liquidacion` / `TIPOS.factura`). En el cliente pasa lo mismo: `components/PanelEmision.jsx` es la pantalla, y `pages/Liquidaciones.jsx` y `pages/Facturas.jsx` solo aportan el vocabulario. Un cambio de comportamiento se hace una vez y vale para los dos.

El detalle se guarda congelado (dirección, la otra punta, zona e importe) en vez de recalcularse al descargar: las tarifas y las zonas cambian con el tiempo, y un documento viejo tiene que poder reimprimirse igual que el día que se emitió.

El historial es **los últimos 5 de cada contraparte**, no los últimos 5 de la empresa: con varias, los cinco últimos de toda la empresa podían ser todos de la misma. Por eso hay que elegir primero de quién se quiere ver (`?contraparteIds=`) y el panel arranca sin historial. Un documento cuya contraparte se dio de baja (el id quedó NULL) no aparece en ningún historial: sigue en la base, pero ya no hay a quién elegir para llegar a él.

El `.xlsx` lo arma `api/_lib/xlsx.js`, un generador mínimo de OOXML sin dependencias. Con varias contrapartes se puede bajar todo en un libro (una hoja por cada una), un archivo por contraparte dentro de un `.zip` (`&modo=separado`, para mandarle a cada uno el suyo sin que vea lo de los demás) o solo el de una. El `.zip` lo arma el mismo ZIP que envuelve al `.xlsx`, reusado: el navegador bloquea las descargas múltiples disparadas de a una. El rango usa el huso de Argentina, no UTC: un paquete entregado 21:30 del último día del período es 00:30 del día siguiente en UTC y se caía al período que viene.

Antes de usar las pantallas hay que correr `backend/scripts/migration-liquidaciones.sql` y `backend/scripts/migration-facturas.sql` en Supabase.

## Despliegue

Todo el ecosistema (tanto el cliente como la API) funciona mediante los despliegues de **Vercel**. El enrutamiento de la aplicación cliente está gestionado por la configuración en `frontend/vercel.json`, que asegura que las rutas internas de React funcionen redirigiendo el tráfico a `index.html`.

Cada vez que se realiza un push al repositorio, Vercel empaqueta el cliente con Vite y publica cada archivo de `frontend/api` como Serverless Function.

> El plan Hobby de Vercel permite 12 Serverless Functions. Por eso varias rutas se agrupan en dispatchers (`/api/auth/[action]`, `/api/paquetes/[action]`, `/api/ml/[action]`) en vez de tener un archivo por endpoint.
>
> **Con `/api/facturas` el proyecto quedó en 12 de 12.** No hay lugar para una ruta más: la próxima que haga falta tiene que entrar en un dispatcher existente o agrupar dos de las que ya están. Lo que vive en `api/_lib/` no cuenta — son módulos que las funciones importan, no endpoints.

`backend/` ya no contiene un servidor: solo quedan las migraciones SQL y scripts de línea de comandos que se corren a mano.

## Stack Tecnológico

* **Frontend:** React, Vite, Tailwind CSS
* **Backend:** Vercel Serverless Functions, Supabase (Postgres)
* **Integraciones:** Mercado Libre API

## Equipo

ORT Promoción 2026 — Martín, Tobías y Tobias.

```

```
