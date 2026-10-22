# Ecosistema: inventario, ventas y facturación para tiendas pequeñas y medianas

Estado: **diseño** (21 oct 2026). Objetivo del socio: un ecosistema grande y **versátil**, empezando por tiendas pequeñas y medianas.

## 1. Qué hay hoy (revisado en el código)

| Pieza | Estado |
|---|---|
| Productos | `productos(nombre, precio, stock, activo, categoria, imagen_url)`. Sin SKU, costo, variantes ni bodega. |
| Stock | Es solo un número. **Ninguna venta lo descuenta** (ni el bot ni el panel) y el bot **no comprueba disponibilidad**: puede vender algo agotado. Solo existe la alerta `stock_bajo`. |
| Pedidos | `pedidos` + `items_pedido`, con estados, cupones y domicilios. |
| Pagos | Efipay (suscripción), comprobantes Nequi/Bancolombia verificados por IA. |
| Caja | `routes/caja.js` es un **puente** a una app aparte (Spring Boot, "caja: inventario, ventas y plata para emprendedores") que se vende con el plan **Emprendedor** (`cajaInventario: true`). Antigravity solo emite el token. |
| Usuarios | `maxUsers` por plan, pero sin roles reales en el panel del dueño. |

**Decisión clave pendiente:** el plan Emprendedor ya vende un inventario (la caja). Hay que decidir si el inventario nuevo (a) vive dentro de Antigravity y la caja se queda para quien no quiere el bot, o (b) se integra con la caja. Recomendación: **(a)**, un solo modelo de datos dentro de Antigravity, porque el bot, los flujos y las campañas necesitan leer el inventario en tiempo real y una integración entre dos apps añade fallos.

## 2. Principios para que sea versátil

1. **Módulos que se encienden por negocio**, como ya se hace con `capacidades.js` por tipo de negocio: una tienda de ropa activa variantes (talla/color); un abarrote activa códigos de barras y peso; un servicio no activa inventario.
2. **Un solo registro de movimientos** es la fuente de verdad del stock: nunca se edita el número a mano, se registra un movimiento (así hay historia y se puede auditar).
3. **Todo lo que vende descuenta del mismo lugar:** bot, flujos, panel y caja (venta de mostrador).
4. **Lo legal no se construye, se integra** (facturación electrónica con un proveedor autorizado).
5. **Empezar simple, con límites por plan**, y crecer por módulos.

## 3. Módulos (en orden de entrega)

### Módulo A — Inventario real (primero)
- **Movimientos**: `entrada` (compra), `salida` (venta), `ajuste` (conteo/merma), `devolucion`, `traslado`. Cada uno con cantidad, costo, motivo, usuario y referencia (pedido, compra).
- **Descuento automático** al confirmar el pago de un pedido (y reintegro si se cancela). Reserva opcional al crear el pedido para no vender lo mismo dos veces.
- **El bot respeta el stock**: no ofrece lo agotado, avisa "quedan 2" y propone alternativas.
- **Producto ampliado**: SKU, código de barras, costo, precio de compra, unidad (unidad/kg/caja), stock mínimo propio, categoría, proveedor.
- **Variantes** (talla/color) como productos hijos con su propio stock.
- **Importar/exportar Excel o CSV** (lo primero que pide una tienda con catálogo grande).
- **Conteo de inventario** (toma física) con ajuste automático de diferencias.
- **Alertas**: stock bajo por producto, agotados, productos sin movimiento.

### Módulo B — Compras y proveedores
- Proveedores, órdenes de compra, recepción (que genera la entrada), cuentas por pagar básicas.
- Sugerencia de reabastecimiento según ventas de los últimos 30 días.

### Módulo C — Ventas de mostrador y caja
- Venta rápida desde el panel/celular (sin WhatsApp): busca producto o escanea código, cobra, descuenta stock.
- Apertura y cierre de caja por turno, arqueo, gastos del día.
- Decidir aquí el destino de la app "caja" aparte.

### Módulo D — Facturación
- **Integración con un proveedor tecnológico autorizado por la DIAN** (opciones a evaluar: Alegra, Siigo, Factus, Dataico). Antigravity envía la venta; el proveedor numera, firma, valida con la DIAN y manda el XML/PDF al cliente. Antigravity guarda número, CUFE, estado y enlace al PDF.
- Notas crédito (devoluciones) y documento equivalente (POS) si el proveedor lo ofrece.
- Datos del negocio: NIT, régimen, resolución y prefijos (hoy solo hay NIT y razón social en Ajustes → Pago).
- **Antes de prometerlo**: validar con un contador qué negocios están obligados y qué prefieren (muchas tiendas pequeñas aún usan POS o factura de talonario).
- Alternativa más simple de partida: **recibo/comprobante interno** en PDF (no es factura electrónica) para quien no está obligado.

### Módulo E — Reportes
- Ventas por producto/categoría/día, margen (precio − costo), rotación, productos estrella y estancados, valor del inventario, cierre diario exportable para el contador.

### Módulo F — Equipo y sedes
- **Roles**: dueño, administrador, vendedor, bodeguero (permisos por módulo).
- **Varias bodegas/sedes** y traslados (solo para planes altos).

### Módulo G — Conexiones
- API pública con llaves, webhooks y conectores a tiendas en línea (Shopify, WooCommerce) para sincronizar stock.

## 4. Modelo de datos (borrador del Módulo A)

```sql
-- productos: columnas nuevas (todas opcionales)
ALTER TABLE productos ADD sku VARCHAR(40) NULL, ADD codigo_barras VARCHAR(30) NULL,
  ADD costo DECIMAL(12,2) NULL, ADD unidad VARCHAR(10) DEFAULT 'und', ADD stock_minimo INT NULL,
  ADD controla_stock BOOLEAN DEFAULT TRUE, ADD producto_padre_id INT NULL, ADD proveedor_id INT NULL;
-- UNIQUE (negocio_id, sku) y (negocio_id, codigo_barras) cuando existan

bodegas              (id, negocio_id, nombre, es_principal)
inventario_movimientos (id, negocio_id, producto_id, bodega_id, tipo ENUM('entrada','salida','ajuste','devolucion','traslado'),
                        cantidad INT, costo_unitario DECIMAL, motivo VARCHAR(120), referencia_tipo VARCHAR(20), referencia_id INT,
                        usuario_id INT NULL, created_at)
inventario_saldos    (producto_id, bodega_id, cantidad)   -- caché del saldo; se recalcula desde los movimientos
```

Reglas: el saldo nunca queda negativo salvo que el negocio lo permita; todo cambio de stock pasa por una función única (`registrarMovimiento`) con transacción y bloqueo de fila para que dos ventas simultáneas no vendan la última unidad dos veces; `productos.stock` se mantiene como el saldo total para no romper lo existente.

## 5. Cómo se conecta con lo que ya existe

- **Bot / `gemini.js`**: ya lee `stock` al armar el prompt; pasa a filtrar agotados y avisar cantidades.
- **Pedidos**: al pasar a `pago_confirmado` se registra la salida; al `cancelado` se devuelve.
- **Flujos**: nuevos pasos "Verificar stock", "Reservar" y condición "producto agotado"; la etiqueta "pidió producto agotado" sirve para avisarle al cliente cuando haya.
- **Automatizaciones**: `stock_bajo` usa el `stock_minimo` de cada producto.
- **Campañas**: segmento "compraron X" ya existe; se suma "aviso de reposición".
- **Planes** (`config/planConfig.js`): cada módulo es una feature con límite (productos, bodegas, usuarios, facturas al mes).

## 6. Planes sugeridos (a confirmar)

| Plan | Inventario |
|---|---|
| Emprendedor ($25.000) | Inventario básico y caja (lo que vende hoy) |
| Starter | + movimientos, importar/exportar, alertas |
| Professional | + compras/proveedores, variantes, reportes, roles, facturación con tope mensual |
| Enterprise | + varias bodegas, API, facturación ilimitada |

Cada factura electrónica tiene costo del proveedor: se cobra incluida con tope o como adicional.

## 7. Riesgos

- **Dispersión**: competir con Siigo/Alegra/Loggro en ERP completo es perder. Posicionamiento: *"tu tienda vende por WhatsApp y el inventario se descuenta solo"*; la contabilidad profunda se exporta.
- **Facturación**: responsabilidad legal; usar proveedor autorizado y dejar claro quién responde.
- **Datos existentes**: stock actual mal cargado; ofrecer "conteo inicial" al activar el módulo.
- **Concurrencia**: dos ventas a la vez del último artículo (resuelto con transacciones y reserva).
- **Soporte**: inventario y facturas generan más dudas; invertir en `AyudaRapida` y plantillas.

## 8. Plan de entrega

1. **Fase 1 (≈1 semana)**: movimientos + descuento automático al pagar + el bot respeta el stock + stock mínimo por producto + importar/exportar CSV. *Esto solo ya diferencia el producto.*
2. **Fase 2**: SKU/código de barras, costo y margen, conteo físico, reportes básicos.
3. **Fase 3**: roles y multiusuario; venta de mostrador.
4. **Fase 4**: proveedor de facturación (piloto con uno) + notas crédito.
5. **Fase 5**: compras/proveedores, variantes, bodegas, API.

## 9. Decisiones del socio

1. ¿El inventario nuevo reemplaza a la "caja" aparte o se integra con ella? (recomendado: unificar en Antigravity.)
2. ¿Qué proveedor de facturación explorar primero? (Se puede investigar precios y API.)
3. ¿Tiendas con **variantes** (ropa/calzado) o más bien abarrotes/ferretería con código de barras primero? Define el orden de la Fase 2.
4. ¿El stock puede quedar negativo (se vende y se repone después) o se bloquea la venta?
5. ¿La facturación electrónica es obligatoria para tu cliente objetivo o basta un recibo interno al inicio?
