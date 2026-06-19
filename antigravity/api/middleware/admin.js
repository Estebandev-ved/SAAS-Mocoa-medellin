const db = require('../../db/config');

async function verificarAdmin(req, res, next) {
    try {
        if (!req.negocio) {
            return res.status(401).json({
                error: 'No autenticado',
                codigo: 'SIN_AUTENTICACION'
            });
        }

        if (req.negocio.rol !== 'admin' && req.negocio.rol !== 'superadmin') {
            return res.status(403).json({
                error: 'Acceso denegado. Se requiere rol de administrador.',
                codigo: 'ACCESO_DENEGADO'
            });
        }

        next();
    } catch (error) {
        console.error('[AdminMiddleware] Error:', error);
        res.status(500).json({
            error: 'Error al verificar permisos de admin',
            codigo: 'ERROR_ADMIN'
        });
    }
}

module.exports = {
    verificarAdmin
};
