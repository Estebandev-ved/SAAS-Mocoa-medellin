// ─── COUNTER ANIMATION ───
function animateCounters() {
  document.querySelectorAll('[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    let current = 0;
    const step = target / 60;
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = Math.round(current) + suffix;
      if (current >= target) clearInterval(timer);
    }, 16);
  });
}
setTimeout(animateCounters, 800);

// ─── INTERACTIVE CHAT BOT ───
const botResponses = [
  { triggers: ['hola','buenos','buenas','hey','saludos'], reply: '¡Hola! 😊 ¿En qué te puedo ayudar? Puedo informarte sobre productos, precios o ayudarte a hacer un pedido.' },
  { triggers: ['precio','vale','cuesta','cuánto','cuanto','valor'], reply: 'Tenemos varios productos disponibles:\n• Yogur Grande 500g → $18.000\n• Yogur Normal 250g → $9.000\n• Combo 3 unidades → $45.000\n¿Te interesa alguno?' },
  { triggers: ['quiero','pedir','pedido','comprar','2','dos','3','tres','uno','1'], reply: '¡Perfecto! 🎉 Registrando tu pedido... ¿Cuál es tu dirección de entrega y método de pago? (Nequi, Bancolombia, Efectivo)' },
  { triggers: ['nequi','bancolombia','efectivo','pago','transferencia'], reply: '✅ Pedido registrado exitosamente!\n\nTe llega confirmación en unos segundos. Tiempo de entrega: 30-45 min. ¡Gracias por tu compra! 🚀' },
  { triggers: ['gracias','listo','ok','perfecto','genial'], reply: '¡Un placer atenderte! 😄 Si necesitas algo más, aquí estoy 24/7. ¡Que disfrutes tu pedido!' },
  { triggers: ['domicilio','envío','envio','entrega','llegada','demora','tiempo'], reply: 'El tiempo de entrega es de 30-45 minutos en Medellín. El domicilio tiene un costo de $3.000. ¿Deseas que procedamos con el envío?' },
];

const defaultReply = 'Entiendo tu mensaje. 🤔 Puedo ayudarte con precios, hacer pedidos o consultar métodos de pago. ¿Qué necesitas?';
let orderCount = 12;
let pendingCount = 3;
let revenue = 245000;

function sendMessage() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const messages = document.getElementById('chatMessages');

  // Add user message
  const userDiv = document.createElement('div');
  userDiv.className = 'msg msg-user';
  userDiv.textContent = msg;
  messages.appendChild(userDiv);

  // Typing indicator
  const typingDiv = document.createElement('div');
  typingDiv.className = 'msg msg-bot';
  typingDiv.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  messages.appendChild(typingDiv);
  messages.scrollTop = messages.scrollHeight;

  // Find response
  const lower = msg.toLowerCase();
  let reply = defaultReply;
  for (const r of botResponses) {
    if (r.triggers.some(t => lower.includes(t))) { reply = r.reply; break; }
  }

  // Check if it's an order
  const isOrder = /quiero|pedir|pedido|comprar|\d/.test(lower);
  const isConfirmed = /nequi|bancolombia|efectivo/.test(lower);

  setTimeout(() => {
    typingDiv.innerHTML = reply.replace(/\n/g,'<br>');
    messages.scrollTop = messages.scrollHeight;

    if (isOrder && !isConfirmed) {
      // Show order detection
      setTimeout(() => {
        const detectDiv = document.createElement('div');
        detectDiv.className = 'msg-detect';
        const prices = [18000, 27000, 36000, 45000];
        const rndPrice = prices[Math.floor(Math.random()*prices.length)];
        detectDiv.textContent = `🔍 Posible pedido detectado — $${rndPrice.toLocaleString('es-CO')}`;
        messages.appendChild(detectDiv);
        messages.scrollTop = messages.scrollHeight;
      }, 400);
    }

    if (isConfirmed) {
      // Add new order to panel
      setTimeout(() => {
        addOrderToPanel();
        const detectDiv = document.createElement('div');
        detectDiv.className = 'msg-detect';
        const amount = [18000,27000,36000][Math.floor(Math.random()*3)];
        detectDiv.textContent = `✅ Pedido confirmado y registrado — $${amount.toLocaleString('es-CO')}`;
        messages.appendChild(detectDiv);
        messages.scrollTop = messages.scrollHeight;
        updateStats(amount);
      }, 600);
    }
  }, 900);
}

function addOrderToPanel() {
  const names = ['Sofía R.','David M.','Laura T.','Andrés C.','Valentina P.'];
  const products = ['1x Grande · Nequi','2x Normal · Bancolombia','3x Grande · Efectivo','1x Combo · Nequi'];
  const amounts = ['$18.000','$18.000','$27.000','$45.000'];
  const i = Math.floor(Math.random()*names.length);
  const p = Math.floor(Math.random()*products.length);
  const list = document.getElementById('ordersList');
  const row = document.createElement('div');
  row.className = 'order-row';
  row.style.borderLeft = '2px solid var(--accent)';
  row.innerHTML = `<div><div class="order-name">${names[i]}</div><div class="order-detail">${products[p]}</div></div><div class="order-price">${amounts[p]}</div><div class="status-badge s-pending">Pendiente</div>`;
  list.prepend(row);
  // Remove last if too many
  const rows = list.querySelectorAll('.order-row');
  if (rows.length > 6) rows[rows.length-1].remove();
}

function updateStats(amount) {
  orderCount++;
  pendingCount++;
  revenue += amount;
  document.getElementById('statsOrders').textContent = orderCount;
  document.getElementById('statsPending').textContent = pendingCount;
  document.getElementById('statsRevenue').textContent = '$' + Math.round(revenue/1000) + 'K';
}

// ─── CUSTOMIZATION ───
function updatePreview() {
  const name = document.getElementById('brandName').value || 'Tu Negocio';
  const primary = document.getElementById('primaryColor').value;
  const accent = document.getElementById('accentColor').value;

  document.getElementById('previewBrandName').textContent = name;
  document.getElementById('previewTitle').textContent = name;
  document.getElementById('previewTitle').style.color = primary;
  document.getElementById('previewBtn').style.background = primary;
  document.getElementById('previewLogoCircle').style.background = primary;
  document.getElementById('primaryHex').textContent = primary;
  document.getElementById('accentHex').textContent = accent;
  document.querySelectorAll('#previewPanel .v').forEach(el => el.style.color = primary);
}

function setColor(hex) {
  document.getElementById('primaryColor').value = hex;
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
  // Note: event is deprecated/can be tricky in some envs, but following original JS
  // Adding defensive check
  if (window.event && window.event.target) {
     window.event.target.classList.add('active');
  }
  updatePreview();
}

function setTheme(mode) {
  if (mode === 'light') {
    document.getElementById('previewPanel').style.background = '#F5F5F0';
    document.getElementById('previewPanel').style.color = '#111';
    document.getElementById('btnLight').style.background = 'var(--accent)';
    document.getElementById('btnLight').style.color = 'var(--bg)';
    document.getElementById('btnDark').style.background = 'var(--bg3)';
    document.getElementById('btnDark').style.color = 'var(--muted)';
  } else {
    document.getElementById('previewPanel').style.background = '';
    document.getElementById('previewPanel').style.color = '';
    document.getElementById('btnDark').style.background = 'var(--accent)';
    document.getElementById('btnDark').style.color = 'var(--bg)';
    document.getElementById('btnLight').style.background = 'var(--bg3)';
    document.getElementById('btnLight').style.color = 'var(--muted)';
  }
}

// ─── FORM SUBMIT ───
function submitForm(btn) {
  btn.textContent = '✅ ENVIADO — TE CONTACTAMOS EN MENOS DE 24H';
  btn.style.background = 'var(--bg2)';
  btn.style.color = 'var(--accent)';
  btn.style.border = '1px solid var(--accent)';
  btn.disabled = true;
}

// ─── BOT TYPING ANIMATION ───
setTimeout(() => {
  const messages = document.getElementById('chatMessages');
  if (messages) {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'msg msg-bot';
    typingDiv.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
    messages.appendChild(typingDiv);
    setTimeout(() => {
      typingDiv.innerHTML = '¿En qué te puedo ayudar? Pregúntame por precios o haz un pedido 😊';
    }, 2000);
  }
}, 1500);
