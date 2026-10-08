// Exporta el <svg> del avatar del dueño como PNG descargable (para usar como foto
// de perfil de WhatsApp, en firmas de correo, etc. — el SVG en sí no sirve para eso).
export async function exportAvatarPng(svgEl, filename = 'avatar-noma.png', size = 512) {
  const xml = new XMLSerializer().serializeToString(svgEl);
  const svg64 = btoa(unescape(encodeURIComponent(xml)));
  const dataUrl = 'data:image/svg+xml;base64,' + svg64;

  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // Fondo sólido a juego con el marco que ya usa el avatar en la app — sin esto,
  // WhatsApp/clientes de correo rellenan el transparente con blanco o negro según el tema.
  ctx.fillStyle = '#FDECEA';
  ctx.fillRect(0, 0, size, size);

  const scale = Math.min(size / img.width, size / img.height) * 0.86;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2 + size * 0.05, w, h);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
