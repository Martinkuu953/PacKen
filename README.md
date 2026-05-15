# 📦 PacKen
> **Control total, sin complicaciones.**

PacKen es una plataforma SaaS (Software as a Service) B2B diseñada específicamente para empoderar a las PyMEs de logística y distribución de última milla, con un enfoque principal en los operadores de **Mercado Envío Flex**. 

Nuestro objetivo es eliminar el cuello de botella administrativo mediante la automatización de procesos operativos, la clasificación rápida de paquetes y la liquidación automática de transportistas.

---

## 🚀 Características Principales (MVP)

* **⚡ Clasificación Rápida (Smart Sorting):** Escaneo de códigos QR/Barras de etiquetas de Mercado Libre para identificar instantáneamente la zona de entrega, agilizando el proceso de cross-docking en el depósito.
* **💸 Liquidación Automática:** Motor de cálculo que cruza las zonas de entrega con listas de precios personalizadas por *Seller* y *Transportista*, generando los pagos y cobros de forma automática sin cruzar Excels manualmente.
* **🗺️ Trazabilidad y Mapas:** Seguimiento del estado del paquete y geolocalización de las entregas para garantizar la transparencia frente al cliente final y la plataforma de e-commerce.
* **📊 Dashboard Operativo:** Panel de control para la administración que muestra en tiempo real la utilidad del día, paquetes entregados, demorados y rendimiento general de los repartidores.

---

## 🛠️ Stack Tecnológico

El proyecto está construido bajo una arquitectura robusta y escalable, orientada a un alto volumen de transacciones de datos logísticos:

* **Backend:** C# / ASP.NET Core
* **Frontend:** HTML5, CSS3, JavaScript (Diseño responsivo para móviles y tablets en depósitos)
* **Base de Datos:** Microsoft SQL Server (Diseño relacional optimizado)
* **Integraciones:** Lector de QR web, API de Geolocalización.
* **Prototipado UI/UX:** Figma

---

## 🗄️ Arquitectura de Datos

La base de datos está diseñada bajo un modelo relacional (DER) que soporta multi-tenancy y listas de precios dinámicas. Las entidades principales incluyen:
* `Empresa` (Administrador del sistema)
* `Paquetes` (Vinculados a un ID de Mercado Libre)
* `Transportistas` (Asignación de zonas y recorridos)
* `Sellers` (Clientes B2B con puntos de retiro)
* `Zonas` y `Listas de Precios` (Motor de facturación)

---

## 👥 Equipo de Desarrollo

Este proyecto está siendo desarrollado como trabajo final (Promoción 2026) por:

* **Tobías Epsztein** * **Tobias Nul** * **Martín Ku** ---

## 📌 Estado del Proyecto
🚧 **Fase actual:** Desarrollo del MVP (Producto Mínimo Viable).
