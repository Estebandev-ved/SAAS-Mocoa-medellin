import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';

// Documento base de Términos de Uso + Tratamiento de Datos (Ley 1581 de 2012,
// Colombia). Es una plantilla razonable para una app de bot de ventas por
// WhatsApp con un módulo opcional de domicilios; no reemplaza una revisión
// por un abogado antes de operar con clientes y dinero reales — el aviso
// de abajo lo dice también en la propia página, no solo en el código.
const H2 = ({ id, children }) => (
  <h2 id={id} className="font-head text-xl font-bold text-text mt-10 mb-3 scroll-mt-24">
    {children}
  </h2>
);
const P = ({ children }) => <p className="text-sm text-muted leading-6 mb-3">{children}</p>;
const LI = ({ children }) => <li className="text-sm text-muted leading-6 mb-2">{children}</li>;

const SECCIONES = [
  { id: 'objeto', label: 'Qué es este servicio' },
  { id: 'cuenta', label: 'Tu cuenta y la prueba gratis' },
  { id: 'bot', label: 'El bot y sus respuestas' },
  { id: 'pagos', label: 'Pagos entre tú y tus clientes' },
  { id: 'domicilios', label: 'Domicilios y domiciliarios' },
  { id: 'datos', label: 'Tratamiento de datos personales' },
  { id: 'responsabilidad', label: 'Responsabilidad' },
  { id: 'cuenta-fin', label: 'Cancelación y cierre de cuenta' },
  { id: 'cambios', label: 'Cambios a este documento' },
  { id: 'contacto', label: 'Contacto' },
];

export default function LegalPage() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="min-h-screen bg-bg2">
      <header className="bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center gap-3">
          <Link
            to="/"
            aria-label="Volver a la página principal"
            className="w-11 h-11 rounded-xl bg-white border border-border flex items-center justify-center hover:border-[#C9C9C9] transition-colors no-underline"
          >
            <ArrowLeft className="w-5 h-5 text-muted" />
          </Link>
          <div>
            <h1 className="font-head text-2xl font-bold text-text">Términos y tratamiento de datos</h1>
            <p className="text-sm text-muted mt-0.5">Antigravity — última actualización: 22 de septiembre de 2026</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10 grid lg:grid-cols-[220px_1fr] gap-10 items-start">
        <nav aria-label="Secciones" className="hidden lg:block sticky top-10 bg-white border border-border rounded-2xl p-4">
          <p className="text-xs font-semibold tracking-[0.04em] uppercase text-muted mb-3">En esta página</p>
          <ul className="list-none p-0 m-0 space-y-2">
            {SECCIONES.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-sm text-muted hover:text-accent no-underline transition-colors">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="bg-white border border-border rounded-2xl p-8">
          <div className="flex items-start gap-3 bg-[#FDECEA] border border-accent/20 rounded-xl p-4 mb-8">
            <ShieldCheck className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-text leading-5">
              Este documento explica en términos claros cómo funciona Antigravity, qué haces tú como dueño del
              negocio, qué hace el bot, y cómo tratamos tus datos y los de tus clientes bajo la Ley 1581 de 2012.
              Es una base razonable para operar hoy; si tu negocio maneja volúmenes grandes de dinero o datos
              sensibles, te recomendamos que un abogado la revise contigo antes de crecer.
            </p>
          </div>

          <H2 id="objeto">1. Qué es este servicio</H2>
          <P>
            Antigravity es una herramienta de software que conecta tu número de WhatsApp Business con un asistente
            automatizado (el "bot"), para responder mensajes, mostrar tu catálogo, tomar pedidos y, si activas el
            módulo, coordinar domicilios. Antigravity es un intermediario tecnológico: <strong>no vende, no fabrica,
            no cobra ni entrega</strong> los productos o servicios de tu negocio — esas obligaciones son tuyas frente
            a tus clientes, como en cualquier canal de venta que uses hoy (tienda física, redes sociales, etc.).
          </P>

          <H2 id="cuenta">2. Tu cuenta y la prueba gratis</H2>
          <ul className="list-disc pl-5 m-0">
            <LI>Tu prueba gratuita de 7 días empieza en el momento en que conectas tu WhatsApp por primera vez, no cuando creas la cuenta.</LI>
            <LI>Eres responsable de la información que registras (nombre del negocio, medios de pago, catálogo) y de mantener segura tu contraseña.</LI>
            <LI>Puedes personalizar un avatar para tu cuenta; no debe usarse para hacerte pasar por otra persona real ni por otra marca.</LI>
            <LI>Al vencer la prueba o tu suscripción, el bot deja de responder a tus clientes hasta que actives o renueves un plan; tu información no se borra por esto.</LI>
          </ul>

          <H2 id="bot">3. El bot y sus respuestas</H2>
          <P>
            El bot usa inteligencia artificial para conversar con tus clientes, sugerir productos y, en algunos
            planes, verificar comprobantes de pago mediante una foto. La IA puede cometer errores: interpretar mal
            un mensaje, calcular mal un total, o dar por válido un comprobante que no lo es (o al revés). Por eso:
          </P>
          <ul className="list-disc pl-5 m-0">
            <LI>Puedes revisar y corregir cualquier pedido o pago desde tu panel antes de despacharlo.</LI>
            <LI>Eres tú, como dueño del negocio, quien decide si confirma o cancela una venta — el bot es una ayuda, no reemplaza tu criterio.</LI>
            <LI>Configura las respuestas, el tono y el horario de atención de tu bot en la sección de Automatizaciones.</LI>
          </ul>

          <H2 id="pagos">4. Pagos entre tú y tus clientes</H2>
          <P>
            Antigravity no procesa ni retiene el dinero de tus ventas: los pagos de tus clientes van directamente a
            los medios (Nequi, Bancolombia, efectivo u otros) que tú configuras en tu cuenta. La suscripción que
            pagas a Antigravity por usar la plataforma es un cobro aparte, gestionado a través de nuestro proveedor
            de pagos. Ninguna de las dos cosas te exime de tus obligaciones tributarias frente a tus ventas.
          </P>

          <H2 id="domicilios">5. Domicilios y domiciliarios</H2>
          <P>
            Si activas el módulo de Domicilios, puedes registrar domiciliarios para que reciban, acepten y entreguen
            pedidos desde su propio celular. Los domiciliarios que registras son colaboradores independientes tuyos
            o de tu negocio, <strong>no empleados ni contratistas de Antigravity</strong>. Tú defines sus tarifas y
            condiciones de trabajo; Antigravity solo provee la herramienta de asignación, ubicación en tiempo real y
            seguimiento del pedido para tu cliente final.
          </P>
          <ul className="list-disc pl-5 m-0">
            <LI>El domiciliario acepta las condiciones de uso del portal al ingresar con su teléfono y PIN.</LI>
            <LI>Reportar un problema en la entrega (dirección incorrecta, cliente ausente, etc.) queda registrado para que tú lo resuelvas desde el panel.</LI>
            <LI>Un domiciliario con incidentes repetidos puede quedar suspendido temporalmente del portal por decisión tuya, no automática arbitraria — siempre revisable desde tu panel.</LI>
          </ul>

          <H2 id="datos">6. Tratamiento de datos personales (Ley 1581 de 2012)</H2>
          <P>
            Al registrar tu cuenta, autorizas a Antigravity a tratar tus datos (nombre, correo, WhatsApp, medios de
            pago) para prestarte el servicio: operar el bot, generar reportes y contactarte por soporte o cobros.
            Los datos de tus clientes que el bot recoge por WhatsApp (nombre, número, dirección de entrega,
            historial de pedidos) son responsabilidad conjunta: tú decides qué se pide y para qué se usa dentro de
            tu negocio, y Antigravity los almacena de forma segura como tu encargado del tratamiento.
          </P>
          <ul className="list-disc pl-5 m-0">
            <LI>Puedes solicitar en cualquier momento una copia, corrección o eliminación de los datos de tu cuenta escribiéndonos (ver sección de Contacto).</LI>
            <LI>No vendemos ni compartimos tus datos ni los de tus clientes con terceros para fines de publicidad ajenos a Antigravity.</LI>
            <LI>Los datos se conservan mientras tu cuenta esté activa y por el tiempo adicional que exija la ley (por ejemplo, obligaciones contables).</LI>
          </ul>

          <H2 id="responsabilidad">7. Responsabilidad</H2>
          <P>
            Antigravity hace su mejor esfuerzo para mantener el bot disponible y preciso, pero no garantiza que
            funcione sin interrupciones (por ejemplo, si WhatsApp cambia su servicio o tu celular pierde conexión).
            No somos responsables por pérdidas derivadas de decisiones comerciales tuyas, de errores en la
            información que cargaste, ni de la relación entre tú y tus clientes o domiciliarios.
          </P>

          <H2 id="cuenta-fin">8. Cancelación y cierre de cuenta</H2>
          <P>
            Puedes cancelar tu suscripción cuando quieras desde Suscripción, sin penalidad; sigues teniendo acceso
            hasta el final del periodo ya pagado. Podemos suspender una cuenta que use el bot para actividades
            ilegales, spam masivo no solicitado, o que incumpla estos términos, avisando por correo cuando sea
            posible.
          </P>

          <H2 id="cambios">9. Cambios a este documento</H2>
          <P>
            Podemos actualizar estos términos para reflejar cambios en el producto o en la ley. Los cambios
            importantes te los avisamos por correo o dentro del panel antes de que entren en vigor.
          </P>

          <H2 id="contacto">10. Contacto</H2>
          <P>
            ¿Preguntas sobre este documento o sobre tus datos? Escríbenos desde la sección de Ajustes o al correo de
            soporte que aparece en tu panel.
          </P>

          <div className="mt-10 pt-6 border-t border-border flex items-center gap-2 text-xs text-muted">
            <FileText size={14} />
            Documento de referencia, redactado para este producto. No sustituye asesoría legal profesional.
          </div>
        </main>
      </div>
    </div>
  );
}
