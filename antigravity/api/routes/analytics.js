const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { verificarAuth } = require('../middleware/auth');

function obtenerPool() {
    return mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'antigravity',
        waitForConnections: true,
        connectionLimit: 10
    });
}

router.use(verificarAuth);

router.get('/resumen', async (req, res) => {
    try {
        const db = obtenerPool();
        const negocioId = req.negocio.id;
        
        const hoy = new Date().toISOString().split('T')[0];
        const ayer = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        
        const [hoyData] = await db.execute(
            `SELECT 
                COALESCE(SUM(total), 0) as total_ventas,
                COUNT(*) as total_pedidos,
                SUM(CASE WHEN estado = 'pendiente_pago' THEN 1 ELSE 0 END) as pedidos_pendientes
             FROM pedidos 
             WHERE negocio_id = ? AND DATE(created_at) = ?`,
            [negocioId, hoy]
        );
        
        const [ayerData] = await db.execute(
            `SELECT 
                COALESCE(SUM(total), 0) as total_ventas,
                COUNT(*) as total_pedidos
             FROM pedidos 
             WHERE negocio_id = ? AND DATE(created_at) = ?`,
            [negocioId, ayer]
        );
        
        const [totalMensajes] = await db.execute(
            `SELECT COUNT(*) as total FROM conversaciones 
             WHERE negocio_id = ? AND DATE(updated_at) = ?`,
            [negocioId, hoy]
        );
        
        const [topProducto] = await db.execute(
            `SELECT pr.nombre, SUM(ip.cantidad) as cantidad_vendida, SUM(ip.subtotal) as ingresos
             FROM items_pedido ip
             JOIN productos pr ON ip.producto_id = pr.id
             JOIN pedidos p ON ip.pedido_id = p.id
             WHERE p.negocio_id = ? AND DATE(p.created_at) = ?
             GROUP BY pr.id
             ORDER BY cantidad_vendida DESC
             LIMIT 1`,
            [negocioId, hoy]
        );
        
        const ventasHoy = parseFloat(hoyData[0].total_ventas) || 0;
        const ventasAyer = parseFloat(ayerData[0].total_ventas) || 0;
        
        let cambioVentas = 0;
        if (ventasAyer > 0) {
            cambioVentas = ((ventasHoy - ventasAyer) / ventasAyer * 100).toFixed(1);
        }
        
        const pedidosHoy = parseInt(hoyData[0].total_pedidos) || 0;
        const pedidosAyer = parseInt(ayerData[0].total_pedidos) || 0;
        
        let tasaConversion = 0;
        const mensajes = parseInt(totalMensajes[0].total) || 0;
        if (mensajes > 0) {
            tasaConversion = ((pedidosHoy / mensajes) * 100).toFixed(1);
        }
        
        res.json({
            success: true,
            data: {
                hoy: {
                    total_ventas: ventasHoy,
                    total_pedidos: pedidosHoy,
                    pedidos_pendientes: parseInt(hoyData[0].pedidos_pendientes) || 0,
                    mensajes: mensajes,
                    tasa_conversion: parseFloat(tasaConversion),
                    top_producto: topProducto.length > 0 ? topProducto[0] : null
                },
                comparacion: {
                    cambio_ventas: parseFloat(cambioVentas),
                    cambio_pedidos: pedidosAyer > 0 ? 
                        ((pedidosHoy - pedidosAyer) / pedidosAyer * 100).toFixed(1) : 0,
                    ventas_ayer: ventasAyer,
                    pedidos_ayer: pedidosAyer
                }
            }
        });
        
    } catch (error) {
        console.error('[Analytics] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener resumen' });
    }
});

router.get('/ventas', async (req, res) => {
    try {
        const db = obtenerPool();
        const { periodo = 'semana' } = req.query;
        const negocioId = req.negocio.id;
        
        let dias = 7;
        if (periodo === 'mes') dias = 30;
        if (periodo === 'año') dias = 365;
        
        const fechaInicio = new Date(Date.now() - dias * 86400000).toISOString().split('T')[0];
        
        const [ventas] = await db.execute(
            `SELECT 
                DATE(created_at) as fecha,
                COALESCE(SUM(total), 0) as total_ventas,
                COUNT(*) as total_pedidos
             FROM pedidos 
             WHERE negocio_id = ? AND DATE(created_at) >= ?
             GROUP BY DATE(created_at)
             ORDER BY fecha ASC`,
            [negocioId, fechaInicio]
        );
        
        const resultado = [];
        for (let i = 0; i < dias; i++) {
            const fecha = new Date(Date.now() - (dias - 1 - i) * 86400000).toISOString().split('T')[0];
            const encontrado = ventas.find(v => v.fecha === fecha);
            
            resultado.push({
                fecha,
                total_ventas: encontrado ? parseFloat(encontrado.total_ventas) : 0,
                total_pedidos: encontrado ? parseInt(encontrado.total_pedidos) : 0
            });
        }
        
        res.json({ success: true, data: resultado, periodo });
        
    } catch (error) {
        console.error('[Analytics] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener ventas' });
    }
});

router.get('/productos', async (req, res) => {
    try {
        const db = obtenerPool();
        const negocioId = req.negocio.id;
        
        const [productos] = await db.execute(
            `SELECT 
                pr.id,
                pr.nombre,
                pr.imagen_url,
                SUM(ip.cantidad) as cantidad_vendida,
                SUM(ip.subtotal) as ingresos,
                pr.stock
             FROM items_pedido ip
             JOIN productos pr ON ip.producto_id = pr.id
             JOIN pedidos p ON ip.pedido_id = p.id
             WHERE p.negocio_id = ? AND p.estado NOT IN ('cancelado')
             GROUP BY pr.id
             ORDER BY cantidad_vendida DESC
             LIMIT 5`,
            [negocioId]
        );
        
        const totalVentas = productos.reduce((sum, p) => sum + parseFloat(p.ingresos), 0);
        
        const productosConPorcentaje = productos.map(p => ({
            ...p,
            cantidad_vendida: parseInt(p.cantidad_vendida),
            ingresos: parseFloat(p.ingresos),
            porcentaje: totalVentas > 0 ? ((p.ingresos / totalVentas) * 100).toFixed(1) : 0
        }));
        
        res.json({ success: true, data: productosConPorcentaje });
        
    } catch (error) {
        console.error('[Analytics] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener productos' });
    }
});

router.get('/clientes', async (req, res) => {
    try {
        const db = obtenerPool();
        const negocioId = req.negocio.id;
        
        const [clientes] = await db.execute(
            `SELECT 
                id, nombre, whatsapp, total_pedidos, total_gastado, ultimo_pedido, created_at
             FROM clientes 
             WHERE negocio_id = ?
             ORDER BY total_gastado DESC
             LIMIT 10`,
            [negocioId]
        );
        
        const hoy = new Date().toISOString().split('T')[0];
        const hace30dias = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
        
        const [nuevos] = await db.execute(
            `SELECT COUNT(*) as total FROM clientes 
             WHERE negocio_id = ? AND DATE(created_at) >= ?`,
            [negocioId, hace30dias]
        );
        
        const recurrentes = clientes.filter(c => c.total_pedidos > 1).length;
        
        const top3 = clientes.slice(0, 3).map(c => ({
            nombre: c.nombre,
            whatsapp: c.whatsapp,
            total_pedidos: c.total_pedidos,
            total_gastado: parseFloat(c.total_gastado)
        }));
        
        res.json({
            success: true,
            data: {
                resumen: {
                    total_clientes: clientes.length,
                    clientes_nuevos_30d: parseInt(nuevos[0].total) || 0,
                    clientes_recurrentes: recurrentes
                },
                top_clientes: top3,
                todos: clientes.map(c => ({
                    ...c,
                    total_gastado: parseFloat(c.total_gastado)
                }))
            }
        });
        
    } catch (error) {
        console.error('[Analytics] Error:', error.message);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

module.exports = router;
