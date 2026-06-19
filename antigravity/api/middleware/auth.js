const jwt = require('jsonwebtoken');
const db = require('../../db/config');

async function verificarAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader) {
            return res.status(401).json({
                error: 'No se proporcionó token de autenticación',
                codigo: 'SIN_TOKEN'
            });
        }
        
        if (!authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'Formato de token inválido. Usa: Bearer <token>',
                codigo: 'FORMATO_INVALIDO'
            });
        }
        
        const token = authHeader.substring(7);
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'antigravity_secret_key');
        
        const [negocios] = await db.execute(
            `SELECT id, nombre, email_dueno as email, plan, activo, suscripcion_activa, 
             whatsapp_conectado, bot_nombre, bot_tono, bot_bienvenida,
             color_principal, numero_nequi, numero_bancolombia, rol
             FROM negocios WHERE id = ?`,
            [decoded.negocio_id]
        );
        
        if (negocios.length === 0) {
            return res.status(401).json({
                error: 'Negocio no encontrado',
                codigo: 'NEGOCIO_NO_EXISTE'
            });
        }
        
        const negocio = negocios[0];
        
        if (!negocio.activo) {
            return res.status(403).json({
                error: 'Tu cuenta está deshabilitada',
                codigo: 'CUENTA_DESABILITADA'
            });
        }
        
		req.negocio = {
            id: negocio.id,
            nombre: negocio.nombre,
            plan: negocio.plan,
            email: negocio.email,
            activo: negocio.activo,
            suscripcion_activa: negocio.suscripcion_activa,
            whatsapp_conectado: negocio.whatsapp_conectado,
            bot_nombre: negocio.bot_nombre,
            bot_tono: negocio.bot_tono,
            bot_bienvenida: negocio.bot_bienvenida,
            color_principal: negocio.color_principal,
            numero_nequi: negocio.numero_nequi,
            numero_bancolombia: negocio.numero_bancolombia,
            rol: negocio.rol || 'negocio'
        };
        
        req.negocioId = negocio.id;
        
        next();
        
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Token expirado',
                codigo: 'TOKEN_EXPIRADO'
            });
        }
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                error: 'Token inválido',
                codigo: 'TOKEN_INVALIDO'
            });
        }
        
        return res.status(401).json({
            error: 'Error de autenticación',
            codigo: 'AUTH_ERROR'
        });
    }
}

function generarToken(negocio) {
    const payload = {
        negocio_id: negocio.id,
        nombre: negocio.nombre,
        plan: negocio.plan,
        email: negocio.email,
        rol: negocio.rol || 'negocio'
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'antigravity_secret_key', {
        expiresIn: '7d'
    });
    
    return token;
}

function verificarRol(rolesPermitidos) {
    return (req, res, next) => {
        if (!req.negocio) {
            return res.status(403).json({
                error: 'No autorizado',
                codigo: 'SIN_AUTORIZACION'
            });
        }
        
        if (rolesPermitidos.includes(req.negocio.plan)) {
            return next();
        }
        
        return res.status(403).json({
            error: 'No tienes permisos para esta acción',
            codigo: 'PERMISOS_INSUFICIENTES'
        });
    };
}

module.exports = {
    verificarAuth,
    generarToken,
    verificarRol
};
