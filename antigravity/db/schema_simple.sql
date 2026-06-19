-- ANTIGRAVITY Database Schema

CREATE DATABASE IF NOT EXISTS antigravity CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE antigravity;

CREATE TABLE IF NOT EXISTS negocios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    color_principal VARCHAR(7) DEFAULT '#00D9FF',
    logo_url VARCHAR(255),
    whatsapp VARCHAR(20),
    email_dueno VARCHAR(100),
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
    terminos_fecha TIMESTAMP NULL,
    onboarding_completado BOOLEAN DEFAULT false,
    onboarding_paso INT DEFAULT 1,
    trial_hasta TIMESTAMP NULL,
    suscripcion_activa BOOLEAN DEFAULT false,
    suscripcion_inicio TIMESTAMP NULL,
    suscripcion_fin TIMESTAMP NULL,
    stripe_customer_id VARCHAR(100),
    token_reset_password VARCHAR(255),
    token_reset_expiry TIMESTAMP NULL,
    ultimo_login TIMESTAMP NULL,
    ip_ultimo_login VARCHAR(45),
    intentos_login_fallidos INT DEFAULT 0,
    cuenta_bloqueada BOOLEAN DEFAULT false,
    plan ENUM('starter', 'professional', 'enterprise') DEFAULT 'starter',
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_activo (activo),
    INDEX idx_whatsapp (whatsapp),
    INDEX idx_email (email_dueno)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sesiones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    token_hash VARCHAR(255),
    ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    activa BOOLEAN DEFAULT true,
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB;

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

-- Datos de prueba
INSERT INTO negocios (id, nombre, color_principal, whatsapp, email_dueno, password, plan, activo, onboarding_completado, razon_social, nit, tipo_negocio, ciudad, departamento, direccion, descripcion_negocio, numero_empleados, volumen_pedidos_dia, metodos_pago_activos, terminos_aceptados, suscripcion_activa) VALUES
(1, 'Tienda Ejemplo Colombia', '#00D9FF', '+573001234567', 'demo@antigravity.co', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYGCpFdC0FUm', 'professional', true, true, 'Tienda Ejemplo Colombia SAS', '900123456-7', 'retail', 'Bogotá', 'Cundinamarca', 'Calle 123 #45-67, Bogotá', 'Tienda de ejemplo para pruebas del sistema ANTIGRAVITY', '2-5', '11-50', '["nequi","bancolombia","efectivo"]', true, true);

INSERT INTO clientes (negocio_id, nombre, whatsapp, total_pedidos, total_gastado) VALUES
(1, 'Juan Pérez', '+573101234567', 5, 450000),
(1, 'María García', '+573102345678', 3, 280000),
(1, 'Carlos López', '+573103456789', 2, 150000);

INSERT INTO productos (negocio_id, nombre, descripcion, precio, stock, activo) VALUES
(1, 'Camiseta Básica', 'Camiseta de algodón, colores varios', 35000, 50, true),
(1, 'Pantalón Jean', 'Jean clásico azul/n negro', 89000, 30, true),
(1, 'Zapatillas Sport', 'Zapatillas cómodas para diario', 120000, 25, true),
(1, 'Gorra Urbana', 'Gorra ajustable, color negro', 25000, 100, true),
(1, 'Chaqueta de Cuero', 'Chaqueta elegante de cuero sintético', 250000, 10, true);

INSERT INTO pedidos (negocio_id, cliente_id, numero_pedido, estado, metodo_pago, subtotal, descuento, total, direccion_entrega) VALUES
(1, 1, '#AG-0001', 'entregado', 'nequi', 120000, 0, 120000, 'Calle 123 #45-67, Bogotá'),
(1, 1, '#AG-0002', 'enviado', 'bancolombia', 175000, 5000, 170000, 'Calle 123 #45-67, Bogotá'),
(1, 2, '#AG-0003', 'en_preparacion', 'nequi', 89000, 0, 89000, 'Carrera 78 #12-34, Medellín'),
(1, 3, '#AG-0004', 'pago_enviado', 'bold', 35000, 0, 35000, 'Avenida 5 #10-20, Cali'),
(1, 2, '#AG-0005', 'pendiente_pago', 'efectivo', 250000, 25000, 225000, 'Calle 90 #11-22, Bogotá');

INSERT INTO items_pedido (pedido_id, producto_id, cantidad, precio_unitario, subtotal) VALUES
(1, 3, 1, 120000, 120000),
(2, 1, 2, 35000, 70000),
(2, 4, 1, 25000, 25000),
(2, 2, 1, 89000, 89000),
(3, 2, 1, 89000, 89000),
(4, 1, 1, 35000, 35000),
(5, 5, 1, 250000, 250000);
