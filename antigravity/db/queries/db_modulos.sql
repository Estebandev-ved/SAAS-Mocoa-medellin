-- ============================================
-- MIGRACIÓN DE MÓDULOS SAAS (Antigravity v3)
-- ============================================

USE `antigravity`;

-- 1. Tabla de Control de Módulos Activos por Negocio
CREATE TABLE IF NOT EXISTS `negocio_modulos` (
    `negocio_id` INT NOT NULL,
    `modulo_name` ENUM('inventario', 'facturacion', 'crm', 'reportes', 'agenda_citas', 'catalogo', 'domicilios', 'pagos') NOT NULL,
    `activo` BOOLEAN DEFAULT TRUE,
    `config` JSON NULL, -- Configuración específica (ej, límites, credenciales, etc.)
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`negocio_id`, `modulo_name`),
    FOREIGN KEY (`negocio_id`) REFERENCES `negocios`(`id`) ON DELETE CASCADE,
    INDEX `idx_negocio_modulos` (`negocio_id`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Módulo Agenda y Citas: Tabla de Horarios de Atención del Negocio
CREATE TABLE IF NOT EXISTS `horarios_atencion` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `negocio_id` INT NOT NULL,
    `dia_semana` ENUM('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo') NOT NULL,
    `hora_apertura` TIME NOT NULL,
    `hora_cierre` TIME NOT NULL,
    `duracion_intervalo_minutos` INT DEFAULT 30, -- Duración promedio de una cita
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`negocio_id`) REFERENCES `negocios`(`id`) ON DELETE CASCADE,
    UNIQUE KEY `uk_negocio_dia` (`negocio_id`, `dia_semana`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Módulo Agenda y Citas: Tabla de Registro de Citas / Reservas
CREATE TABLE IF NOT EXISTS `citas` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `negocio_id` INT NOT NULL,
    `cliente_id` INT NOT NULL,
    `fecha_hora` DATETIME NOT NULL,
    `estado` ENUM('pendiente', 'confirmada', 'cancelada', 'completada') DEFAULT 'pendiente',
    `notas` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`negocio_id`) REFERENCES `negocios`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE CASCADE,
    INDEX `idx_negocio_citas` (`negocio_id`, `fecha_hora`),
    INDEX `idx_cliente_citas` (`cliente_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Insertar Módulos por Defecto para el Negocio de Prueba (Tienda Ejemplo Colombia, negocio_id = 1)
-- Por defecto le activamos todos los módulos principales y el de citas/domicilios
INSERT IGNORE INTO `negocio_modulos` (`negocio_id`, `modulo_name`, `activo`, `config`) VALUES
(1, 'catalogo', TRUE, '{}'),
(1, 'pagos', TRUE, '{"metodos": ["nequi", "bancolombia"]}'),
(1, 'domicilios', TRUE, '{"valor_fijo": 5000}'),
(1, 'crm', TRUE, '{}'),
(1, 'inventario', TRUE, '{"alerta_minima": 5}'),
(1, 'reportes', TRUE, '{}'),
(1, 'agenda_citas', TRUE, '{"duracion_cita_min": 30}'),
(1, 'facturacion', TRUE, '{}');

-- 5. Insertar un Horario de Atención de Prueba para negocio_id = 1
INSERT IGNORE INTO `horarios_atencion` (`negocio_id`, `dia_semana`, `hora_apertura`, `hora_cierre`) VALUES
(1, 'lunes', '08:00:00', '18:00:00'),
(1, 'martes', '08:00:00', '18:00:00'),
(1, 'miercoles', '08:00:00', '18:00:00'),
(1, 'jueves', '08:00:00', '18:00:00'),
(1, 'viernes', '08:00:00', '18:00:00'),
(1, 'sabado', '09:00:00', '14:00:00');
