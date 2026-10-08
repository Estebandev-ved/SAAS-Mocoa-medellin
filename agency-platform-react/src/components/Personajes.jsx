import React from 'react';
import { motion } from 'framer-motion';
import { Character } from './Illustration';

// Elenco NOMA: cada personaje representa una parte del producto.
const cast = [
  {
    id: 'sofia',
    nombre: 'Sofía',
    rol: 'Dueña de negocio',
    tag: 'Tu panel',
    texto: 'Eres tú. Ventas del día, pedidos y el estado de tu bot reunidos en un solo panel, sin perseguir chats.',
    alt: 'Sofía, la dueña del negocio, con chaqueta roja y una tableta en la mano',
  },
  {
    id: 'nova',
    nombre: 'Nova',
    rol: 'El bot de ventas',
    tag: 'IA en WhatsApp',
    texto: 'Atiende 24/7, muestra tu catálogo, toma los pedidos y revisa los comprobantes de pago mientras tú descansas.',
    alt: 'Nova, un robot redondo blanco y negro con acento rojo',
  },
  {
    id: 'lucia',
    nombre: 'Lucía',
    rol: 'Atención al cliente',
    tag: 'Conversaciones',
    texto: 'Sigue cada conversación: quién escribió, qué pidió y en qué estado quedó su pedido, todo en un solo lugar.',
    alt: 'Lucía, de atención al cliente, con audífonos y un celular con burbuja de chat',
  },
  {
    id: 'mateo',
    nombre: 'Mateo',
    rol: 'Domiciliario',
    tag: 'Centro de despacho',
    texto: 'Recibe la entrega con su ruta y tú la sigues en el mapa en vivo. El cliente ve por dónde va su pedido.',
    alt: 'Mateo, el domiciliario, con casco negro y mochila de reparto roja',
  },
];

const Personajes = () => (
  <section id="equipo" className="py-32 px-6">
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-20">
        <div className="section-label">CONOCE AL EQUIPO</div>
        <h2 className="section-title">
          Cuatro personajes,<br /><span className="text-accent">un solo sistema</span>
        </h2>
        <p className="section-sub mx-auto">
          Cada uno representa una parte de Antigravity. Los verás acompañándote por toda la plataforma.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
        {cast.map((p, i) => (
          <motion.article
            key={p.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="flex flex-col items-center text-center"
          >
            <motion.div whileHover={{ y: -6 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
              <Character name={p.id} height={300} alt={p.alt} />
            </motion.div>
            <span className="mt-6 inline-flex items-center h-7 px-3 rounded-full bg-accent-dim text-accent text-xs font-semibold tracking-[0.04em] uppercase">
              {p.tag}
            </span>
            <h3 className="font-head text-2xl font-bold mt-4">{p.nombre}</h3>
            <p className="text-sm font-semibold text-muted mb-3">{p.rol}</p>
            <p className="text-muted text-sm leading-6 max-w-[260px]">{p.texto}</p>
          </motion.article>
        ))}
      </div>
    </div>
  </section>
);

export default Personajes;
