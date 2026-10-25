// ¿Está el negocio dentro de su horario de atención? Lógica compartida por el bot (orchestrator) y los flujos.
// El servidor (Railway) corre en UTC: sin zona explícita el horario se evaluaba 5 h corrido respecto a Colombia.

/** Minutos desde medianoche en la zona horaria dada. */
function minutosActuales(ahora = new Date(), zona = process.env.BOT_TIMEZONE || 'America/Bogota') {
    const partes = new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ahora);
    return Number(partes.find((p) => p.type === 'hour').value) * 60 + Number(partes.find((p) => p.type === 'minute').value);
}

const aMinutos = (hhmm) => {
    const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number);
    return h * 60 + m;
};

/**
 * `inicio` y `fin` en "HH:MM" o "HH:MM:SS". Sin horario configurado, siempre está abierto.
 * Soporta horarios que cruzan la medianoche (22:00 a 08:00).
 */
function dentroDeHorario(inicio, fin, ahora = new Date(), zona) {
    if (!inicio || !fin) return true;
    const i = aMinutos(inicio);
    const f = aMinutos(fin);
    if (![i, f].every(Number.isFinite)) return true;
    const actual = minutosActuales(ahora, zona);
    return i <= f ? actual >= i && actual <= f : actual >= i || actual <= f;
}

module.exports = { dentroDeHorario, minutosActuales };
