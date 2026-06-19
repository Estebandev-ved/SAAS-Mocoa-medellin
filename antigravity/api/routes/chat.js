const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verificarAuth } = require('../middleware/auth');
const config = require('../../config');

router.use(verificarAuth);

router.post('/mensaje', async (req, res) => {
    try {
        const { mensaje, contexto = [] } = req.body;
        const negocioId = req.negocio.id;

        // Call the brain (Python)
        const response = await axios.post(`http://localhost:${config.ports.brain}/procesar`, {
            mensaje,
            contexto,
            negocio_id: negocioId,
            cliente_id: 9999 // Mock client ID for demo
        }, { timeout: 10000 });

        res.json({
            success: true,
            data: response.data
        });

    } catch (error) {
        console.error('[Chat API] Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Error al procesar mensaje con la IA',
            details: error.message
        });
    }
});

module.exports = router;
