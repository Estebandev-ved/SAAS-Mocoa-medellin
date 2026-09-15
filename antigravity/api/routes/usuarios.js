const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../../db/config');
const { verificarAuth } = require('../middleware/auth');

router.use(verificarAuth);

// GET /api/usuarios - Listar usuarios del negocio
router.get('/', async (req, res) => {
    try {
        const [usuarios] = await db.execute(
            'SELECT id, nombre, email, rol, activo, ultimo_login, created_at FROM usuarios WHERE negocio_id = ? ORDER BY created_at DESC',
            [req.negocioId]
        );
        res.json(usuarios);
    } catch (error) {
        console.error('[Usuarios] Error listando:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// POST /api/usuarios - Agregar usuario
router.post('/', async (req, res) => {
    try {
        const { nombre, email, password, rol } = req.body;

        if (!nombre || !email || !password) {
            return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
        }

        const validRoles = ['admin', 'editor', 'viewer'];
        const userRol = validRoles.includes(rol) ? rol : 'viewer';

        // Check plan limits
        const [negocios] = await db.execute('SELECT plan FROM negocios WHERE id = ?', [req.negocioId]);
        const plan = negocios[0]?.plan || 'starter';

        const [count] = await db.execute(
            'SELECT COUNT(*) as total FROM usuarios WHERE negocio_id = ?',
            [req.negocioId]
        );
        const totalUsuarios = count[0].total + 1; // +1 for owner

        const LIMITES = { starter: 1, professional: 5, enterprise: 999 };
        if (totalUsuarios > LIMITES[plan]) {
            return res.status(403).json({
                error: `Tu plan ${plan} permite máximo ${LIMITES[plan]} usuario(s). Actualiza tu plan para agregar más.`
            });
        }

        // Check duplicate email within business
        const [existe] = await db.execute(
            'SELECT id FROM usuarios WHERE email = ? AND negocio_id = ?',
            [email, req.negocioId]
        );
        if (existe.length > 0) {
            return res.status(400).json({ error: 'Ya existe un usuario con ese email en tu negocio' });
        }

        const passwordHash = bcrypt.hashSync(password, 12);

        const [result] = await db.execute(
            'INSERT INTO usuarios (negocio_id, nombre, email, password, rol) VALUES (?, ?, ?, ?, ?)',
            [req.negocioId, nombre, email, passwordHash, userRol]
        );

        console.log(`[Usuarios] Usuario creado: ${nombre} (${email}) rol: ${userRol} en negocio ${req.negocioId}`);

        res.status(201).json({
            id: result.insertId,
            nombre,
            email,
            rol: userRol,
            activo: 1
        });
    } catch (error) {
        console.error('[Usuarios] Error creando:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// PUT /api/usuarios/:id - Editar usuario
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, email, password, rol, activo } = req.body;

        // Verify user belongs to this business
        const [existe] = await db.execute(
            'SELECT id FROM usuarios WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );
        if (existe.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const updates = [];
        const values = [];

        if (nombre) { updates.push('nombre = ?'); values.push(nombre); }
        if (email) { updates.push('email = ?'); values.push(email); }
        if (password) { updates.push('password = ?'); values.push(bcrypt.hashSync(password, 12)); }
        if (rol && ['admin', 'editor', 'viewer'].includes(rol)) { updates.push('rol = ?'); values.push(rol); }
        if (activo !== undefined) { updates.push('activo = ?'); values.push(activo ? 1 : 0); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No hay campos para actualizar' });
        }

        values.push(id, req.negocioId);
        await db.execute(
            `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ? AND negocio_id = ?`,
            values
        );

        res.json({ success: true, mensaje: 'Usuario actualizado' });
    } catch (error) {
        console.error('[Usuarios] Error actualizando:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// DELETE /api/usuarios/:id - Eliminar usuario
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [existe] = await db.execute(
            'SELECT id, email FROM usuarios WHERE id = ? AND negocio_id = ?',
            [id, req.negocioId]
        );
        if (existe.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Don't allow deleting yourself
        if (existe[0].email === req.email) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        await db.execute('DELETE FROM usuarios WHERE id = ? AND negocio_id = ?', [id, req.negocioId]);

        console.log(`[Usuarios] Usuario eliminado: ${existe[0].email} del negocio ${req.negocioId}`);

        res.json({ success: true, mensaje: 'Usuario eliminado' });
    } catch (error) {
        console.error('[Usuarios] Error eliminando:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

module.exports = router;
