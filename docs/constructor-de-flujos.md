# Constructor de flujos (estilo ManyChat, con la esencia de antigravity)

Estado: **diseño** (18 oct 2026). Nada de esto está en producción; el prototipo visual vendrá después, solo front y con datos locales.

## 1. Qué toma de ManyChat

| Idea de ManyChat | Cómo la usamos |
|---|---|
| **Disparador por palabra clave** ("PROMO", "MENÚ") | Nodo `disparador`: palabra clave exacta/contiene, primer mensaje del cliente, o evento (pedido pagado, cliente inactivo X días). |
| **Pasos en cadena** (mensaje → espera → mensaje) | Nodos `mensaje`, `espera` (minutos/horas, respeta horario del negocio) y conexiones salida→entrada. |
| **Botones / respuestas rápidas** | Nodo `opciones` con 2-3 botones (WhatsApp Cloud API) o lista numerada ("1. Ver menú") cuando el canal es QR/Baileys. |
| **Etiquetas** | Nodo `etiqueta` (poner/quitar). Se usan para segmentar campañas y como condición. |
| **Captura de datos** | Nodo `pregunta`: guarda la respuesta en un campo del cliente (nombre, barrio, cumpleaños). |
| **Difusiones** | Ya existe (`campaignSender`). Se podrá elegir una **etiqueta** como segmento, además de inactivos/nuevos/compraron_x. |
| **Condiciones** | Nodo `condicion`: etiqueta, plan, horario abierto/cerrado, total gastado, valor de un campo. |

## 2. Qué lo hace nuestro (y ManyChat no tiene)

1. **Nodo `IA`**: responde con el contexto real del negocio (productos, precios, horarios, políticas, redes) usando `gemini.js`. Cuando el flujo no sabe qué hacer, cae en la IA en español colombiano en vez de "no entendí".
2. **Comercio integrado**: nodos `agregar_al_pedido`, `cobrar` (Nequi/Bancolombia/Efipay con verificación de comprobante), `aplicar_cupon` y `domicilio` (tarifa, domiciliario, seguimiento). ManyChat solo conecta a Shopify/Zapier.
3. **Atención humana**: nodo `pasar_a_asesor` reutiliza la pausa del bot de `handlers/atencionHumana.js` (vuelve solo a las 12 h).
4. **Plantillas por tipo de negocio** (`utils/capacidades.js`): un restaurante arranca con "tomar pedido + cocina", una tienda de ropa con "catálogo + tallas".
5. **Precio**: incluido en los planes ($25.000 - $449.000), sin cobro por contacto como ManyChat.

## 3. Modelo de datos

```sql
flujos            (id, negocio_id, nombre, activo, version, creado_en, actualizado_en)
flujo_nodos       (id, flujo_id, clave, tipo, config JSON, pos_x, pos_y)   -- clave = id estable dentro del flujo
flujo_conexiones  (id, flujo_id, desde_clave, salida, hacia_clave)         -- salida: 'default' | 'boton:1' | 'si' | 'no'
flujo_ejecuciones (id, flujo_id, negocio_id, cliente_id, nodo_actual, estado, contexto JSON,
                   reanudar_en DATETIME NULL, creado_en, actualizado_en)    -- estado: activa | esperando | terminada | error
etiquetas         (id, negocio_id, nombre)
etiquetas_cliente (cliente_id, etiqueta_id, creado_en)                      -- PK compuesta
```

Reglas:
- Todo con `negocio_id` y filtrado por él en cada consulta (mismo criterio que `cupones`/`clientes`).
- `contexto` guarda respuestas capturadas y variables (`{nombre}`, `{pedido_id}`); se sanea y tiene tope de tamaño.
- Una ejecución activa por cliente y flujo (índice único parcial vía clave `cliente_id+flujo_id+estado`), para no duplicar respuestas.
- Versionado: al publicar, `version` sube; las ejecuciones en curso terminan con su versión.

## 4. Qué se reutiliza

- **`automationsService`**: `enviarWhatsApp`, `yaSeNotifico`/`registrarNotificacion` (antirrepetición), `avisarAlDueno`, `isAutomationActive` (bloqueo por plan).
- **`campaignSender`**: `personalizar` para `{nombre}`, la regla "solo a `acepta_marketing=1`" (Ley 1581) y las pausas de 2-5 s anti-bloqueo. Los nodos de envío proactivo (los que escriben sin que el cliente haya escrito primero) deben pasar por ahí.
- **Scheduler del API** (el que ya procesa campañas cada 30 s): procesa también `flujo_ejecuciones` con `estado='esperando'` y `reanudar_en <= NOW()`.
- **`messageHandler`**: antes de llamar a la IA, busca si el mensaje dispara un flujo o si el cliente tiene una ejecución activa esperando respuesta; si no, sigue el camino de hoy.

## 5. Motor de ejecución (idea)

1. Mensaje entrante → `FlowEngine.manejar(negocioId, cliente, texto)`.
2. ¿Ejecución `esperando` respuesta? → guarda dato / elige botón y avanza.
3. ¿Coincide un disparador de un flujo activo? → crea ejecución en el primer nodo.
4. Ejecuta nodos hasta uno que espere (pregunta/espera/opciones) o termine. Tope de 50 nodos por pasada (anti bucle).
5. Errores → ejecución en `error`, aviso al dueño, y el cliente cae en la IA.

## 6. Límites y seguridad

- Máximo de flujos/nodos por plan (Emprendedor: 3 flujos / 30 nodos; subir en planes mayores).
- Los flujos no ejecutan código del usuario; los nodos son un catálogo cerrado.
- Mensajes proactivos solo a quien aceptó marketing y con tope por día.
- Con Baileys (QR) los botones no existen: se degradan a lista numerada. Con Cloud API fuera de las 24 h se necesitan plantillas aprobadas por Meta.

## 7. Fases

1. **Prototipo visual** (solo front, datos locales): lienzo con nodos arrastrables, conexiones, panel de propiedades, plantillas de ejemplo.
2. **Backend mínimo**: tablas + CRUD con validación + motor con disparador por palabra clave, mensaje, espera, etiqueta, IA.
3. **Comercio**: nodos de pedido, cobro, cupón, domicilio.
4. **Difusión por etiqueta** y métricas por flujo (entradas, abandono por nodo).

## 8. Decisiones abiertas (del socio)

- ¿Límites de flujos por plan? (propuesta arriba).
- ¿Se ofrece a todos los tipos de negocio o solo desde Professional?
- ¿Biblioteca de plantillas hechas por nosotros (promo, menú, reserva, reseña)?

---

# Plan de implementación (21 oct 2026)

Meta: que un dueño sin conocimientos técnicos arme flujos como en ManyChat y que los flujos **vendan** (pedido, cobro, domicilio), cosa que ManyChat no hace. Orden pensado para que cada etapa se pueda mostrar y usar sola.

## Etapa 0 — Hecho
- Diseño y modelo de datos (este documento).
- Prototipo visual en `/flujos` (lienzo, 9 tipos de paso, panel de propiedades, guardado local).
- Piezas reutilizables ya en producción: `campaignSender` (envío con pausas y solo a quien aceptó marketing), `automationsService` (envío, antirrepetición), atención humana (`handlers/atencionHumana.js`), cupones, pedidos, domicilios con ETA.

## Etapa 1 — Guardar flujos de verdad (1-2 días)
- Migración `db/migrate_flujos.js` (en `migrate_all`): `flujos`, `flujo_nodos`, `flujo_conexiones`, `etiquetas`, `etiquetas_cliente`. Todo con `negocio_id`.
- Servicio `api/services/flujos.js`: validar el grafo (un solo disparador, sin nodos huérfanos ni ciclos sin espera, máx. 30 nodos, textos ≤ 500) con **tests** (mismo estilo que `perfilNegocio`).
- Rutas `/api/flujos` (listar, crear, guardar, activar/desactivar, borrar) filtradas por `negocio_id`; límite de flujos por plan.
- El prototipo `FlujosPage` pasa a leer/guardar en la API (lista de flujos + editor). Se mantiene "Volver al ejemplo".
- **Listo cuando:** crear un flujo, recargar y verlo igual desde otro navegador; un grafo inválido devuelve el motivo en español.

## Etapa 2 — Motor mínimo: responde de verdad (2-3 días)
- `instance-manager/services/flowEngine.js` + tabla `flujo_ejecuciones` (`nodo_actual`, `estado`, `contexto`, `reanudar_en`).
- Gancho en `messageHandler.js`: después de identificar al cliente y de la comprobación de atención humana, y **antes** de llamar a la IA: (1) ¿hay ejecución esperando respuesta? (2) ¿el texto dispara un flujo activo? Si ninguna, sigue el camino de hoy.
- Nodos: disparador (palabra / primer mensaje), mensaje (con `{nombre}`), opciones (lista numerada), pregunta (guarda dato), etiqueta, condición, IA, asesor.
- Tope de 50 nodos por pasada, error → ejecución en `error` + aviso al dueño + el cliente cae en la IA.
- **Listo cuando:** escribir "PROMO" desde otro número dispara el flujo de ejemplo de punta a punta y cada paso queda registrado.

## Etapa 3 — Esperas y mensajes proactivos (1-2 días)
- Nodo espera: `reanudar_en`; el scheduler (el mismo ciclo de 30 s de campañas) reanuda ejecuciones vencidas.
- Todo envío que no responde a un mensaje del cliente pasa por la regla de `campaignSender`: solo `acepta_marketing = 1`, pausas 2-5 s, tope diario por negocio.
- **Listo cuando:** "esperar 10 min y recordar el carrito" funciona y no escribe a quien no aceptó marketing.

## Etapa 4 — Comercio dentro del flujo (2-3 días)
- Nodos `pedido` (reusa el flujo de pedidos de `gemini.js`/`paymentHandler`), `cobrar`, `cupón` (`services/cupones.js`) y `domicilio`.
- Plantillas listas por tipo de negocio (`utils/capacidades.js`): restaurante (tomar pedido), tienda (catálogo), servicios (agendar), promo (la del ejemplo).
- **Listo cuando:** un cliente completa un pedido pagado empezando en un flujo.

## Etapa 5 — Segmentos, difusiones y métricas (2 días)
- Campañas pueden elegir una **etiqueta** como segmento (`campaignSender.destinatarios`).
- Métricas por flujo: entradas, completados, abandono por nodo (se lee de `flujo_ejecuciones`).
- Pantalla de etiquetas de clientes en Clientes.

## Etapa 6 — Canal oficial y pulido (según Meta)
- Con **WhatsApp Cloud API** se activan botones reales y plantillas para escribir fuera de las 24 h (hoy con QR/Baileys solo hay lista numerada). Depende de la verificación de Meta (ver plan de producción).
- Deshacer/rehacer, zoom, duplicar flujo, simulador "probar flujo" sin enviar nada a clientes.

## Riesgos
- **Bloqueo de número** (Baileys): por eso el tope diario y las pausas son parte del motor, no opcionales.
- **Ley 1581**: etiquetas y datos capturados cuentan como datos personales; documentar en la política y permitir borrarlos.
- **Dos "cerebros"** (flujo vs IA): regla clara — un flujo activo manda mientras dura la ejecución; al terminar o fallar, vuelve la IA.
- **Complejidad para el dueño**: arrancar siempre desde plantillas; el lienzo en blanco es para quien ya sabe.

## Decisiones que necesito del socio (antes de la Etapa 1)
1. Límite de flujos por plan (propuesta: Emprendedor 3 · Starter 5 · Professional 20 · Enterprise ilimitado).
2. ¿Desde qué plan se ofrece? (propuesta: desde Emprendedor, con límites).
3. ¿Se muestra ya el menú "Flujos" a los clientes o se oculta hasta la Etapa 2?
