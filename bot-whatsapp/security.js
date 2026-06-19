/**
 * 🔒 Security Module - Bot NOMA WhatsApp
 * Rate limiting, spam detection, and message validation.
 */

// Rate limiting per user
const rateLimits = new Map();
const blockedNumbers = new Set();
const spamPatterns = [
    /(.)\1{10,}/,  // Repeated characters
    /(https?:\/\/[^\s]+){3,}/i,  // Multiple URLs
    /\b(viagra|casino|lottery|free money|click here|urgent|winner)\b/i,  // Spam keywords
];

const config = {
    maxMessagesPerMinute: 10,
    maxMessagesPerHour: 60,
    minMessageInterval: 1000,  // 1 second minimum between messages
    maxMessageLength: 1000,
    tempBlockDuration: 15 * 60 * 1000,  // 15 minutes
    spamThreshold: 3,  // Spam detections before block
};

// Track spam violations
const spamViolations = new Map();

/**
 * Check if a number is blocked
 */
function isBlocked(remoteJid) {
    return blockedNumbers.has(remoteJid);
}

/**
 * Block a number temporarily
 */
function blockNumber(remoteJid, reason) {
    blockedNumbers.add(remoteJid);
    console.log(`🚫 Bloqueado: ${remoteJid} - Razón: ${reason}`);
    
    // Auto-unblock after duration
    setTimeout(() => {
        blockedNumbers.delete(remoteJid);
        console.log(`✅ Desbloqueado automáticamente: ${remoteJid}`);
    }, config.tempBlockDuration);
}

/**
 * Check rate limit for a user
 * Returns { allowed: boolean, message: string }
 */
function checkRateLimit(remoteJid) {
    const now = Date.now();
    
    if (!rateLimits.has(remoteJid)) {
        rateLimits.set(remoteJid, {
            timestamps: [],
            lastMessage: 0,
        });
    }
    
    const userData = rateLimits.get(remoteJid);
    
    // Check minimum interval
    if (now - userData.lastMessage < config.minMessageInterval) {
        return {
            allowed: false,
            message: '⚠️ Por favor espera un momento antes de enviar otro mensaje.',
        };
    }
    
    // Clean old timestamps (older than 1 hour)
    userData.timestamps = userData.timestamps.filter(
        t => now - t < 60 * 60 * 1000
    );
    
    // Check hourly limit
    if (userData.timestamps.length >= config.maxMessagesPerHour) {
        return {
            allowed: false,
            message: '⚠️ Has enviado demasiados mensajes. Intenta de nuevo en una hora.',
        };
    }
    
    // Check per-minute limit
    const lastMinuteMessages = userData.timestamps.filter(
        t => now - t < 60 * 1000
    ).length;
    
    if (lastMinuteMessages >= config.maxMessagesPerMinute) {
        return {
            allowed: false,
            message: '⚠️ Estás enviando mensajes muy rápido. Espera un momento.',
        };
    }
    
    // Record this message
    userData.timestamps.push(now);
    userData.lastMessage = now;
    
    return { allowed: true, message: null };
}

/**
 * Validate message content
 * Returns { valid: boolean, message: string, sanitized: string }
 */
function validateMessage(text, remoteJid) {
    if (!text || typeof text !== 'string') {
        return { valid: false, message: 'Mensaje vacío', sanitized: '' };
    }
    
    // Check length
    if (text.length > config.maxMessageLength) {
        return {
            valid: false,
            message: '⚠️ El mensaje es demasiado largo. Máximo 1000 caracteres.',
            sanitized: '',
        };
    }
    
    // Check for spam patterns
    for (const pattern of spamPatterns) {
        if (pattern.test(text)) {
            // Record spam violation
            const violations = (spamViolations.get(remoteJid) || 0) + 1;
            spamViolations.set(remoteJid, violations);
            
            if (violations >= config.spamThreshold) {
                blockNumber(remoteJid, 'Múltiples mensajes de spam detectados');
                return {
                    valid: false,
                    message: '🚫 Tu número ha sido bloqueado temporalmente por enviar spam.',
                    sanitized: '',
                };
            }
            
            return {
                valid: false,
                message: '⚠️ Tu mensaje parece spam. Por favor, envía un mensaje normal.',
                sanitized: '',
            };
        }
    }
    
    // Sanitize: trim and limit
    const sanitized = text.trim().substring(0, config.maxMessageLength);
    
    return { valid: true, message: null, sanitized };
}

/**
 * Main security check - call this before processing messages
 * Returns { allowed: boolean, message: string, sanitizedText: string }
 */
function securityCheck(remoteJid, text) {
    // Check if blocked
    if (isBlocked(remoteJid)) {
        return {
            allowed: false,
            message: '🚫 Tu número está bloqueado temporalmente. Intenta más tarde.',
            sanitizedText: '',
        };
    }
    
    // Check rate limit
    const rateResult = checkRateLimit(remoteJid);
    if (!rateResult.allowed) {
        return {
            allowed: false,
            message: rateResult.message,
            sanitizedText: '',
        };
    }
    
    // Validate message
    const validationResult = validateMessage(text, remoteJid);
    if (!validationResult.valid) {
        return {
            allowed: false,
            message: validationResult.message,
            sanitizedText: '',
        };
    }
    
    return {
        allowed: true,
        message: null,
        sanitizedText: validationResult.sanitized,
    };
}

/**
 * Get security statistics
 */
function getSecurityStats() {
    return {
        blockedNumbers: Array.from(blockedNumbers),
        activeRateLimits: rateLimits.size,
        spamViolationsCount: spamViolations.size,
    };
}

/**
 * Manually unblock a number
 */
function unblockNumber(remoteJid) {
    blockedNumbers.delete(remoteJid);
    spamViolations.delete(remoteJid);
    console.log(`✅ Desbloqueado manualmente: ${remoteJid}`);
}

module.exports = {
    securityCheck,
    isBlocked,
    blockNumber,
    unblockNumber,
    checkRateLimit,
    validateMessage,
    getSecurityStats,
    config,
};
