-- Migración: Configuración de Voice Bot
-- Agrega tablas para configuración de llamadas y voces

-- Configuración de Voice Bot por negocio
CREATE TABLE IF NOT EXISTS voice_bot_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    habilitado BOOLEAN DEFAULT FALSE,
    
    -- Configuración Twilio
    twilio_account_sid VARCHAR(255),
    twilio_auth_token VARCHAR(255),
    twilio_phone_number VARCHAR(50),
    
    -- Configuración de voz
    default_voice_id VARCHAR(100),
    language VARCHAR(10) DEFAULT 'es',
    temperature DECIMAL(3,2) DEFAULT 0.80,
    speed DECIMAL(3,2) DEFAULT 1.00,
    
    -- Configuración de llamadas
    max_call_duration INT DEFAULT 300, -- segundos
    greeting_message TEXT DEFAULT '¡Hola! Soy tu asistente virtual. ¿Qué desea ordenar?',
    farewell_message TEXT DEFAULT '¡Gracias por llamar! ¡Hasta pronto!',
    no_response_message TEXT DEFAULT 'No te escuché bien, ¿puedes repetir?',
    
    -- Horarios
    activo_horario BOOLEAN DEFAULT TRUE,
    
    -- Límites mensuales (Enterprise)
    llamadas_mes INT DEFAULT 0,
    minutos_mes INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    UNIQUE KEY unique_negocio (negocio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historial de llamadas
CREATE TABLE IF NOT EXISTS voice_calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    call_sid VARCHAR(255) UNIQUE,
    
    -- Datos de la llamada
    caller_phone VARCHAR(50),
    callee_phone VARCHAR(50),
    
    -- Estado
    status ENUM('ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer') DEFAULT 'ringing',
    direction ENUM('inbound', 'outbound') DEFAULT 'inbound',
    
    -- Duración
    start_time TIMESTAMP NULL,
    answer_time TIMESTAMP NULL,
    end_time TIMESTAMP NULL,
    duration_seconds INT DEFAULT 0,
    
    -- Datos de la conversación
    transcript JSON, -- Historial de voz → texto
    audio_url TEXT, -- URL del audio grabado
    
    -- Resultado
    converted_to_order BOOLEAN DEFAULT FALSE,
    order_id INT NULL,
    client_id INT NULL,
    
    -- Métricas
    satisfaction_rating INT NULL, -- 1-5
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES pedidos(id) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES clientes(id) ON DELETE SET NULL,
    INDEX idx_negocio (negocio_id),
    INDEX idx_fecha (created_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Voces personalizadas por negocio
CREATE TABLE IF NOT EXISTS voice_custom_voices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    negocio_id INT NOT NULL,
    voice_id VARCHAR(100), -- ID en Clonar-voz
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    audio_url TEXT,
    duracion DECIMAL(5,2),
    
    -- Uso
    es_default BOOLEAN DEFAULT FALSE,
    total_usos INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (negocio_id) REFERENCES negocios(id) ON DELETE CASCADE,
    INDEX idx_negocio (negocio_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agregar voz de referencia al negocio si no existe
ALTER TABLE negocios 
ADD COLUMN IF NOT EXISTS voice_bot_enabled BOOLEAN DEFAULT FALSE AFTER instagram_token,
ADD COLUMN IF NOT EXISTS voice_bot_phone VARCHAR(50) AFTER voice_bot_enabled;

-- Índices para búsquedas rápidas
CREATE INDEX idx_calls_negocio_fecha ON voice_calls(negocio_id, created_at);
CREATE INDEX idx_calls_status ON voice_calls(status);
