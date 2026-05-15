# 📦 pacKen - Sistema de Gestión Logística (Envíos Flex)

**pacKen** es una plataforma de cross-docking enfocada en agilizar el ingreso y ruteo de paquetes para logística de envíos en el mismo día (Flex). 

## 🎯 Foco del MVP (Fase 1)
El objetivo central de esta primera versión es **automatizar el escaneo y clasificación de paquetes en el depósito**. A través de la lectura de códigos QR/barras (como los de Mercado Libre), el sistema identifica el paquete, cruza los datos del Seller y mapea automáticamente el código postal a una zona de ruteo específica, ingresándolo a la base de datos en tiempo real y eliminando la carga manual.

## 🚀 Características Principales
* **Escáner Inteligente:** Lector de etiquetas integrado en el navegador para uso inmediato con la cámara de cualquier celular, tablet o PC.
* **Mapeo Automático de Zonas:** Lógica de asignación de paquetes (ej. CABA Sur, GBA Norte) basada en el origen y destino escaneado.
* **Dashboard Operativo en Vivo:** Seguimiento del flujo de paquetes (Ingresado, En Camino, Entregado, Atrasado).
* **Gestión Base:** Administración de Sellers, Transportistas y Listas de Precios.

## 🛠️ Stack Tecnológico
Elegimos una arquitectura moderna y serverless para garantizar velocidad en el escaneo y sincronización en tiempo real:

* **Frontend:** React + Vite + Tailwind CSS (Interfaces rápidas, modulares y pensadas para la operativa en depósito).
* **Base de Datos & Backend (BaaS):** Supabase (PostgreSQL). Utilizado para el almacenamiento relacional de los paquetes, reglas de negocio y sistema de autenticación, permitiendo lecturas/escrituras ultrarrápidas desde el cliente.
* 
👥 Equipo de Desarrollo
Proyecto desarrollado como trabajo final (ORT Promoción 2026).

Integrantes: Martín, Tobías y Tobias.

Diseñado con 💛 para la logística del futuro.
