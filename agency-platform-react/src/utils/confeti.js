// Confeti ligero en un <canvas> temporal (sin dependencias). No hace nada si la persona pidió
// menos movimiento (prefers-reduced-motion). Se limpia solo a los ~2,5 s.
export function lanzarConfeti() {
  if (typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '200' });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const colores = ['#C62828', '#E53935', '#FFB840', '#2E7D32', '#0288D1', '#A78BFA'];
  const piezas = Array.from({ length: 110 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 120,
    y: window.innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 11,
    vy: -Math.random() * 11 - 3,
    r: Math.random() * 6 + 3,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    c: colores[Math.floor(Math.random() * colores.length)],
  }));

  const inicio = performance.now();
  const cuadro = (t) => {
    const dt = t - inicio;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    piezas.forEach((p) => {
      p.vy += 0.28; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vx *= 0.995;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0, 1 - dt / 2500);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    });
    if (dt < 2500) requestAnimationFrame(cuadro);
    else canvas.remove();
  };
  requestAnimationFrame(cuadro);
}
