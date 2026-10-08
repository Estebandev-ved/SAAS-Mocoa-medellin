const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizarWhatsapp, armarMensaje, enlaceWhatsapp, validarProspecto } = require('../../api/services/prospectos');

test('normalizarWhatsapp: celulares colombianos en varios formatos', () => {
    assert.equal(normalizarWhatsapp('300 123 4567'), '573001234567');
    assert.equal(normalizarWhatsapp('+57 300 123 4567'), '573001234567');
    assert.equal(normalizarWhatsapp('(57) 3001234567'), '573001234567');
    assert.equal(normalizarWhatsapp('0057 300 123 4567'), '573001234567');
    assert.equal(normalizarWhatsapp('573001234567'), '573001234567');
});

test('normalizarWhatsapp: rechaza basura y acepta números internacionales', () => {
    assert.equal(normalizarWhatsapp(''), null);
    assert.equal(normalizarWhatsapp(null), null);
    assert.equal(normalizarWhatsapp('abc'), null);
    assert.equal(normalizarWhatsapp('12345'), null);
    assert.equal(normalizarWhatsapp('0123456789'), null);
    assert.equal(normalizarWhatsapp('+1 305 555 0101'), '13055550101');
});

test('armarMensaje: reemplaza variables y no deja llaves a la vista', () => {
    const p = { contacto: 'María López', nombre_negocio: 'Pizzería Roma', video_url: 'https://youtu.be/abc' };
    assert.equal(armarMensaje('Hola {nombre}, hice este video para {negocio}: {video}', p),
        'Hola María, hice este video para Pizzería Roma: https://youtu.be/abc');
    assert.equal(armarMensaje('Hola {nombre}, mira {video}', { nombre_negocio: 'X' }), 'Hola, mira');
    assert.ok(!armarMensaje('{nombre}{negocio}{video}', {}).includes('{'));
});

test('enlaceWhatsapp: arma wa.me con el texto codificado, o null sin número válido', () => {
    assert.equal(enlaceWhatsapp('300 123 4567', 'Hola & chao'), 'https://wa.me/573001234567?text=Hola%20%26%20chao');
    assert.equal(enlaceWhatsapp('nope', 'Hola'), null);
});

test('validarProspecto: crear exige nombre; limpia campos y valida formatos', () => {
    assert.match(validarProspecto({}).error, /obligatorio/);
    const ok = validarProspecto({ nombre_negocio: '  Café Sol ', whatsapp: '300 111 2222', video_url: 'https://tiktok.com/@x/video/1', estado: 'video_enviado', ciudad: '' });
    assert.deepEqual(ok.datos, { nombre_negocio: 'Café Sol', whatsapp: '573001112222', video_url: 'https://tiktok.com/@x/video/1', estado: 'video_enviado', ciudad: null });
    assert.match(validarProspecto({ nombre_negocio: 'X', whatsapp: '123' }).error, /WhatsApp/);
    assert.match(validarProspecto({ nombre_negocio: 'X', video_url: 'javascript:alert(1)' }).error, /http/);
    assert.match(validarProspecto({ nombre_negocio: 'X', estado: 'raro' }).error, /Estado/);
    assert.match(validarProspecto({ nombre_negocio: 'X', proximo_seguimiento: '12/10/2026' }).error, /AAAA-MM-DD/);
});

test('validarProspecto: edición parcial solo valida lo enviado', () => {
    assert.deepEqual(validarProspecto({ estado: 'demo' }, { parcial: true }).datos, { estado: 'demo' });
    assert.match(validarProspecto({ nombre_negocio: '  ' }, { parcial: true }).error, /vacío/);
});

test('validarInteresado: formulario público', () => {
    const { validarInteresado } = require('../../api/services/prospectos');
    const ok = validarInteresado({ nombre: ' Ana ', negocio: 'Café', whatsapp: '300 123 4567', fuente: 'tiktok', estado: 'cliente' });
    assert.equal(ok.datos.whatsapp, '573001234567');
    assert.equal(ok.datos.estado, 'nuevo'); // el visitante nunca fija el estado
    assert.equal(ok.datos.fuente, 'tiktok');
    assert.equal(validarInteresado({ nombre: 'A', negocio: 'B', whatsapp: '12' }).error.includes('WhatsApp'), true);
    assert.ok(validarInteresado({ negocio: 'B', whatsapp: '3001234567' }).error);
    assert.equal(validarInteresado({ nombre: 'A', negocio: 'B', whatsapp: '3001234567', sitio_web: 'x' }).bot, true);
    assert.equal(validarInteresado({ nombre: 'A', negocio: 'B', whatsapp: '3001234567', fuente: 'hack' }).datos.fuente, 'instagram');
});
