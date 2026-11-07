const test = require('node:test');
const assert = require('node:assert');
const F = require('../../api/services/flujos');
const Motor = require('../../api/services/flujosMotor');
const { simular } = require('../../api/services/flujosSimulador');

test('urlPublicaSegura: acepta https públicas y rechaza la red interna y formas raras', () => {
    assert.strictEqual(F.urlPublicaSegura('https://mitienda.co/fotos/camisa.jpg'), 'https://mitienda.co/fotos/camisa.jpg');
    for (const mala of [
        'http://mitienda.co/a.jpg', 'ftp://x.co/a.jpg', 'javascript:alert(1)', 'https://localhost/a.jpg', 'https://127.0.0.1/a.jpg',
        'https://10.0.0.5/a.jpg', 'https://192.168.1.2/a.jpg', 'https://172.20.0.1/a.jpg', 'https://169.254.169.254/latest/meta-data',
        'https://2130706433/a.jpg', 'https://[::1]/a.jpg', 'https://servicio.internal/a.jpg', 'https://usuario:clave@mitienda.co/a.jpg',
        'https://intranet/a.jpg', '', null, 'no es una url',
    ]) assert.strictEqual(F.urlPublicaSegura(mala), '', String(mala));
    assert.strictEqual(F.urlPublicaSegura('https://8.8.8.8/a.jpg'), 'https://8.8.8.8/a.jpg');
    assert.strictEqual(F.urlPublicaSegura('https://172.32.0.1/a.jpg'), 'https://172.32.0.1/a.jpg');   // fuera del rango privado 172.16-31
});

const flujoConImagen = (url) => ({
    nodos: [
        { id: 'a', tipo: 'disparador', x: 0, y: 0, config: { modo: 'palabra', palabra: 'FOTO' } },
        { id: 'b', tipo: 'imagen', x: 200, y: 0, config: { url, texto: 'Mira, {nombre}: así queda 😍' } },
    ],
    conexiones: [{ desde: 'a', salida: 'default', hacia: 'b' }],
});

test('paso imagen: guarda solo una URL segura, exige la dirección para encender y el motor la envía con su texto', () => {
    const bueno = F.validarDefinicion(flujoConImagen('https://mitienda.co/camisa.jpg')).definicion;
    assert.strictEqual(F.validarParaActivar(bueno), null);
    const r = Motor.iniciar(bueno, { nombre: 'Ana', etiquetas: [] });
    assert.deepStrictEqual(r.acciones[0], { tipo: 'enviar', texto: 'Mira, Ana: así queda 😍', imagen: 'https://mitienda.co/camisa.jpg' });

    const malo = F.validarDefinicion(flujoConImagen('http://192.168.0.9/x.jpg')).definicion;
    assert.strictEqual(malo.nodos[1].config.url, '');
    assert.match(F.validarParaActivar(malo), /imagen/i);
});

test('simulador: muestra la imagen y prueba el disparador "comentario en Instagram" con el texto del comentario', () => {
    const r = simular({ definicion: flujoConImagen('https://mitienda.co/camisa.jpg'), modo: 'mensaje', texto: 'foto' });
    assert.match(r.mensajes[0].texto, /🖼️ \[Imagen: https:\/\/mitienda\.co\/camisa\.jpg\]/);

    const comentario = flujoConImagen('https://mitienda.co/camisa.jpg');
    comentario.nodos[0].config = { modo: 'comentario_instagram', palabra: 'QUIERO', respuestas: 'Listo' };
    const no = simular({ definicion: comentario, modo: 'mensaje', texto: 'qué bonito' });
    assert.match(no.mensajes[0].texto, /no inicia/i);
    const si = simular({ definicion: comentario, modo: 'mensaje', texto: 'Yo quiero uno!' });
    assert.match(si.mensajes[0].texto, /Imagen/);
});
