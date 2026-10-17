import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { EMPRESA, LEGAL_FECHA_TEXTO } from '../legalConfig';
import { reabrirCookies } from '../components/CookieBanner';

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
  { id: 'pagos', label: 'Pagos y suscripción' },
  { id: 'domicilios', label: 'Domicilios y domiciliarios' },
  { id: 'datos', label: 'Tratamiento de datos personales' },
  { id: 'derechos', label: 'Tus derechos y cómo ejercerlos' },
  { id: 'terceros', label: 'Terceros que intervienen' },
  { id: 'cookies', label: 'Cookies y almacenamiento' },
  { id: 'responsabilidad', label: 'Responsabilidad' },
  { id: 'cuenta-fin', label: 'Cancelación y cierre de cuenta' },
  { id: 'ley', label: 'Ley aplicable' },
  { id: 'cambios', label: 'Cambios a este documento' },
  { id: 'contacto', label: 'Contacto' },
];

export default function LegalPage() {
  const { hash, pathname } = useLocation();
  const destino = hash || (pathname === '/cookies' ? '#cookies' : '');

  useEffect(() => {
    if (destino) {
      const el = document.querySelector(destino);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [destino]);

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
            <p className="text-sm text-muted mt-0.5">Antigravity — última actualización: {LEGAL_FECHA_TEXTO}</p>
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

          <H2 id="pagos">4. Pagos y suscripción</H2>
          <P>
            Antigravity no procesa ni retiene el dinero de tus ventas: los pagos de tus clientes van directamente a
            los medios (Nequi, Bancolombia, efectivo u otros) que tú configuras en tu cuenta. Ninguna de las dos
            cosas te exime de tus obligaciones tributarias frente a tus ventas.
          </P>
          <P>
            La suscripción que pagas a Antigravity por usar la plataforma es un cobro aparte, gestionado por
            nuestro proveedor de pagos (Efipay). Antes de pagar ves el plan y el valor exacto en pesos colombianos.
            El pago cubre un periodo de servicio y no se renueva automáticamente: al terminar el periodo el plan pasa a vencido y
            tú decides si pagas de nuevo. Si compraste a distancia y tienes derecho de retracto según la Ley 1480 de 2011,
            puedes ejercerlo escribiéndonos dentro de los 5 días hábiles siguientes a la compra, siempre que no hayas
            usado el servicio de forma sustancial.
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
            <strong>Responsable del tratamiento.</strong>{' '}
            {EMPRESA.nombre
              ? <>{EMPRESA.nombre}{EMPRESA.documento ? `, ${EMPRESA.documento}` : ''}{EMPRESA.domicilio ? `, domiciliado en ${EMPRESA.domicilio}` : ''}.</>
              : 'Antigravity (los datos de identificación del titular se publican en el canal de contacto de esta página).'}
            {EMPRESA.correoDatos ? <> Correo para consultas y reclamos: <strong>{EMPRESA.correoDatos}</strong>.</> : null}
          </P>
          <P>
            Al registrar tu cuenta o dejar tus datos en nuestros formularios, autorizas de manera previa, expresa e
            informada a Antigravity para tratar tus datos (nombre, correo, WhatsApp, ciudad, tipo de negocio, medios
            de pago) con estas finalidades: operar el bot, generar reportes, prestarte soporte, gestionar la
            suscripción y los cobros, contactarte para responder tu solicitud de información, y enviarte avisos del
            servicio. No usamos tus datos para fines distintos sin pedirte una nueva autorización.
          </P>
          <P>
            Los datos de tus clientes que el bot recoge por WhatsApp (nombre, número, dirección de entrega,
            historial de pedidos, comprobantes de pago) los tratamos por tu cuenta: tú, como dueño del negocio, eres
            el responsable frente a tus clientes y debes contar con su autorización; Antigravity actúa como tu
            encargado del tratamiento y los almacena de forma segura. Los comprobantes de pago pueden contener datos
            financieros; los usamos solo para verificar el pago del pedido.
          </P>
          <ul className="list-disc pl-5 m-0">
            <LI>No solicitamos datos sensibles (salud, origen étnico, orientación política, biometría) ni datos de niños, niñas o adolescentes. Si recibes alguno por error en una conversación, puedes pedir que lo eliminemos.</LI>
            <LI>No vendemos tus datos ni los de tus clientes ni los compartimos con terceros para publicidad ajena a Antigravity.</LI>
            <LI>Conservamos los datos mientras tu cuenta esté activa y por el tiempo adicional que exija la ley (por ejemplo, obligaciones contables y tributarias); luego se eliminan o anonimizan.</LI>
            <LI>Aplicamos medidas técnicas razonables: contraseñas cifradas, conexión segura (HTTPS), aislamiento de la información entre negocios y control de acceso.</LI>
            <LI>Si ocurre un incidente que afecte tus datos, te lo informaremos y lo reportaremos a la Superintendencia de Industria y Comercio cuando corresponda.</LI>
          </ul>

          <H2 id="derechos">7. Tus derechos y cómo ejercerlos</H2>
          <P>Como titular de tus datos tienes derecho a:</P>
          <ul className="list-disc pl-5 m-0">
            <LI>Conocer, actualizar y rectificar tus datos.</LI>
            <LI>Pedir prueba de la autorización que nos diste.</LI>
            <LI>Ser informado del uso que se ha dado a tus datos.</LI>
            <LI>Revocar la autorización y/o solicitar la supresión de tus datos, cuando no exista un deber legal o contractual de conservarlos.</LI>
            <LI>Acceder de forma gratuita a tus datos y presentar quejas ante la Superintendencia de Industria y Comercio (SIC) por infracciones a la Ley 1581 de 2012.</LI>
          </ul>
          <P>
            <strong>Cómo hacerlo:</strong> escríbenos
            {EMPRESA.correoDatos ? <> a <strong>{EMPRESA.correoDatos}</strong></> : ' desde la sección de Ajustes o al correo de soporte de tu panel'}
            {' '}indicando tu nombre, el WhatsApp o correo con el que te registraste y qué solicitas. Respondemos las
            consultas en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles contados desde que los
            recibimos (si necesitamos más tiempo te avisamos el motivo y la nueva fecha, que no excederá los 8 días
            hábiles adicionales para reclamos).
          </P>

          <H2 id="terceros">8. Terceros que intervienen</H2>
          <P>
            Para prestar el servicio usamos proveedores que tratan datos por encargo nuestro. Algunos están fuera de
            Colombia, por lo que tus datos pueden ser transmitidos o transferidos a otros países; lo hacemos con
            proveedores que ofrecen niveles adecuados de protección y solo para lo necesario para el servicio.
          </P>
          <ul className="list-disc pl-5 m-0">
            <LI><strong>WhatsApp / Meta:</strong> canal por el que tus clientes hablan con el bot; aplican sus propios términos y política de privacidad.</LI>
            <LI><strong>Google (Gemini):</strong> modelo de inteligencia artificial que procesa el texto y las imágenes de los mensajes para generar respuestas y verificar comprobantes.</LI>
            <LI><strong>Railway y Vercel:</strong> infraestructura donde se aloja la aplicación y la base de datos.</LI>
            <LI><strong>Efipay:</strong> procesamiento del pago de la suscripción. No almacenamos datos de tu tarjeta.</LI>
          </ul>

          <H2 id="cookies">9. Cookies y almacenamiento en tu dispositivo</H2>
          <P>
            Usamos tecnologías de almacenamiento en tu navegador (cookies y almacenamiento local) para que el sitio
            funcione y recuerde tus decisiones. Las <strong>necesarias</strong> siempre están activas; no usamos cookies de
            publicidad ni de seguimiento entre sitios.
          </P>
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm text-left border border-border rounded-xl">
              <thead className="bg-bg2 text-text">
                <tr>
                  <th className="p-3 font-semibold">Qué guarda</th>
                  <th className="p-3 font-semibold">Para qué</th>
                  <th className="p-3 font-semibold">Tipo</th>
                  <th className="p-3 font-semibold">Duración</th>
                </tr>
              </thead>
              <tbody className="text-muted">
                <tr className="border-t border-border"><td className="p-3">Sesión (token y datos básicos de tu cuenta)</td><td className="p-3">Mantenerte conectado al panel</td><td className="p-3">Necesaria</td><td className="p-3">Hasta que cierres sesión</td></tr>
                <tr className="border-t border-border"><td className="p-3">Avance y avisos del panel</td><td className="p-3">Recordar qué pasos de activación ya hiciste</td><td className="p-3">Necesaria</td><td className="p-3">Hasta que borres los datos del navegador</td></tr>
                <tr className="border-t border-border"><td className="p-3">Aviso de instalar la app</td><td className="p-3">No volver a mostrártelo si lo cierras</td><td className="p-3">Preferencia</td><td className="p-3">Hasta que borres los datos del navegador</td></tr>
                <tr className="border-t border-border"><td className="p-3">Tu decisión sobre cookies</td><td className="p-3">Recordar lo que elegiste en el aviso</td><td className="p-3">Necesaria</td><td className="p-3">Hasta que borres los datos del navegador</td></tr>
              </tbody>
            </table>
          </div>
          <P>
            Si aceptas "Aceptar" en el aviso de cookies, medimos el uso de la web pública (páginas vistas y clics en
            los botones de registro) con Plausible, una herramienta que no usa cookies ni crea perfiles individuales.
            Si eliges "Solo necesarias" no se carga nada de esto. Puedes cambiar tu decisión{' '}
            <button type="button" onClick={reabrirCookies} className="text-accent underline bg-transparent border-none p-0 cursor-pointer text-sm">
              aquí
            </button>
            {' '}o borrando los datos del sitio en la configuración de tu navegador.
          </P>

          <H2 id="responsabilidad">10. Responsabilidad</H2>
          <P>
            Antigravity hace su mejor esfuerzo para mantener el bot disponible y preciso, pero no garantiza que
            funcione sin interrupciones (por ejemplo, si WhatsApp cambia su servicio o tu celular pierde conexión).
            No somos responsables por pérdidas derivadas de decisiones comerciales tuyas, de errores en la
            información que cargaste, ni de la relación entre tú y tus clientes o domiciliarios.
          </P>

          <H2 id="cuenta-fin">11. Cancelación y cierre de cuenta</H2>
          <P>
            Puedes cancelar tu suscripción cuando quieras desde Suscripción, sin penalidad; sigues teniendo acceso
            hasta el final del periodo ya pagado. Podemos suspender una cuenta que use el bot para actividades
            ilegales, spam masivo no solicitado, o que incumpla estos términos, avisando por correo cuando sea
            posible.
          </P>

          <H2 id="ley">12. Ley aplicable</H2>
          <P>
            Estos términos se rigen por las leyes de la República de Colombia, en especial la Ley 1581 de 2012 y sus
            decretos reglamentarios (protección de datos personales), la Ley 1480 de 2011 (Estatuto del Consumidor) y
            la Ley 527 de 1999 (comercio electrónico). Cualquier diferencia se intentará resolver primero de manera
            directa y, de no lograrse, ante los jueces competentes de Colombia.
          </P>

          <H2 id="cambios">13. Cambios a este documento</H2>
          <P>
            Podemos actualizar estos términos para reflejar cambios en el producto o en la ley. Los cambios
            importantes te los avisamos por correo o dentro del panel antes de que entren en vigor.
          </P>

          <H2 id="contacto">14. Contacto</H2>
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
