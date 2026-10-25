# Cómo organizar la app para que nadie se pierda

Estado: **propuesta** (25 oct 2026). Punto de partida: hoy el menú tiene 21 entradas en 4 grupos ("Operación", "Clientes", "Tu bot", "Cuenta") y la app va a crecer (inventario, Instagram, facturación, más canales).

## 1. Qué problema hay hoy

- **Se organiza por tecnología, no por tarea.** "Tu bot" mezcla WhatsApp, Llamadas, Multi-Canal, Monitoreo, Analytics, Automatizaciones y Flujos. Un dueño de tienda no piensa en "multicanal": piensa en "contestar mensajes", "vender" y "avisar a mis clientes".
- **Cosas parecidas están separadas**: Automatizaciones, Flujos, Campañas y Cupones son "comunicación y promociones"; Analytics y Monitoreo son "ver cómo voy"; WhatsApp, Multi-Canal y Bot Llamadas son "por dónde me escriben".
- **Todo se ve a la vez.** Un negocio de peluquería ve Domicilios, Restaurantes y Caja aunque no los use.
- **Sin canales unificados.** Con Instagram, cada canal sería una página más y la bandeja de mensajes se partiría.

## 2. Principios

1. **Por tarea del dueño** ("¿qué quiero hacer?"), no por función técnica.
2. **Máximo 7-8 entradas en el menú principal**; lo demás va dentro, en pestañas.
3. **El canal es un dato, no una página**: los mensajes de WhatsApp e Instagram entran a la misma bandeja (con un filtro por canal).
4. **Mostrar solo lo que aplica** al tipo de negocio y al plan (ya existe `utils/capacidades.js`); lo bloqueado por plan se muestra una vez, discreto, con "Mejorar plan".
5. **Lenguaje de calle**: "Respuestas automáticas" en vez de "Flujos"; "Canales" en vez de "Multi-Canal".
6. **Lo importante a un toque en el celular**: barra inferior de 4-5 destinos.

## 3. Menú propuesto (8 entradas)

| # | Entrada | Qué contiene (pestañas) | Hoy está en |
|---|---|---|---|
| 1 | **Inicio** | Resumen del día, "qué hacer ahora", checklist de primeros pasos | Dashboard |
| 2 | **Mensajes** | Bandeja única (WhatsApp, Instagram…), filtros: sin leer, requiere atención, por canal | Conversaciones |
| 3 | **Ventas** | Pedidos · Domicilios · Caja · Modo cocina (solo restaurantes) | Pedidos, Domicilios, Caja, Cocina |
| 4 | **Productos** | Catálogo · Inventario (stock, historial, importar) · Cartas/restaurantes | Productos, Restaurantes |
| 5 | **Clientes** | Lista · Etiquetas y grupos · (luego) Programa de puntos | Clientes |
| 6 | **Marketing** | **Respuestas automáticas** (flujos y plantillas) · Campañas · Cupones · Automatizaciones | Flujos, Campañas, Cupones, Automatizaciones |
| 7 | **Reportes** | Ventas · Clientes · Rendimiento del bot (monitoreo) | Analytics, Monitoreo |
| 8 | **Ajustes** | Negocio · **Canales** (WhatsApp, Instagram, llamadas…) · Tu bot (personalidad, agentes) · Pagos · Equipo · Plan · Seguridad · Guía | Ajustes, WhatsApp, Multi-Canal, Bot Llamadas, Suscripción, Guía |

Notas:
- **Canales dentro de Ajustes**: se configura una vez; el día a día vive en Mensajes. La pantalla de Canales muestra tarjetas (WhatsApp ✅ conectado, Instagram ➕ conectar, Llamadas 🔒 plan…).
- **"Tu bot"** deja de ser un grupo: es una pestaña de Ajustes ("cómo habla tu bot") más el botón "Probar mi bot" disponible en Mensajes.
- **Facturación** (futuro) entra en **Ventas** como pestaña "Facturas"; **compras y proveedores** (futuro) en **Productos**.
- **Ayuda**: botón "?" fijo en el encabezado (ya existe `AyudaRapida`/Guía), no una entrada más del menú.

## 4. En el celular

Barra inferior (5): **Inicio · Mensajes · Ventas · Productos · Más**. En "Más": Clientes, Marketing, Reportes, Ajustes. La barra ya existe (`BARRA_INFERIOR`); solo cambian los destinos.

## 5. Dentro de cada sección: pestañas, no páginas sueltas

Cada entrada abre una pantalla con pestañas arriba (ej.: Marketing → *Respuestas automáticas | Campañas | Cupones | Automatizaciones*). Las rutas actuales (`/flujos`, `/campanas`…) se mantienen como pestañas con enlace propio para no romper enlaces ni favoritos.

## 6. Para que la gente entienda la app

- **Primer uso guiado** (ya existe `/bienvenida` y el checklist): terminar con "tu primera respuesta automática" y "conecta tu Instagram".
- **Estados vacíos que enseñan**: cada pantalla vacía explica para qué sirve y ofrece 1 botón ("Usar una plantilla").
- **Plantillas primero**: en Marketing, el flujo en blanco es la opción secundaria.
- **Indicadores de lo que falta**, no de todo: puntos rojos solo en lo que requiere acción (pedidos por atender, mensajes sin leer, stock agotado).
- **Búsqueda global (Ctrl+K)** ya existe: añadir acciones ("Crear cupón", "Ajustar stock").
- **Modo Simple / Avanzado** (opcional, más adelante): "Simple" esconde lo técnico (agentes, whitelist, monitoreo).

## 7. Cómo se hace sin romper nada (por etapas)

1. **Etapa 1 (≈1 día, bajo riesgo):** cambiar `components/shell/navConfig.js` — nuevos grupos y nombres, ocultar por capacidades — sin mover rutas. Es la única fuente del menú lateral, la barra inferior, el cajón "Más" y la paleta Ctrl+K.
2. **Etapa 2 (≈2-3 días):** pantalla **Ajustes → Canales** con tarjetas (reúne WhatsApp, Instagram, Multi-Canal, Llamadas) y **Mensajes** con filtro por canal.
3. **Etapa 3 (≈3-4 días):** componente `Pestañas` compartido y agrupar: Ventas, Productos/Inventario, Marketing, Reportes. Redirecciones desde las rutas viejas.
4. **Etapa 4:** pruebas con 3-5 dueños reales (¿encuentran "crear un cupón" en 10 segundos?) y ajustar nombres.

## 8. Decisiones del socio

1. ¿Te gusta el menú de 8 entradas o prefieres menos (por ejemplo juntar Clientes dentro de Mensajes)?
2. Nombre para "Flujos": ¿**Respuestas automáticas**, **Conversaciones automáticas** o **Asistente**?
3. ¿Modo Simple/Avanzado desde ya o más adelante?
4. ¿Empezamos por la Etapa 1 (solo el menú) para verlo en pantalla y decidir?
