import React from 'react';
import { evento } from '../utils/analitica';

// Video corto de la landing. Se enciende con VITE_DEMO_VIDEO_URL (YouTube o un .mp4) y, si no hay
// video, la sección no se muestra (no hay marcador vacío). VITE_DEMO_VIDEO_POSTER = portada opcional.
const URL_VIDEO = import.meta.env.VITE_DEMO_VIDEO_URL || '';
const POSTER = import.meta.env.VITE_DEMO_VIDEO_POSTER || undefined;

const idYoutube = (u) => {
  const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
};

export default function VideoDemo() {
  if (!URL_VIDEO) return null;
  const yt = idYoutube(URL_VIDEO);

  return (
    <section id="video" className="py-20 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <span className="section-label">Míralo en 1 minuto</span>
        <h2 className="section-title">Así atiende tu bot por WhatsApp</h2>
        <div className="mt-8 rounded-3xl overflow-hidden border border-border bg-inverse aspect-video shadow-[0_24px_60px_rgba(10,10,10,0.15)]">
          {yt ? (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0`}
              title="Demo de Antigravity"
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
            />
          ) : (
            <video className="w-full h-full" src={URL_VIDEO} poster={POSTER} controls preload="none" playsInline onPlay={() => evento('video_demo_play')}>
              Tu navegador no puede reproducir este video.
            </video>
          )}
        </div>
      </div>
    </section>
  );
}
