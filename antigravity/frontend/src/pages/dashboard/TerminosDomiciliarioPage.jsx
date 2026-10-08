import { Link } from 'react-router-dom';
import './TerminosDomiciliarioPage.css';

const IconArrowLeft = (p) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

// Condiciones para el domiciliario, separadas de las del dueño del negocio
// (agency-platform-react/src/pages/LegalPage.jsx): la relación es distinta —
// el domiciliario es colaborador independiente del negocio que lo registra,
// no de Antigravity. Plantilla base, no reemplaza asesoría legal.
export default function TerminosDomiciliarioPage() {
  return (
    <div className="terminos-page">
      <header className="terminos-header">
        <Link to="/delivery/login" aria-label="Volver" className="terminos-back">
          <IconArrowLeft />
        </Link>
        <div>
          <h1>Términos para domiciliarios</h1>
          <p>Última actualización: 22 de septiembre de 2026</p>
        </div>
      </header>

      <main className="terminos-body">
        <section>
          <h2>1. Con quién trabajas</h2>
          <p>
            Al ingresar a este portal, tu relación de trabajo es con el negocio que te registró como
            domiciliario, no con Antigravity. Antigravity solo pone a tu disposición la herramienta para ver
            pedidos, aceptarlos, marcar tu ubicación en tiempo real y confirmar entregas.
          </p>
        </section>

        <section>
          <h2>2. Tarifas y pagos</h2>
          <p>
            Las tarifas por entrega, la forma de pago y la periodicidad las define el negocio para el que
            repartes. Cualquier duda sobre un pago te la resuelve directamente ese negocio.
          </p>
        </section>

        <section>
          <h2>3. Tu conducta al usar el portal</h2>
          <ul>
            <li>La información de cada pedido (dirección, teléfono del cliente) es solo para entregarlo — no la uses para otro fin.</li>
            <li>Reporta cualquier problema (dirección incorrecta, cliente ausente, accidente) desde el botón "Reportar problema" en cuanto ocurra.</li>
            <li>Compartir tu ubicación mientras estás "en línea" es necesario para que el negocio y el cliente sepan cuándo llega su pedido.</li>
          </ul>
        </section>

        <section>
          <h2>4. Suspensión</h2>
          <p>
            Si acumulas incidentes marcados como reales por el negocio (por ejemplo, entregas no confirmadas o
            reportes falsos), el negocio puede suspender temporalmente tu acceso al portal. La decisión es del
            negocio, siempre revisable por él desde su panel.
          </p>
        </section>

        <section>
          <h2>5. Tus datos</h2>
          <p>
            Guardamos tu nombre, teléfono, ubicación mientras estás en línea, y tu historial de entregas, solo
            para que el portal funcione (ver Ley 1581 de 2012). El negocio que te registró puede ver esta
            información porque es quien te asigna los pedidos.
          </p>
        </section>
      </main>
    </div>
  );
}
