-- ANTIGRAVITY Database Schema
-- Sistema de automatización por WhatsApp con IA
-- Arquitectura Multi-Tenant Completa

CREATE DATABASE IF NOT EXISTS antigravity CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE antigravity;

-- Tabla de negocios (COMPLETA con campos de Bot)
CREATE TABLE IF NOT EXISTS negocios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    color_principal VARCHAR(7) DEFAULT '#00D9FF',
    logo_url VARCHAR(255),
    whatsapp VARCHAR(20),
    email_dueno VARCHAR(100),
    -- Campos de autenticación
    password VARCHAR(255) NOT NULL,
    password_temp VARCHAR(255),
    nit VARCHAR(20),
    razon_social VARCHAR(150),
    tipo_negocio ENUM('restaurante','retail','servicios','salud','inmobiliaria','educacion','otro'),
    ciudad VARCHAR(100),
    departamento VARCHAR(100),
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    sitio_web VARCHAR(255),
    descripcion_negocio TEXT,
    numero_empleados ENUM('1','2-5','6-20','21-50','50+'),
    volumen_pedidos_dia ENUM('1-10','11-50','51-200','200+'),
    metodos_pago_activos JSON,
    numero_nequi VARCHAR(20),
    numero_bancolombia VARCHAR(20),
    terminos_aceptados BOOLEAN DEFAULT false,
    terminos_fecha TIMESTAMP,
    onboarding_completado BOOLEAN DEFAULT false,
    onboarding_paso INT DEFAULT 1,
    -- Campos de suscripción
    plan ENUM('starter', 'professional', 'enterprise') DEFAULT 'starter',
    suscripcion_activa BOOLEAN DEFAULT false,
    suscripcion_inicio TIMESTAMP,
    suscripcion_fin TIMESTAMP,
    stripe_customer_id VARCHAR(100),
    -- Campos del Bot (NUEVOS)
    bot_nombre VARCHAR(100) DEFAULT 'Asistente',
    bot_tono ENUM('formal','amigable','casual') DEFAULT 'amigable',
    bot_bienvenida TEXT,
    horario_activo_inicio TIME DEFAULT '08:00:00',
    horario_activo_fin TIME DEFAULT '22:00:00',
    mensaje_fuera_horario TEXT,
    numero_whatsapp VARCHAR(20),
    whatsapp_conectado BOOLEAN DEFAULT false,
    whatsapp_ultima_conexion TIMESTAMP,
    -- Campos de seguridad
    token_reset_password VARCHAR(255),
    token_reset_expiry TIMESTAMP,
    ultimo_login TIMESTAMP,
    ip_ultimo_login VARCHAR(45),
    intentos_login_fallidos INT DEFAULT 0,
    cuenta_bloqueada BOOLEAN DEFAULT false,
    -- Campos originales
    activo BOOLEAN DEFAULT true,
    rol ENUM('negocio', 'admin', 'superadmin') DEFAULT 'negocio',
    trial_hasta TIMESTAMP NULL COMMENT 'Igual que suscripcion_fin, alias de conveniencia',
    -- Campos de suspensión (NUEVOS)
    suspendido BOOLEAN DEFAULT false,
    suspendido_razon VARCHAR(255),
    suspended_at TIMESTAMP NULL,
    -- Campos recuperación contraseña
    reset_token_hash VARCHAR(255) NULL,
    reset_token_expires TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_activo (activo),
    INDEX idx_whatsapp (whatsapp),
    INDEX idx_email (email_dueno),
    INDEX idx_plan (plan),
    INDEX idx_suspendido (suspendido)
) ENGINE=InnoDB;

-- Tabla de suscripciones (NUEVA)
CREATE TABLE IF NOT EXISTS suscripciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    plan ENUM('starter','professional','enterprise') NOT NULL,
    estado ENUM('trial','activa','vencida','cancelada') DEFAULT 'trial',
    trial_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial_fin TIMESTAMP,
    pago_inicio TIMESTAMP,
    pago_fin TIMESTAMP,
    monto_mensual DECIMAL(10,2),
    stripe_sub_id VARCHAR(100),
    renovacion_auto BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id),
    INDEX idx_estado (estado)
) ENGINE=InnoDB;

-- Tabla de automatizaciones_config (NUEVA)
CREATE TABLE IF NOT EXISTS automatizaciones_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    activa BOOLEAN DEFAULT false,
    config JSON,
    ultima_ejecucion TIMESTAMP NULL,
    plan_requerido ENUM('starter','professional','enterprise') DEFAULT 'starter',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    UNIQUE KEY uk_negocio_tipo (negocio_id, tipo),
    INDEX idx_negocio (negocio_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB;

-- Tabla de campañas (NUEVA)
CREATE TABLE IF NOT EXISTS campañas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,
    segmento ENUM('todos','compraron_x','inactivos','nuevos') DEFAULT 'todos',
    segmento_config JSON,
    fecha_envio TIMESTAMP,
    estado ENUM('borrador','programada','enviando','completada','cancelada') DEFAULT 'borrador',
    total_destinatarios INT DEFAULT 0,
    total_enviados INT DEFAULT 0,
    total_fallidos INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id),
    INDEX idx_estado (estado),
    INDEX idx_fecha_envio (fecha_envio)
) ENGINE=InnoDB;

-- Tabla de notificaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(150),
    mensaje TEXT,
    leida BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id),
    INDEX idx_leida (leida)
) ENGINE=InnoDB;

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS sesiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    token_hash VARCHAR(255),
    ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    activa BOOLEAN DEFAULT true,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB;

-- Tabla de progreso de onboarding
CREATE TABLE IF NOT EXISTS onboarding_progress (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    paso_actual INT DEFAULT 1,
    datos_paso JSON,
    completado BOOLEAN DEFAULT false,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    UNIQUE KEY uk_negocio (negocio_id)
) ENGINE=InnoDB;

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    nombre VARCHAR(100),
    whatsapp VARCHAR(20) NOT NULL,
    total_pedidos INT DEFAULT 0,
    total_gastado DECIMAL(12,2) DEFAULT 0,
    ultimo_pedido TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    UNIQUE KEY uk_negocio_whatsapp (negocio_id, whatsapp),
    INDEX idx_negocio (negocio_id),
    INDEX idx_whatsapp (whatsapp)
) ENGINE=InnoDB;

-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    activo BOOLEAN DEFAULT true,
    imagen_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id),
    INDEX idx_activo (activo)
) ENGINE=InnoDB;

-- Tabla de pedidos
CREATE TABLE IF NOT EXISTS pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    cliente_id INT NOT NULL,
    numero_pedido VARCHAR(20) NOT NULL,
    estado ENUM('pendiente_pago', 'pago_enviado', 'pago_confirmado', 'en_preparacion', 'enviado', 'entregado', 'cancelado') DEFAULT 'pendiente_pago',
    metodo_pago ENUM('nequi', 'bancolombia', 'efectivo', 'bold', 'wompi', 'otro'),
    subtotal DECIMAL(10,2) DEFAULT 0,
    descuento DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    direccion_entrega TEXT,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    UNIQUE KEY uk_numero_pedido (numero_pedido),
    INDEX idx_negocio (negocio_id),
    INDEX idx_cliente (cliente_id),
    INDEX idx_estado (estado),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- Tabla de items de pedido
CREATE TABLE IF NOT EXISTS items_pedido (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    producto_id INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    INDEX idx_pedido (pedido_id),
    INDEX idx_producto (producto_id)
) ENGINE=InnoDB;

-- Tabla de conversaciones
CREATE TABLE IF NOT EXISTS conversaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    cliente_id INT NOT NULL,
    mensajes JSON,
    intencion_detectada VARCHAR(50),
    pedido_id INT,
    activa BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL,
    INDEX idx_negocio (negocio_id),
    INDEX idx_cliente (cliente_id),
    INDEX idx_activa (activa),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB;

-- Tabla de analytics diario
CREATE TABLE IF NOT EXISTS analytics_diario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    fecha DATE NOT NULL,
    total_mensajes INT DEFAULT 0,
    total_pedidos INT DEFAULT 0,
    total_ventas DECIMAL(12,2) DEFAULT 0,
    tasa_conversion DECIMAL(5,2) DEFAULT 0,
    tiempo_respuesta_avg INT DEFAULT 0,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    UNIQUE KEY uk_negocio_fecha (negocio_id, fecha),
    INDEX idx_negocio (negocio_id),
    INDEX idx_fecha (fecha)
) ENGINE=InnoDB;

-- Tabla de mensajes (NUEVA)
CREATE TABLE IF NOT EXISTS mensajes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    numero_cliente VARCHAR(20) NOT NULL,
    contenido TEXT NOT NULL,
    tipo ENUM('entrada', 'salida') NOT NULL,
    intencion_detectada VARCHAR(50),
    agente_proceso VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id),
    INDEX idx_numero_cliente (numero_cliente),
    INDEX idx_created_at (created_at),
    INDEX idx_tipo (tipo)
) ENGINE=InnoDB;

-- Tabla de logs de agentes IA (NUEVA)
CREATE TABLE IF NOT EXISTS agente_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    cliente_id INT,
    intencion_detectada VARCHAR(50),
    agente_utilizado VARCHAR(50),
    mensaje_entrada TEXT,
    respuesta_texto TEXT,
    tokens_usados INT DEFAULT 0,
    tiempo_respuesta_ms INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id),
    INDEX idx_agente (negocio_id, agente_utilizado),
    INDEX idx_fecha (negocio_id, created_at)
) ENGINE=InnoDB;

-- Tabla de notificaciones para escalaciones
CREATE TABLE IF NOT EXISTS notificaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    titulo VARCHAR(255),
    mensaje TEXT,
    datos JSON,
    leida BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id),
    INDEX idx_tipo (negocio_id, tipo),
    INDEX idx_leida (negocio_id, leida)
) ENGINE=InnoDB;

-- Tabla de campañas
CREATE TABLE IF NOT EXISTS campanhas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    nombre VARCHAR(255),
    mensaje TEXT NOT NULL,
    destinatarios_total INT DEFAULT 0,
   enviados INT DEFAULT 0,
    respuestas INT DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente',
    programacion TIMESTAMP NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id),
    INDEX idx_estado (negocio_id, estado)
) ENGINE=InnoDB;

-- ============================================
-- DATOS DE PRUEBA PARA negocio_id = 1
-- ============================================

-- Insertar negocio de prueba (CON password hasheado de 'Demo2024#')
-- bcrypt hash: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYGCpFdC0FUm
INSERT INTO negocios (id, nombre, color_principal, whatsapp, email_dueno, password, plan, activo, onboarding_completado, razon_social, nit, tipo_negocio, ciudad, departamento, direccion, descripcion_negocio, numero_empleados, volumen_pedidos_dia, metodos_pago_activos, terminos_aceptados, suscripcion_activa, bot_nombre, bot_tono, whatsapp_conectado, rol, trial_hasta) VALUES
(1, 'Tienda Ejemplo Colombia', '#00D9FF', '+573001234567', 'demo@antigravity.co', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYGCpFdC0FUm', 'professional', true, true, 'Tienda Ejemplo Colombia SAS', '900123456-7', 'retail', 'Bogotá', 'Cundinamarca', 'Calle 123 #45-67, Bogotá', 'Tienda de ejemplo para pruebas', '2-5', '11-50', '["nequi","bancolombia","efectivo"]', true, true, 'Asistente NOMA', 'amigable', true, 'negocio', DATE_ADD(NOW(), INTERVAL 30 DAY));

-- Usuario ADMIN para pruebas
-- Password: Admin2024#
INSERT INTO negocios (nombre, color_principal, whatsapp, email_dueno, password, plan, activo, onboarding_completado, razon_social, nit, tipo_negocio, ciudad, departamento, direccion, descripcion_negocio, numero_empleados, volumen_pedidos_dia, metodos_pago_activos, terminos_aceptados, suscripcion_activa, bot_nombre, bot_tono, whatsapp_conectado, rol) VALUES
('Administrador Antigravity', '#FFB840', '+573000000000', 'admin@antigravity.co', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYGCpFdC0FUm', 'enterprise', true, true, 'Antigravity SAS', '900000000-0', 'servicios', 'Bogotá', 'Cundinamarca', 'Calle Principal #123', 'Panel de administración del sistema', '21-50', '200+', '["nequi","bancolombia"]', true, true, 'Admin Bot', 'profesional', true, 'superadmin');

-- Insertar clientes de prueba
INSERT INTO clientes (negocio_id, nombre, whatsapp, total_pedidos, total_gastado) VALUES
(1, 'Juan Pérez', '+573101234567', 5, 450000),
(1, 'María García', '+573102345678', 3, 280000),
(1, 'Carlos López', '+573103456789', 2, 150000);

-- Insertar productos de prueba (incluye productos del bot NOMA)
INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo, imagen_url) VALUES
(1, 'Camiseta Básica', 'Camiseta de algodón, colores varios', 35000, 50, true, 'https://ejemplo.com/img/camiseta.jpg'),
(1, 'Pantalón Jean', 'Jean clásico azul/negro', 89000, 30, true, 'https://ejemplo.com/img/jean.jpg'),
(1, 'Zapatillas Sport', 'Zapatillas cómodas para diario', 120000, 25, true, 'https://ejemplo.com/img/zapatillas.jpg'),
(1, 'Gorra Urbana', 'Gorra ajustable, color negro', 25000, 100, true, 'https://ejemplo.com/img/gorra.jpg'),
(1, 'Chaqueta de Cuero', 'Chaqueta elegante de cuero sintético', 250000, 10, true, 'https://ejemplo.com/img/chaqueta.jpg'),
(1, 'Yogur Normal', 'Yogur griego artesanal 250g', 9000, 100, true, NULL),
(1, 'Yogur Grande', 'Yogur griego artesanal 500g', 18000, 50, true, NULL),
(1, 'Granola', 'Porción de granola crujiente', 5000, 80, true, NULL),
(1, 'Producto General', 'Producto por defecto para pedidos del bot', 0, 9999, true, NULL);

-- Insertar pedidos de prueba en distintos estados
INSERT INTO pedidos (negocio_id, cliente_id, numero_pedido, estado, metodo_pago, subtotal, descuento, total, direccion_entrega, notas) VALUES
(1, 1, '#AG-0001', 'entregado', 'nequi', 120000, 0, 120000, 'Calle 123 #45-67, Bogotá', 'Llamar al timbre'),
(1, 1, '#AG-0002', 'enviado', 'bancolombia', 175000, 5000, 170000, 'Calle 123 #45-67, Bogotá', NULL),
(1, 2, '#AG-0003', 'en_preparacion', 'nequi', 89000, 0, 89000, 'Carrera 78 #12-34, Medellín', 'Dejar en portería'),
(1, 3, '#AG-0004', 'pago_enviado', 'bold', 35000, 0, 35000, 'Avenida 5 #10-20, Cali', NULL),
(1, 2, '#AG-0005', 'pendiente_pago', 'efectivo', 250000, 25000, 225000, 'Calle 90 #11-22, Bogotá', 'Prueba de descuento');

-- Insertar items de pedido
INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 3, 1, 120000, 120000),
(2, 1, 2, 35000, 70000),
(2, 4, 1, 25000, 25000),
(2, 2, 1, 89000, 89000),
(3, 2, 1, 89000, 89000),
(4, 1, 1, 35000, 35000),
(5, 5, 1, 250000, 250000);

-- Actualizar ultimo_pedido para clientes
UPDATE clientes SET ultimo_pedido = NOW() - INTERVAL 1 DAY WHERE id IN (1, 2, 3);

-- Insertar conversaciones de ejemplo
INSERT INTO conversaciones (negocio_id, cliente_id, mensajes, intencion_detectada, pedido_id, activa) VALUES
(1, 1, 
 '[{"rol":"cliente","contenido":"Hola, quiero comprar unas zapatillas","timestamp":"2026-03-16T10:00:00Z"},{"rol":"bot","contenido":"¡Hola! Tenemos disponibles las Zapatillas Sport a $120.000. ¿Cuántas deseas?","timestamp":"2026-03-16T10:00:05Z"},{"rol":"cliente","contenido":"Quiero 1 par","timestamp":"2026-03-16T10:01:00Z"},{"rol":"bot","contenido":"Perfecto. Total: $120.000. ¿Cuál es tu dirección de entrega?","timestamp":"2026-03-16T10:01:10Z"}]',
 'pedido', 1, false),
(1, 2,
 '[{"rol":"cliente","contenido":"Cuánto cuesta el jean?","timestamp":"2026-03-16T14:00:00Z"},{"rol":"bot","contenido":"El Jean clásico está en $89.000","timestamp":"2026-03-16T14:00:03Z"}]',
 'consulta_precio', NULL, true);

-- Insertar analytics de ejemplo
INSERT INTO analytics_diario (negocio_id, fecha, total_mensajes, total_pedidos, total_ventas, tasa_conversion, tiempo_respuesta_avg) VALUES
(1, '2026-03-15', 45, 3, 520000, 6.67, 15),
(1, '2026-03-16', 62, 5, 890000, 8.06, 12),
(1, '2026-03-17', 28, 2, 225000, 7.14, 18);

-- Actualizar total_pedidos y total_gastado para clientes
UPDATE clientes SET total_pedidos = 5, total_gastado = 450000 WHERE id = 1;
UPDATE clientes SET total_pedidos = 3, total_gastado = 280000 WHERE id = 2;
UPDATE clientes SET total_pedidos = 2, total_gastado = 150000 WHERE id = 3;
