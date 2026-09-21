---
name: NOMA Design System
description: >
  Sistema de diseño formal y cercano para NOMA. Base neutra en negro, gris y blanco,
  con rojo como único color de acción y personajes ilustrados como voz visual de la marca.
version: 1.0.0

colors:
  # Marca
  primary: "#E53935"
  primary-strong: "#C62828"
  primary-deep: "#8E1B1B"
  primary-soft: "#FDECEA"
  on-primary: "#FFFFFF"

  # Neutros oscuros (tema oscuro y superficies de contraste)
  black: "#0A0A0A"
  ink: "#111111"
  charcoal: "#1A1A1A"
  graphite: "#262626"

  # Neutros grises
  gray-700: "#404040"
  gray-600: "#666666"
  gray-500: "#8A8A8A"
  gray-400: "#A0A0A0"
  gray-300: "#C9C9C9"
  gray-200: "#E4E4E4"
  gray-100: "#F0F0F0"
  gray-50: "#F8F8F8"
  white: "#FFFFFF"

  # Roles de superficie y texto (tema claro por defecto)
  background: "#FFFFFF"
  surface: "#F8F8F8"
  surface-raised: "#FFFFFF"
  surface-inverse: "#0A0A0A"
  border: "#E4E4E4"
  border-strong: "#C9C9C9"
  text: "#1A1A1A"
  text-secondary: "#555555"
  text-muted: "#8A8A8A"
  text-inverse: "#F5F5F5"

  # Estados (uso funcional, nunca decorativo)
  success: "#2E7D32"
  warning: "#F9A825"
  error: "#EF5350"
  info: "#0288D1"

typography:
  display:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: 800
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: 700
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: 700
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: 400
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
    letterSpacing: 0.04em
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: 500
    lineHeight: 20px

rounded:
  none: 0px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  full: 9999px

spacing:
  unit: 4px
  "0": 0px
  "1": 4px
  "2": 8px
  "3": 12px
  "4": 16px
  "5": 20px
  "6": 24px
  "8": 32px
  "10": 40px
  "12": 48px
  "16": 64px
  "20": 80px
  "24": 96px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 32px

components:
  button-primary:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 0 20px
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-secondary:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 0 20px
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.primary-strong}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 0 16px
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    height: 44px
    padding: 0 16px
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: 24px
  card-illustrated:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.xl}"
    padding: 24px
  card-inverse:
    backgroundColor: "{colors.surface-inverse}"
    textColor: "{colors.text-inverse}"
    rounded: "{rounded.lg}"
    padding: 24px
  chip:
    backgroundColor: "{colors.gray-100}"
    textColor: "{colors.text-secondary}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    height: 28px
    padding: 0 12px
  chip-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-strong}"
  navbar:
    backgroundColor: "{colors.black}"
    textColor: "{colors.text-inverse}"
    height: 64px
---

# NOMA Design System

## Overview

NOMA se ve **formal, ordenada y confiable**, pero nunca fría. La interfaz es sobria: mucho
espacio en blanco, tipografía firme y una sola voz de color, el rojo. La calidez la ponen
los **personajes ilustrados**, que acompañan al usuario en toda la aplicación: en el
onboarding, en los estados vacíos, en las confirmaciones y en las pantallas de error.

Principios:

1. **Serio por estructura, cercano por ilustración.** Layout, tipografía y color son
   corporativos. Los personajes aportan la personalidad.
2. **El rojo actúa.** Se usa solo para la acción principal, el foco y los acentos de marca.
   Si todo es rojo, nada destaca.
3. **Neutros con jerarquía.** Negro para el contraste fuerte, gris para lo secundario,
   blanco para respirar.
4. **Consistencia antes que novedad.** Mismos radios, mismas sombras y mismos espaciados
   en todas las pantallas.

Tema claro por defecto. El tema oscuro usa `black`, `ink` y `charcoal` como superficies y
mantiene el rojo como acento (ver Colors).

## Colors

El sistema conserva la identidad actual del proyecto (rojo `#E53935`, negro `#0A0A0A`,
grises neutros) y ordena su uso en roles claros.

| Rol | Token | Hex | Uso |
|---|---|---|---|
| Marca | `primary` | `#E53935` | Acentos, iconos activos, foco, gráficos |
| Acción | `primary-strong` | `#C62828` | Fondo de botones y enlaces (contraste AA con texto blanco) |
| Presión | `primary-deep` | `#8E1B1B` | Hover y pressed del botón primario |
| Tinte | `primary-soft` | `#FDECEA` | Fondo de tarjetas ilustradas, chips activos, alertas suaves |
| Negro | `black` / `ink` / `charcoal` | `#0A0A0A` / `#111111` / `#1A1A1A` | Navbar, hero oscuro, tema oscuro |
| Grises | `gray-50` a `gray-700` | `#F8F8F8` a `#404040` | Superficies, bordes, texto secundario |
| Blanco | `white` | `#FFFFFF` | Fondo base, tarjetas, texto sobre oscuro |

Reglas de uso:

- **Proporción 60 / 30 / 10:** 60 % blanco y gris claro, 30 % negro y gris oscuro,
  10 % rojo.
- **Texto sobre rojo:** usa `primary-strong` (`#C62828`) como fondo para texto blanco
  de tamaño normal. `#E53935` con texto blanco solo para texto grande (18 px o más
  en semibold, o 24 px o más).
- **Estados** (`success`, `warning`, `error`, `info`) son solo funcionales. `error` nunca
  se usa como acento de marca, para no confundirse con el rojo primario.
- **Tema oscuro:** fondo `black`, superficies `ink` y `charcoal`, bordes
  `rgba(255,255,255,0.08)`, texto `#F5F5F5` y secundario `#A0A0A0`. Sobre oscuro, los
  acentos usan `primary` (`#E53935`).

## Typography

Dos familias con roles distintos, más una monoespaciada para datos.

- **Plus Jakarta Sans**: titulares. Geométrica, firme y amable; da el tono formal.
- **Inter**: cuerpo, formularios y etiquetas. Máxima legibilidad en interfaces densas.
- **JetBrains Mono**: cifras, IDs, códigos y logs.

| Nivel | Fuente | Tamaño / Interlineado | Peso | Uso |
|---|---|---|---|---|
| `display` | Plus Jakarta Sans | 48 / 56 | 800 | Hero y pantallas de bienvenida |
| `headline-lg` | Plus Jakarta Sans | 32 / 40 | 700 | Título de página |
| `headline-md` | Plus Jakarta Sans | 24 / 32 | 700 | Título de sección |
| `headline-sm` | Plus Jakarta Sans | 20 / 28 | 600 | Título de tarjeta |
| `body-lg` | Inter | 18 / 28 | 400 | Texto introductorio |
| `body-md` | Inter | 16 / 24 | 400 | Texto base |
| `body-sm` | Inter | 14 / 20 | 400 | Texto secundario, tablas |
| `label-lg` | Inter | 14 / 20 | 600 | Botones, pestañas, campos |
| `label-sm` | Inter | 12 / 16 | 600 | Chips, metadatos, en mayúsculas si es una etiqueta |
| `mono` | JetBrains Mono | 13 / 20 | 500 | Datos y códigos |

En pantallas de menos de 640 px, `display` baja a 36 / 44 y `headline-lg` a 28 / 36.
Longitud de línea recomendada: 60 a 75 caracteres.

## Layout

- **Escala de espaciado de 4 px.** Todo margen, relleno y separación es múltiplo de 4:
  `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`.
- **Grid de 12 columnas** en escritorio (gutter 24 px, margen 32 px), 8 en tablet y
  4 en móvil (gutter 16 px, margen 16 px).
- **Ancho máximo de contenido:** 1200 px. Texto largo, máximo 720 px.
- **Ritmo vertical:** 16 px entre elementos relacionados, 24 px entre grupos,
  48 a 64 px entre secciones.
- **Áreas táctiles:** mínimo 44 × 44 px.
- **Ilustraciones:** ocupan 4 o 5 columnas junto al texto en escritorio y se apilan
  encima del texto en móvil, con un alto máximo de 240 px.

## Elevation & Depth

La profundidad es sutil. La jerarquía se construye con color de superficie y bordes, y con
sombra solo cuando un elemento flota.

| Nivel | Uso | Sombra (tema claro) |
|---|---|---|
| 0 | Fondo, contenido en línea | ninguna |
| 1 | Tarjetas, campos | borde `1px #E4E4E4` |
| 2 | Tarjetas al pasar el cursor | `0 4px 12px rgba(10,10,10,0.08)` |
| 3 | Menús, popovers | `0 8px 24px rgba(10,10,10,0.12)` |
| 4 | Modales | `0 16px 48px rgba(10,10,10,0.20)` + velo `rgba(10,10,10,0.5)` |

En tema oscuro se reemplaza la sombra por un borde `rgba(255,255,255,0.08)` y un fondo
un paso más claro. El foco de teclado es un anillo de 2 px `primary` con 2 px de separación.

## Shapes

| Token | Valor | Uso |
|---|---|---|
| `xs` | 4 px | Casillas, indicadores pequeños |
| `sm` | 8 px | Tooltips, elementos internos de tablas |
| `md` | 12 px | Botones, campos, selectores |
| `lg` | 16 px | Tarjetas, paneles |
| `xl` | 24 px | Tarjetas ilustradas, modales, hero |
| `full` | 9999 px | Chips, avatares, píldoras de estado |

Las esquinas redondeadas son moderadas: dan calidez sin perder formalidad. Los personajes
ilustrados siguen la misma lógica, con formas simples de esquinas suaves.

## Illustration & Characters

Los personajes son el rasgo distintivo de NOMA y aparecen en toda la aplicación.

- **Estilo:** ilustración plana y vectorial, formas geométricas simples, sin degradados
  complejos, con contorno grueso opcional en `black` (2 px).
- **Paleta cerrada:** rojo (`primary`, `primary-strong`), negro, blancos y grises.
  El tinte `primary-soft` sirve de fondo. No se introducen otros colores, salvo tonos
  de piel neutros si el personaje los requiere.
- **Cast:** un grupo pequeño y reconocible de personajes con la misma anatomía
  y las mismas proporciones. La prenda o el accesorio rojo es el elemento que los une.
- **Tono:** amable, profesional y sereno. Sin caricatura exagerada.
- **Dónde aparecen:**
  - Onboarding y bienvenida: personaje grande, saludo y una sola acción.
  - Estados vacíos: personaje pequeño (120 a 160 px) con un mensaje corto y un botón.
  - Confirmaciones y éxito: personaje en pose de celebración discreta.
  - Errores y sin conexión: personaje con gesto de disculpa y una acción de recuperación.
  - Carga: personaje animado con movimiento suave (máximo 600 ms por ciclo).
- **Colocación:** sobre fondo `primary-soft` o `gray-50`, o recortado sobre una tarjeta
  `card-inverse`. Deja al menos 24 px de margen alrededor.
- **Accesibilidad:** cada ilustración informativa lleva texto alternativo. Las decorativas
  usan `alt=""` y respetan `prefers-reduced-motion`.

## Components

**Botones.** Altura 44 px, radio `md`, `label-lg`.
- *Primario:* fondo `primary-strong`, texto blanco. Hover `primary-deep`. Uno solo por vista.
- *Secundario:* fondo blanco, borde `border-strong`, texto `text`.
- *Fantasma:* sin fondo, texto `primary-strong`.
- *Deshabilitado:* fondo `gray-100`, texto `gray-500`.

**Campos de formulario.** Altura 44 px, radio `md`, borde `1px border-strong`, relleno
horizontal 16 px. Foco: borde y anillo `primary`. Error: borde `error` y mensaje en
`body-sm`. La etiqueta va arriba en `label-lg`, con 8 px de separación.

**Tarjetas.** Radio `lg`, relleno 24 px, borde `1px border`. La variante ilustrada usa
radio `xl`, fondo `primary-soft` y un personaje. La variante inversa usa fondo `black`
para métricas destacadas.

**Chips y estados.** Píldora de 28 px de alto en `label-sm`. Activo: fondo `primary-soft`,
texto `primary-strong`.

**Navegación.** Barra superior de 64 px en `black` con texto claro y el elemento activo
marcado por una línea de 2 px en `primary`. En móvil, barra inferior con iconos de 24 px.

**Tablas.** Cabecera `label-sm` en `gray-600` sobre `gray-50`, filas de 56 px,
separadores de `1px border`, cifras en `mono`.

**Alertas.** Radio `md`, relleno 16 px, borde izquierdo de 4 px con el color del estado y
fondo en su tono más claro.

**Modales.** Radio `xl`, relleno 32 px, ancho máximo 480 px, nivel de elevación 4.

## Do's and Don'ts

**Sí**
- Usa un solo botón primario rojo por vista.
- Mantén los neutros como base y el rojo como acento.
- Coloca un personaje en cada estado vacío, de éxito y de error.
- Usa solo múltiplos de 4 px para espaciar.
- Asegura contraste mínimo AA (4.5:1 para texto normal).
- Deja respirar las ilustraciones con márgenes generosos.

**No**
- No uses rojo como fondo de grandes áreas de contenido.
- No mezcles `primary` con `error` en el mismo componente.
- No añadas colores fuera de la paleta, ni siquiera en las ilustraciones.
- No pongas más de dos pesos tipográficos en una misma tarjeta.
- No animes personajes en bucle continuo ni ignores `prefers-reduced-motion`.
- No uses sombras fuertes ni degradados llamativos en la interfaz.
