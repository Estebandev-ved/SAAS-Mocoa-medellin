-- ============================================
-- MIGRACIÓN DE DOMICILIOS & TRACKING (Antigravity v3)
-- ============================================

USE `antigravity`;

-- 1. Tabla de Domiciliarios (Conductores de cada negocio)
CREATE TABLE IF NOT EXISTS `domiciliarios` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `negocio_id` INT NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `telefono` VARCHAR(20) NOT NULL, -- Usado para login
    `clave_pin` VARCHAR(255) NOT NULL, -- PIN / Contraseña encriptada
    `latitud` DECIMAL(10, 8) NULL,
    `longitud` DECIMAL(11, 8) NULL,
    `estado_activo` BOOLEAN DEFAULT FALSE, -- Online / Offline
    `activo` BOOLEAN DEFAULT TRUE, -- Soft delete
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`negocio_id`) REFERENCES `negocios`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_negocio_telefono` (`negocio_id`, `telefono`),
    INDEX `idx_negocio_domiciliario` (`negocio_id`, `estado_activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabla de Domicilios (Seguimiento de despachos por pedido)
CREATE TABLE IF NOT EXISTS `domicilios` (
    `id` INT AUTO_INCREMENT,
    `negocio_id` INT NOT NULL,
    `pedido_id` INT NOT NULL,
    `domiciliario_id` INT NULL,
    `estado` ENUM('pendiente', 'aceptado', 'en_ruta', 'entregado', 'cancelado') DEFAULT 'pendiente',
    `km_recorridos` DECIMAL(5, 2) DEFAULT 0.00,
    `tiempo_minutos` INT DEFAULT 0,
    `tarifa_envio` DECIMAL(10, 2) DEFAULT 0.00,
    `tracking_token` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_pedido_id` (`pedido_id`),
    UNIQUE KEY `uk_tracking_token` (`tracking_token`),
    FOREIGN KEY (`negocio_id`) REFERENCES `negocios`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`pedido_id`) REFERENCES `pedidos`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`domiciliario_id`) REFERENCES `domiciliarios`(`id`) ON DELETE SET NULL,
    INDEX `idx_negocio_domicilio` (`negocio_id`, `estado`),
    INDEX `idx_tracking_token` (`tracking_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Crear Domiciliario de Prueba para negocio_id = 1 (Tienda Ejemplo)
-- Teléfono: 3001234567, PIN: 1234
-- Hash generado de '1234' usando bcrypt
INSERT IGNORE INTO `domiciliarios` (`id`, `negocio_id`, `nombre`, `telefono`, `clave_pin`, `estado_activo`) VALUES
(1, 1, 'Juan Repartidor', '3001234567', '$2b$10$dHqf9eDkYObHqomw4L4YMudkuYJfGE6uOYrM26M8rAu5qTsbNv33i', FALSE);
