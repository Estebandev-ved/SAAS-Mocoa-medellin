const test = require('node:test');
const assert = require('node:assert');
const { dentroDeHorario } = require('../../api/services/horario');

// 15:00 UTC = 10:00 en Bogotá (UTC-5)
const ahora = (hhmmUtc) => new Date(`2026-10-21T${hhmmUtc}:00Z`);

test('horario normal: abierto de 8 a 18 (hora de Colombia)', () => {
    assert.strictEqual(dentroDeHorario('08:00:00', '18:00:00', ahora('15:00'), 'America/Bogota'), true);   // 10:00
    assert.strictEqual(dentroDeHorario('08:00', '18:00', ahora('12:59'), 'America/Bogota'), false);        // 07:59
    assert.strictEqual(dentroDeHorario('08:00', '18:00', ahora('23:30'), 'America/Bogota'), false);        // 18:30
});

test('horario que cruza la medianoche', () => {
    assert.strictEqual(dentroDeHorario('22:00', '06:00', ahora('04:00'), 'America/Bogota'), true);         // 23:00
    assert.strictEqual(dentroDeHorario('22:00', '06:00', ahora('09:00'), 'America/Bogota'), true);         // 04:00
    assert.strictEqual(dentroDeHorario('22:00', '06:00', ahora('17:00'), 'America/Bogota'), false);        // 12:00
});

test('sin horario configurado o con datos raros, siempre abierto', () => {
    assert.strictEqual(dentroDeHorario(null, null, ahora('15:00')), true);
    assert.strictEqual(dentroDeHorario('', '18:00', ahora('15:00')), true);
    assert.strictEqual(dentroDeHorario('abc', 'def', ahora('15:00')), true);
});
