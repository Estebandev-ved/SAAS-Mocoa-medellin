import React, { useState } from 'react';
import { Share2, Printer, Copy, Check, MessageCircle } from 'lucide-react';
import BottomSheet from './BottomSheet';

const cop = (n) => `$${Number(n || 0).toLocaleString('es-CO')}`;

// Resumen del día listo para compartir: mensaje de WhatsApp (el dueño elige a quién), copiar o PDF
// (usa la impresión del navegador: "Guardar como PDF"; el CSS @media print oculta menús y botones).
export default function CompartirResumen({ nombre, stats }) {
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const fecha = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  const texto = [
    `📊 Resumen de ${nombre || 'mi negocio'} · ${fecha}`,
    `💰 Ventas: ${cop(stats.ventasHoy)}`,
    `🛒 Pedidos: ${stats.pedidosHoy}`,
    `💬 Mensajes atendidos: ${stats.mensajesHoy}`,
    `🤖 Procesados por la IA: ${stats.aiProcesados}`,
  ].join('\n');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch { /* sin permiso de portapapeles */ }
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="no-print h-11 px-4 rounded-xl bg-white border border-border text-text text-sm font-semibold cursor-pointer inline-flex items-center gap-2 hover:border-accent/40"
      >
        <Share2 size={16} /> Compartir resumen
      </button>
      <BottomSheet abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Compartir resumen del día" z={90}>
        <pre className="bg-bg2 border border-border rounded-xl p-4 text-sm text-text whitespace-pre-wrap font-body m-0 mb-4">{texto}</pre>
        <div className="grid gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="h-12 rounded-xl bg-[#25D366] text-white text-sm font-semibold no-underline inline-flex items-center justify-center gap-2"
          >
            <MessageCircle size={18} /> Enviar por WhatsApp
          </a>
          <button onClick={copiar} className="h-12 rounded-xl bg-white border border-border text-text text-sm font-semibold cursor-pointer inline-flex items-center justify-center gap-2">
            {copiado ? <><Check size={18} className="text-success" /> Copiado</> : <><Copy size={18} /> Copiar texto</>}
          </button>
          <button
            onClick={() => { setAbierto(false); setTimeout(() => window.print(), 350); }}
            className="h-12 rounded-xl bg-white border border-border text-text text-sm font-semibold cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <Printer size={18} /> Descargar PDF
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
