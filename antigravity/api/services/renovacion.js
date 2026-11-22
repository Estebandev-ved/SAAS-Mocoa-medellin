// Avisos automáticos de renovación. El pago es único por ciclo (Efipay por redirección, sin cobro
// recurrente), así que el ingreso mensual depende de que el dueño vuelva a pagar: estos avisos son
// lo que lo hace "automático". Etapas por cada ciclo (cada una se manda UNA sola vez):
//   faltan_3  quedan 2 o 3 días     faltan_1  queda 1 día
//   vencio    venció hace menos de 3 días     ultimo  venció hace 3 a 6 días (último aviso)
// Canales: correo (llega aunque el negocio no tenga bot, como la Caja), WhatsApp del negocio (si está
// conectado) y la notificación del panel. Quien canceló a propósito no recibe avisos.
const { calcularEstado } = require('./billing');

const HORA = 3600000;
const DIA = 24 * HORA;

function ultimaFecha(...fechas) {
    const validas = fechas.filter(Boolean).map((f) => new Date(f)).filter((d) => !Number.isNaN(d.getTime()));
    return validas.length ? new Date(Math.max(...validas.map((d) => d.getTime()))) : null;
}

// Devuelve { etapa, dias, fin, esPrueba } o null si hoy no toca avisar a este negocio.
function etapaDeAviso(n, ahora = new Date()) {
    const { estado, acceso_hasta } = calcularEstado(n, ahora);
    if (estado === 'inactiva' || estado === 'cancelada') return null;

    if (estado === 'trial' || estado === 'activa') {
        if (!acceso_hasta) return null;
        const fin = new Date(acceso_hasta);
        const dias = Math.ceil((fin.getTime() - ahora.getTime()) / DIA);
        const etapa = dias === 1 ? 'faltan_1' : (dias === 2 || dias === 3) ? 'faltan_3' : null;
        return etapa ? { etapa, dias, fin, esPrueba: estado === 'trial' } : null;
    }

    // vencida
    const fin = ultimaFecha(n.suscripcion_fin, n.trial_hasta);
    if (!fin) return null;
    const horas = (ahora.getTime() - fin.getTime()) / HORA;
    const esPrueba = !n.suscripcion_inicio;
    if (horas > 0 && horas < 72) return { etapa: 'vencio', dias: 0, fin, esPrueba };
    if (horas >= 72 && horas < 144) return { etapa: 'ultimo', dias: 0, fin, esPrueba };
    return null;
}

// La referencia de las dos primeras etapas conserva el formato que ya usaba el scheduler
// (`<id>-<fecha de fin>-3|1`) para no repetir avisos de ciclos que ya se notificaron.
const SUFIJO = { faltan_3: '3', faltan_1: '1', vencio: 'v0', ultimo: 'v3' };
function refAviso(negocioId, fin, etapa) {
    return `${negocioId}-${new Date(fin).toISOString().slice(0, 10)}-${SUFIJO[etapa]}`;
}

function escapar(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function construirAviso({ nombre, etapa, dias, esPrueba }, url) {
    const que = esPrueba ? 'tu prueba gratis' : 'tu plan';
    const Que = esPrueba ? 'Tu prueba gratis' : 'Tu plan';
    const saludo = `Hola ${nombre || ''}`.trim() + ',';
    let titulo;
    let cuerpo;
    if (etapa === 'faltan_3' || etapa === 'faltan_1') {
        const plural = dias === 1 ? '' : 's';
        titulo = `${Que} vence en ${dias} día${plural}`;
        cuerpo = `${que} vence en ${dias} día${plural}. Renuévalo hoy y sigues sin interrupciones.`;
    } else if (etapa === 'vencio') {
        titulo = `${Que} venció`;
        cuerpo = `${que} acaba de vencer y tu cuenta quedó en pausa. Renueva y sigues justo donde lo dejaste.`;
    } else {
        titulo = 'Tu cuenta sigue en pausa';
        cuerpo = `${que} venció hace unos días. Cuando quieras, renueva y sigues justo donde lo dejaste.`;
    }
    const texto = `${saludo} ${cuerpo}`;
    const html = `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#111">`
        + `<h2 style="margin:0 0 12px">${escapar(titulo)}</h2>`
        + `<p style="line-height:1.5">${escapar(texto)}</p>`
        + `<p><a href="${escapar(url)}" style="display:inline-block;background:#E53935;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Renovar ahora</a></p>`
        + `<p style="color:#666;font-size:13px">Si ya pagaste, ignora este mensaje.</p></div>`;
    return { titulo, texto, html };
}

let avisoSmtpDado = false;

// Todo lo externo llega por `deps` para poder probarlo sin base de datos ni envíos reales.
async function revisarRenovaciones(deps) {
    const { db, yaSeNotifico, registrarNotificacion, enviarWhatsApp, enviarCorreo, urlApp, ahora = () => new Date() } = deps;
    const [negocios] = await db.execute(
        `SELECT id, nombre, email_dueno, whatsapp, plan, suscripcion_activa, suscripcion_inicio, suscripcion_fin, trial_hasta
         FROM negocios WHERE activo = 1 AND rol = 'negocio'`
    );
    const resumen = { revisados: negocios.length, avisados: 0 };

    for (const n of negocios) {
        try {
            const aviso = etapaDeAviso(n, ahora());
            if (!aviso) continue;
            const ref = refAviso(n.id, aviso.fin, aviso.etapa);
            if (await yaSeNotifico(n.id, 'renovacion_plan', ref)) continue;

            const { titulo, texto, html } = construirAviso({ nombre: n.nombre, ...aviso }, urlApp);
            const correo = await enviarCorreo({ para: n.email_dueno, asunto: titulo, texto: `${texto}\n\nRenovar: ${urlApp}`, html });
            if (!correo.ok && correo.motivo === 'sin_smtp' && !avisoSmtpDado) {
                avisoSmtpDado = true;
                console.warn('[Renovación] SMTP_USER/SMTP_PASS sin configurar: los avisos de renovación solo salen por WhatsApp y por el panel. Configúralos para que lleguen por correo.');
            }
            const whatsapp = n.whatsapp ? await enviarWhatsApp(n.id, n.whatsapp, `⏰ ${texto}\n${urlApp}`) : false;

            await registrarNotificacion(n.id, 'renovacion_plan', titulo, texto, ref, {
                etapa: aviso.etapa, dias: aviso.dias, enviado_correo: !!correo.ok, enviado_whatsapp: !!whatsapp,
            });
            resumen.avisados += 1;
            console.log(`[Renovación] Aviso ${aviso.etapa}: negocio ${n.id} (correo: ${correo.ok ? 'sí' : correo.motivo}, whatsapp: ${whatsapp ? 'sí' : 'no'})`);
        } catch (error) {
            console.error(`[Renovación] Error con el negocio ${n.id}:`, error.code || error.message);
        }
    }
    return resumen;
}

module.exports = { etapaDeAviso, refAviso, construirAviso, revisarRenovaciones };
