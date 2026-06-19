-- ============================================
-- ANTIGRAVITY Seed Data
-- 3 negocios de prueba: Restaurante, Tienda Ropa, Spa
-- ============================================

USE antigravity;

-- Password hasheada para todas: Demo2024#
-- bcrypt: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYGCpFdC0FUm

-- ============================================
-- NEGOCIO 1: Restaurante "Sabores de Casa"
-- Plan: starter
-- ============================================

INSERT INTO negocios (id, nombre, color_principal, whatsapp, email_dueno, password, 
    plan, activo, onboarding_completado, razon_social, nit, tipo_negocio, ciudad, departamento, 
    direccion, descripcion_negocio, numero_empleados, volumen_pedidos_dia, metodos_pago_activos, 
    terminos_aceptados, suscripcion_activa, bot_nombre, bot_tono, bot_bienvenida,
    horario_activo_inicio, horario_activo_fin, mensaje_fuera_horario) VALUES
(1, 'Sabores de Casa', '#FF6B35', '+573001111111', 'sabores@demo.co', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYGCpFdC0FUm',
    'starter', true, true, 'Restaurante Sabores de Casa SAS', '900111222-1', 'restaurante', 
    'Medellín', 'Antioquia', 'Carrera 43A #1-50, El Poblado',
    'Restaurante de comida tradicional colombiana con delivery', '6-20', '51-200', 
    '["nequi","bancolombia","efectivo"]', true, true, 'Camilo', 'amigable',
    '¡Hola! Soy Camilo, tu asistente de Sabores de Casa. ¿Qué te gustaría comer hoy?',
    '08:00:00', '22:00:00', 'Nuestro horario de atención es de 8am a 10pm. ¿Te gustaría hacer un pedido para mañana?');

INSERT INTO clientes (negocio_id, nombre, whatsapp, total_pedidos, total_gastado) VALUES
(1, 'Ana María López', '+573201111111', 8, 520000),
(1, 'Pedro Gómez', '+573202222222', 5, 380000),
(1, 'Laura Ramírez', '+573203333333', 3, 180000),
(1, 'Jorge Torres', '+573204444444', 12, 890000),
(1, 'María Elena Castro', '+573205555555', 2, 95000);

INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo) VALUES
(1, 'Bandeja Paisa', 'Incluye: arroz, frijoles, chicharrón, chorizo, huevo, platano, arepa', 28000, 50, true),
(1, 'Sancocho de Gallina', 'Sancoho tradicional con gallina criolla, yuca, papa, plátano', 22000, 30, true),
(1, 'Arepa con Queso', 'Arepa de chocoala rellena de queso', 8000, 100, true),
(1, 'Empanada de Carne', 'Empanada artesanal con carne molida', 4500, 80, true),
(1, 'Jugo de Lulo', 'Jugo natural de lulo', 6000, 40, true);

INSERT INTO pedidos (negocio_id, cliente_id, numero_pedido, estado, metodo_pago, subtotal, descuento, total, direccion_entrega) VALUES
(1, 1, '#SC-0001', 'entregado', 'nequi', 56000, 0, 56000, 'Calle 10 #20-30, Medellín'),
(1, 2, '#SC-0002', 'entregado', 'bancolombia', 28000, 0, 28000, 'Carrera 45 #15-20, Medellín'),
(1, 4, '#SC-0003', 'en_preparacion', 'nequi', 86000, 5000, 81000, 'Avenida El Poblado #50-100, Medellín'),
(1, 1, '#SC-0004', 'pago_enviado', 'efectivo', 44000, 0, 44000, 'Calle 10 #20-30, Medellín'),
(1, 5, '#SC-0005', 'pendiente_pago', 'nequi', 22000, 0, 22000, 'Carrera 30 #5-10, Medellín');

INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 1, 1, 28000, 28000),
(1, 5, 2, 6000, 12000),
(1, 3, 2, 8000, 16000),
(2, 1, 1, 28000, 28000),
(3, 1, 2, 28000, 56000),
(3, 2, 1, 22000, 22000),
(3, 5, 2, 6000, 8000),
(4, 4, 2, 4500, 9000),
(4, 3, 4, 8000, 32000),
(4, 5, 1, 6000, 6000),
(5, 2, 1, 22000, 22000);

INSERT INTO suscripciones (negocio_id, plan, estado, trial_inicio, trial_fin, pago_inicio, pago_fin, monto_mensual) VALUES
(1, 'starter', 'activa', '2026-02-01 00:00:00', '2026-02-08 00:00:00', '2026-02-08 00:00:00', '2026-03-08 00:00:00', 99000);

INSERT INTO automatizaciones_config (negocio_id, tipo, activa, config, plan_requerido) VALUES
(1, 'recordatorio_pago', true, '{"minutos": 30, "mensaje": "Recuerda que tienes un pedido pendiente de pago"}', 'starter'),
(1, 'reengagement', false, '{"dias": 15, "mensaje": "¡Te extrañamos! Vuelve a probar nuestros platos"}', 'professional'),
(1, 'stock_bajo', false, '{"umbral": 5, "email_alerta": true}', 'starter'),
(1, 'reporte_semanal', false, '{"dia": "lunes", "hora": "08:00", "metricas": ["ventas", "pedidos"]}', 'professional'),
(1, 'campaña_masiva', false, '{"segmento": "todos", "mensaje": ""}', 'professional'),
(1, 'ocr_pagos', false, '{}', 'enterprise');

INSERT INTO analytics_diario (negocio_id, fecha, total_mensajes, total_pedidos, total_ventas, tasa_conversion, tiempo_respuesta_avg) VALUES
(1, '2026-03-15', 35, 4, 320000, 11.4, 18),
(1, '2026-03-16', 42, 5, 450000, 11.9, 15),
(1, '2026-03-17', 28, 3, 195000, 10.7, 22);

-- ============================================
-- NEGOCIO 2: Tienda de Ropa "Moda Urbana"
-- Plan: professional
-- ============================================

INSERT INTO negocios (id, nombre, color_principal, whatsapp, email_dueno, password, 
    plan, activo, onboarding_completado, razon_social, nit, tipo_negocio, ciudad, departamento, 
    direccion, descripcion_negocio, numero_empleados, volumen_pedidos_dia, metodos_pago_activos, 
    terminos_aceptados, suscripcion_activa, bot_nombre, bot_tono, bot_bienvenida,
    horario_activo_inicio, horario_activo_fin, mensaje_fuera_horario) VALUES
(2, 'Moda Urbana', '#9B59B6', '+573002222222', 'moda@demo.co', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYGCpFdC0FUm',
    'professional', true, true, 'Moda Urbana Colombia SAS', '900333444-2', 'retail', 
    'Bogotá', 'Cundinamarca', 'Carrera 7 #71-21, Chapinero',
    'Tienda de ropa urbana y accessories para jóvenes', '2-5', '11-50', 
    '["nequi","bancolombia","bold"]', true, true, 'Sofía', 'casual',
    '¡Hey! Soy Sofía, tu asesora de Moda Urbana. ¿Buscas algo en especial? 🌟',
    '09:00:00', '21:00:00', '¡Ya cerramos! Pero puedes dejarnos tu mensaje y te respondemos mañana 💜');

INSERT INTO clientes (negocio_id, nombre, whatsapp, total_pedidos, total_gastado) VALUES
(2, 'Miguel Ángel Díaz', '+573211111111', 6, 420000),
(2, 'Carolina Sánchez', '+573212222222', 9, 780000),
(2, 'Andrés Felipe Mora', '+573213333333', 4, 290000),
(2, 'Daniela Gómez', '+573214444444', 7, 520000),
(2, ' Sebastián Ortiz', '+573215555555', 2, 145000);

INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo) VALUES
(2, 'Camiseta Oversize', 'Algodón orgánico, oversize fit, varios colores', 45000, 60, true),
(2, 'Jeans Skinny', 'Jean elastizado skinny fit, tiro alto', 89000, 25, true),
(2, 'Sudadera con Capucha', 'Algodón perchado, logo bordado', 75000, 35, true),
(2, 'Gorra Trucker', 'Gorra deportiva con cierre', 28000, 40, true),
(2, 'Chaqueta Bomber', 'Nylon impermeable, forro polar', 150000, 15, true);

INSERT INTO pedidos (negocio_id, cliente_id, numero_pedido, estado, metodo_pago, subtotal, descuento, total, direccion_entrega) VALUES
(2, 2, '#MU-0001', 'entregado', 'nequi', 179000, 10000, 169000, 'Carrera 15 #80-40, Bogotá'),
(2, 1, '#MU-0002', 'enviado', 'bold', 225000, 0, 225000, 'Calle 45 #10-25, Bogotá'),
(2, 4, '#MU-0003', 'en_preparacion', 'bancolombia', 45000, 0, 45000, 'Avenida Caracas #30-10, Bogotá'),
(2, 3, '#MU-0004', 'pago_enviado', 'nequi', 120000, 5000, 115000, 'Carrera 9 #70-15, Bogotá'),
(2, 2, '#MU-0005', 'pendiente_pago', 'bold', 300000, 30000, 270000, 'Carrera 15 #80-40, Bogotá');

INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 3, 1, 75000, 75000),
(1, 4, 1, 28000, 28000),
(1, 1, 2, 45000, 76000),
(2, 5, 1, 150000, 150000),
(2, 1, 1, 45000, 45000),
(2, 2, 1, 89000, 89000),
(3, 1, 1, 45000, 45000),
(4, 3, 1, 75000, 75000),
(4, 1, 1, 45000, 45000),
(5, 5, 2, 150000, 300000);

INSERT INTO suscripciones (negocio_id, plan, estado, trial_inicio, trial_fin, pago_inicio, pago_fin, monto_mensual) VALUES
(2, 'professional', 'activa', '2026-01-15 00:00:00', '2026-01-22 00:00:00', '2026-01-22 00:00:00', '2026-03-22 00:00:00', 249000);

INSERT INTO automatizaciones_config (negocio_id, tipo, activa, config, plan_requerido) VALUES
(2, 'recordatorio_pago', true, '{"minutos": 45, "mensaje": "Tu pedido te espera 🚀 Paga y lo enviamos"}', 'starter'),
(2, 'reengagement', true, '{"dias": 20, "mensaje": "Nueva colección llegó 🔥 Descúbrela"}', 'professional'),
(2, 'stock_bajo', true, '{"umbral": 10, "email_alerta": true}', 'starter'),
(2, 'reporte_semanal', true, '{"dia": "viernes", "hora": "18:00", "metricas": ["ventas", "pedidos", "top_producto"]}', 'professional'),
(2, 'campaña_masiva', false, '{"segmento": "todos", "mensaje": ""}', 'professional'),
(2, 'ocr_pagos', false, '{}', 'enterprise');

INSERT INTO campañas (negocio_id, nombre, mensaje, segmento, estado, total_destinatarios, total_enviados) VALUES
(2, 'Bienvenida Marzo', '¡Hola! 👋 Te mandamos un saludo desde Moda Urbana. Este mes tenemos 20% en sudaderas. ¿Te interesa?', 'todos', 'completada', 5, 5);

INSERT INTO analytics_diario (negocio_id, fecha, total_mensajes, total_pedidos, total_ventas, tasa_conversion, tiempo_respuesta_avg) VALUES
(2, '2026-03-15', 55, 6, 680000, 10.9, 12),
(2, '2026-03-16', 78, 8, 920000, 10.3, 10),
(2, '2026-03-17', 45, 5, 490000, 11.1, 14);

-- ============================================
-- NEGOCIO 3: Spa "Zen Wellness"
-- Plan: enterprise
-- ============================================

INSERT INTO negocios (id, nombre, color_principal, whatsapp, email_dueno, password, 
    plan, activo, onboarding_completado, razon_social, nit, tipo_negocio, ciudad, departamento, 
    direccion, descripcion_negocio, numero_empleados, volumen_pedidos_dia, metodos_pago_activos, 
    terminos_aceptados, suscripcion_activa, bot_nombre, bot_tono, bot_bienvenida,
    horario_activo_inicio, horario_activo_fin, mensaje_fuera_horario) VALUES
(3, 'Zen Wellness Spa', '#1ABC9C', '+573003333333', 'zen@demo.co', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYGCpFdC0FUm',
    'enterprise', true, true, 'Zen Wellness Center SAS', '900555666-3', 'servicios', 
    'Cali', 'Valle del Cauca', 'Avenida 9N #10N-45, Juanambú',
    'Spa y centro de bienestar con tratamientos naturales', '6-20', '11-50', 
    '["nequi","bancolombia","efectivo","daviplata"]', true, true, 'Luna', 'formal',
    'Bienvenido a Zen Wellness. Soy Luna, tu asistente de bienestar. ¿En qué puedo ayudarte hoy?',
    '08:00:00', '20:00:00', 'Gracias por contactarnos. Nuestro horario es de 8am a 8pm. ¿Te gustaría agendar una cita para mañana?');

INSERT INTO clientes (negocio_id, nombre, whatsapp, total_pedidos, total_gastado) VALUES
(3, 'Isabella Ruiz', '+573221111111', 10, 2500000),
(3, 'Gabriel Mendoza', '+573222222222', 7, 1800000),
(3, 'Valentina Acosta', '+573223333333', 5, 1200000),
(3, 'Ricardo Peña', '+573224444444', 8, 2100000),
(3, 'Antonella Vargas', '+573225555555', 3, 750000);

INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo) VALUES
(3, 'Masaje Relajante 60min', 'Masaje corporal con aceites esenciales', 120000, 20, true),
(3, 'Tratamiento Facial', 'Limpieza profunda con productos orgánicos', 95000, 15, true),
(3, 'Masaje Deportivo 90min', 'Masaje profundo para recuperación muscular', 180000, 10, true),
(3, 'Paquete Spa Day', 'Masaje + Facial + Sauna (4 horas)', 350000, 8, true),
(3, 'Certificado Regalo', 'Vale por cualquier servicio', 50000, 50, true);

INSERT INTO pedidos (negocio_id, cliente_id, numero_pedido, estado, metodo_pago, subtotal, descuento, total, direccion_entrega, notas) VALUES
(3, 1, '#ZW-0001', 'entregado', 'nequi', 350000, 0, 350000, 'Calle 5 #100-50, Cali', 'Regalo de cumpleaños'),
(3, 2, '#ZW-0002', 'entregado', 'bancolombia', 180000, 18000, 162000, 'Avenida 8 #50-30, Cali', 'Cliente VIP'),
(3, 4, '#ZW-0003', 'en_preparacion', 'efectivo', 240000, 0, 240000, 'Carrera 100 #15-80, Cali'),
(3, 1, '#ZW-0004', 'pago_enviado', 'daviplata', 120000, 0, 120000, 'Calle 5 #100-50, Cali'),
(3, 5, '#ZW-0005', 'pendiente_pago', 'nequi', 95000, 0, 95000, 'Calle 2 #20-10, Cali');

INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 4, 1, 350000, 350000),
(2, 3, 1, 180000, 180000),
(3, 1, 2, 120000, 240000),
(4, 1, 1, 120000, 120000),
(5, 2, 1, 95000, 95000);

INSERT INTO suscripciones (negocio_id, plan, estado, trial_inicio, trial_fin, pago_inicio, pago_fin, monto_mensual) VALUES
(3, 'enterprise', 'activa', '2026-01-01 00:00:00', '2026-01-07 00:00:00', '2026-01-07 00:00:00', '2026-04-07 00:00:00', 499000);

INSERT INTO automatizaciones_config (negocio_id, tipo, activa, config, plan_requerido) VALUES
(3, 'recordatorio_pago', true, '{"minutos": 60, "mensaje": "Tu reserva te espera. Confirma tu pago para garantizar tu cita"}', 'starter'),
(3, 'reengagement', true, '{"dias": 30, "mensaje": "Ha pasado un tiempo desde tu última visita. ¿Te extrañamos! Usa 15% en tu próximo servicio"}', 'professional'),
(3, 'stock_bajo', true, '{"umbral": 3, "email_alerta": true}', 'starter'),
(3, 'reporte_semanal', true, '{"dia": "lunes", "hora": "07:00", "metricas": ["ventas", "pedidos", "top_producto", "nuevos_clientes"]}', 'professional'),
(3, 'campaña_masiva', true, '{"segmento": "inactivos", "mensaje": "Te extrañamos en Zen Wellness 🌿 Reserva y recibe 20% de descuento"}', 'professional'),
(3, 'ocr_pagos', true, '{"tolerancia": 500}', 'enterprise');

INSERT INTO campañas (negocio_id, nombre, mensaje, segmento, estado, fecha_envio, total_destinatarios, total_enviados, total_fallidos) VALUES
(3, 'San Valentin', '💕 Promociones de San Valentín en Zen Wellness. 25% en masajes para parejas.', 'todos', 'completada', '2026-02-14 09:00:00', 5, 5, 0),
(3, 'Recupera Clientes', '🌿 Te extrañamos. Reserva tu tratamiento favorito con 15% de descuento.', 'inactivos', 'completada', '2026-03-10 10:00:00', 2, 2, 0);

INSERT INTO analytics_diario (negocio_id, fecha, total_mensajes, total_pedidos, total_ventas, tasa_conversion, tiempo_respuesta_avg) VALUES
(3, '2026-03-15', 25, 3, 750000, 12.0, 8),
(3, '2026-03-16', 32, 4, 980000, 12.5, 6),
(3, '2026-03-17', 18, 2, 480000, 11.1, 10);

-- ============================================
-- ACTUALIZAR ÚLTIMO PEDIDO DE CLIENTES
-- ============================================

UPDATE clientes SET ultimo_pedido = NOW() - INTERVAL 2 DAY WHERE negocio_id = 1;
UPDATE clientes SET ultimo_pedido = NOW() - INTERVAL 1 DAY WHERE negocio_id = 2;
UPDATE clientes SET ultimo_pedido = NOW() - INTERVAL 3 DAY WHERE negocio_id = 3;

-- ============================================
-- CONVERSACIONES DE EJEMPLO
-- ============================================

INSERT INTO conversaciones (negocio_id, cliente_id, mensajes, intencion_detectada, activa) VALUES
(1, 1, 
 '[{"rol":"cliente","contenido":"Hola, quiero pedir una bandeja paisa","timestamp":"2026-03-17T12:00:00Z"},{"rol":"bot","contenido":"¡Hola! Perfecto, la Bandeja Paisa está a $28.000. ¿Para cuántas personas?","timestamp":"2026-03-17T12:00:05Z"},{"rol":"cliente","contenido":"Para 2 personas por favor","timestamp":"2026-03-17T12:01:00Z"}]',
 'pedido', true),
(2, 2,
 '[{"rol":"cliente","contenido":"Qué tallas tienen de jeans?","timestamp":"2026-03-17T15:00:00Z"},{"rol":"bot","contenido":"¡Hola! Tenemos disponibles en tallas 28 a 36. ¿Cuál usas?","timestamp":"2026-03-17T15:00:03Z"}]',
 'consulta_producto', true),
(3, 1,
 '[{"rol":"cliente","contenido":"Hola, quiero agendar un spa day","timestamp":"2026-03-17T10:00:00Z"},{"rol":"bot","contenido":"¡Bienvenida a Zen Wellness! El Paquete Spa Day incluye Massage + Facial + Sauna por $350.000. ¿Qué fecha te gustaría?","timestamp":"2026-03-17T10:00:08Z"}]',
 'pedido', true);
