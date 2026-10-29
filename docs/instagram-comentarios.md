# Instagram: responder comentarios y escribir por mensaje directo (estilo ManyChat)

Estado: **comentarios construidos, sin probar contra Meta real** (29 oct 2026): webhook `changes.comments` → disparador de flujos "Comentario en Instagram" (palabra + respuestas públicas que se alternan) → respuesta privada (los primeros mensajes del flujo se juntan en un solo DM) → comentario público solo si el DM salió; mismo tope diario que los demás envíos automáticos; los comentarios propios y repetidos se ignoran; si el cliente contesta el DM, el flujo continúa (los DMs de Instagram ahora pasan por el motor de flujos antes de la IA). Falta: OAuth con botón y renovación de token, columnas `canal`/`ig_id` de clientes, filtrar por publicación concreta y la revisión de Meta. Diseño original (25 oct 2026): Objetivo: que un cliente comente una palabra en una publicación del negocio (por ejemplo "QUIERO") y la app (1) responda públicamente el comentario y (2) le escriba por mensaje directo (DM) para seguir una conversación o un flujo.

> Las reglas de Meta cambian seguido: antes de construir, hay que revisar la documentación vigente de *Instagram Platform* (Webhooks, Comments, Messaging, Private Replies). Lo de abajo es el mapa general, no un contrato.

## 1. Cómo funciona (la idea en simple)

1. El negocio tiene una cuenta de Instagram **profesional** (Empresa o Creador).
2. Nuestra app de Meta recibe un aviso (**webhook**) cada vez que alguien comenta en una publicación de esa cuenta.
3. Si el texto del comentario contiene la palabra clave de un flujo encendido:
   - **Responde el comentario** de forma pública ("¡Te escribimos por privado! 📩"), con textos que varían para no parecer spam.
   - Envía una **respuesta privada**: un DM al autor del comentario. Es la única forma de escribirle a alguien que nunca nos escribió: Instagram permite **un** mensaje privado por comentario, dentro de los primeros días después de comentar.
4. Si la persona contesta ese DM, se abre la ventana de conversación normal (24 horas) y el flujo puede seguir: opciones, preguntas, etiquetas, pedido, pago, etc., igual que en WhatsApp.

## 2. Lo que hay que hacer en Meta (lo más lento, no es código)

| Paso | Qué es | Tiempo típico |
|---|---|---|
| App de Meta | Crear una app tipo "Empresa" en developers.facebook.com. La misma app puede servir para WhatsApp Cloud API (ver plan de producción) | 1 hora |
| Productos | Agregar "Instagram" (API con inicio de sesión de Instagram, o con Facebook Login) y "Webhooks" | 1 hora |
| Permisos | Comentarios (`instagram_business_manage_comments` / `instagram_manage_comments`), mensajes (`instagram_business_manage_messages` / `instagram_manage_messages`) y lectura básica | — |
| Modo desarrollo | Con la app en modo desarrollo funciona **solo con cuentas que tengan rol en la app** (tú y testers). Sirve para probar todo antes de la revisión | inmediato |
| **Revisión de la app** (App Review) | Para que cualquier negocio pueda conectar su cuenta hay que pedir "acceso avanzado" a esos permisos, con video de demostración, política de privacidad y términos | **semanas** |
| **Verificación del negocio** | Meta exige verificar la empresa (documentos legales) para acceso avanzado y para ser Proveedor de Tecnología | días a semanas |

Camino sugerido: construir y probar en modo desarrollo con la cuenta del socio mientras corre la verificación en paralelo (sirve también para WhatsApp).

## 3. Lo que ya existe en el código (revisado)

- `api/routes/instagram.js`: webhook de **mensajes directos** (`entry.messaging`), `/connect` (el dueño pega `page_id` y `access_token` a mano), `/status`, `/disconnect`. Columnas `negocios.instagram_token`, `instagram_user_id`, `instagram_nombre`.
- **No existe**: manejo de **comentarios**, conexión con un botón ("Conectar Instagram" con OAuth), renovación del token, ni integración con el constructor de flujos.
- **Hallazgos de seguridad a corregir antes de usarlo en serio**:
  1. La verificación del webhook tenía un error de precedencia (`a && b || 'texto'`) que **siempre** da verdadero: cualquiera podía "verificar" el webhook. *(Corregido el 25 oct.)*
  2. El webhook **no valida la firma** `X-Hub-Signature-256`: cualquiera podría enviar eventos falsos y hacer que el bot responda y gaste IA. Hay que validarla con el secreto de la app (`META_APP_SECRET`) sobre el cuerpo crudo, como ya se hizo en `CloudApiProvider`.
  3. El token de acceso se guarda **en texto plano** en la base de datos y lo pega el usuario. Debe guardarse cifrado (como el secreto del 2FA en `services/totp.js`) y obtenerse por OAuth.

## 4. Diseño propuesto

### 4.1 Conexión sin pegar tokens
- Botón **"Conectar Instagram"** en Ajustes → Multi-canal: abre el inicio de sesión de Meta, el dueño autoriza permisos y vuelve a nuestra app con un código.
- El servidor cambia el código por un token de larga duración (dura unos 60 días), lo **cifra** y lo guarda con el id de la cuenta y la fecha de vencimiento.
- Un proceso diario **renueva** los tokens antes de que venzan y avisa al dueño si fallan ("Reconecta tu Instagram").
- Variables nuevas: `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `INSTAGRAM_REDIRECT_URI`.

### 4.2 Recibir comentarios
- Suscribir el webhook a `comments` (y `messages`). Responder 200 enseguida y procesar en segundo plano.
- Validar firma, identificar el negocio por el id de la cuenta de Instagram del evento y **descartar** comentarios propios (para no responderse a sí mismo) y repetidos (el mismo `comment_id` dos veces).
- Datos del evento que se usan: id del comentario, texto, id del autor, id de la publicación.

### 4.3 Disparador "Comentario en Instagram" en el constructor de flujos
- Nuevo modo del disparador: **"Cuando comentan una palabra en Instagram"**, con: palabra(s) clave, **a qué publicación aplica** (todas o una elegida) y el **texto de la respuesta pública** (varias variantes, se rota).
- Primer paso del flujo en Instagram: **respuesta privada** (DM) con el primer mensaje del flujo.
- El motor ya soporta lo demás (opciones, preguntas, etiquetas, esperas, pedido, pago). Instagram solo permite texto, imágenes y botones rápidos: las opciones se mandan como lista numerada, igual que en WhatsApp con QR.
- Ejemplo (el clásico de ManyChat): *comentan "CATÁLOGO" → respuesta pública "¡Listo, te lo mandé por DM! 📩" → DM con el catálogo → etiqueta `pidio_catalogo`*.

### 4.4 Clientes que vienen de Instagram
- Hoy `clientes.whatsapp` es obligatorio y es el identificador. Hay que añadir `canal` (`whatsapp` | `instagram`) y `ig_id` (id del usuario en Instagram, que es distinto por cuenta de negocio) y relajar la restricción para clientes de Instagram.
- Una persona que además escribe por WhatsApp puede unirse al mismo cliente si entrega su teléfono en una pregunta del flujo.
- **Marketing**: el consentimiento (Ley 1581) se pide igual dentro del flujo; los envíos fuera de ventana de conversación no se permiten por Instagram, así que no hay "difusiones" a frío como en WhatsApp.

### 4.5 Salida: responder comentarios y DMs
- Responder comentario: llamada a la API de Graph sobre el comentario (`/{comment-id}/replies`).
- Respuesta privada: mensaje con el destinatario identificado por `comment_id`.
- DMs posteriores: dentro de la ventana de 24 horas desde el último mensaje del cliente.
- **Anti-spam**: tope por hora/día por negocio, textos variados, pausa aleatoria entre respuestas y una lista de palabras que nunca responden (insultos). Meta puede limitar o bloquear cuentas que automatizan de forma repetitiva.

## 5. Plan por etapas

1. **Cimientos de seguridad** (1 día): validación de firma, token cifrado, arreglo de la verificación, pruebas.
2. **Conectar con OAuth** (2 días + configuración en Meta): botón, intercambio de token, renovación, pantalla de estado.
3. **Comentarios → respuesta pública + DM** (2-3 días): webhook de comentarios, disparador nuevo en flujos, plantilla "Catálogo por comentario", simulador ("probar comentario").
4. **Clientes de Instagram** (1-2 días): `canal`/`ig_id`, conversación en el panel, etiquetas, métricas.
5. **Revisión de Meta y salida a producción**: video, política de privacidad, términos y verificación; en paralelo se prueba con testers.

## 6. Riesgos

- **Revisión de Meta**: puede tardar semanas y pedir cambios; se pierde tiempo si se deja para el final.
- **Reglas de la plataforma**: solo se puede responder a comentarios de la cuenta conectada, un DM por comentario y dentro de un plazo; sin permiso de Meta no hay producción.
- **Cuenta del negocio**: debe ser profesional y estar bien configurada (en el método con Facebook Login, enlazada a una Página).
- **Spam y baneo**: automatizar de más puede limitar la cuenta del cliente; por eso topes y variación de textos son parte del producto.
- **Privacidad**: guardar el mínimo de datos del perfil y permitir borrarlos (Ley 1581).

## 7. Decisiones del socio

1. ¿Con **Instagram Login** (más simple, no requiere Página de Facebook) o con **Facebook Login** (el que hoy asume el código)? Recomendado: el más simple vigente al momento de construir.
2. ¿Quién hace la verificación del negocio con Meta y desde qué empresa? (sirve también para WhatsApp Cloud API).
3. ¿Se ofrece desde qué plan? (propuesta: Professional en adelante, por el costo de soporte).
4. ¿Probamos primero con la cuenta de Instagram del propio socio en modo desarrollo?
