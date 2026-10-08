import React, { useState } from 'react';
import { Shuffle, RotateCcw } from 'lucide-react';
import OwnerAvatar from './OwnerAvatar';
import {
  GENEROS, PIEL, PELO_ESTILOS, PELO_COLORES, BARBAS, GAFAS, TATUAJES, ROPA_TIPOS, ROPA_COLORES,
  DEFAULT_AVATAR, sanitizeAvatar, randomAvatar,
} from './avatarConfig';

const TABS = [
  { id: 'genero', label: 'Cuerpo' },
  { id: 'piel', label: 'Piel' },
  { id: 'pelo', label: 'Pelo' },
  { id: 'barba', label: 'Barba' },
  { id: 'gafas', label: 'Gafas' },
  { id: 'tatuajes', label: 'Tatuajes' },
  { id: 'ropa', label: 'Ropa' },
];

function Choice({ selected, onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-1 p-2 rounded-2xl border cursor-pointer transition-colors bg-white ${
        selected ? 'border-accent bg-[#FDECEA]' : 'border-border hover:border-[#C9C9C9]'
      }`}
    >
      {children}
      <span className={`text-xs font-semibold ${selected ? 'text-accent' : 'text-muted'}`}>{label}</span>
    </button>
  );
}

function Swatch({ selected, onClick, label, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      title={label}
      className={`w-11 h-11 rounded-full cursor-pointer transition-transform border-2 ${
        selected ? 'border-accent scale-110' : 'border-[#C9C9C9] hover:scale-105'
      }`}
      style={{ background: color, boxShadow: selected ? '0 0 0 2px #FFFFFF inset' : undefined }}
    />
  );
}

const Section = ({ title, children }) => (
  <div className="mb-6 last:mb-0">
    <p className="text-xs font-semibold tracking-[0.04em] text-muted uppercase mb-3">{title}</p>
    <div className="flex flex-wrap gap-3">{children}</div>
  </div>
);

export default function AvatarEditor({ value, onChange }) {
  const [tab, setTab] = useState('genero');
  const v = sanitizeAvatar(value);
  const set = (patch) => onChange(sanitizeAvatar({ ...v, ...patch }));

  // Miniatura de una opción aplicada sobre el avatar actual
  const thumb = (patch, variant = 'busto') => (
    <OwnerAvatar config={{ ...v, ...patch }} variant={variant} height={variant === 'busto' ? 76 : 120} label="" />
  );

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-8 items-start">
      {/* Vista previa */}
      <div className="rounded-3xl bg-[#FDECEA] p-6 flex flex-col items-center gap-4">
        <OwnerAvatar config={v} height={340} />
        <div className="flex gap-2 w-full">
          <button
            type="button"
            onClick={() => onChange(randomAvatar())}
            className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-white border border-[#C9C9C9] text-sm font-semibold cursor-pointer hover:bg-bg2 transition-colors"
          >
            <Shuffle size={16} /> Aleatorio
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_AVATAR })}
            aria-label="Restablecer"
            title="Restablecer"
            className="h-11 w-11 inline-flex items-center justify-center rounded-xl bg-white border border-[#C9C9C9] cursor-pointer hover:bg-bg2 transition-colors"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Opciones */}
      <div>
        <div role="tablist" aria-label="Partes del avatar" className="flex flex-wrap gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`h-9 px-4 rounded-full text-sm font-semibold border-none cursor-pointer transition-colors ${
                tab === t.id ? 'bg-accent-dim text-accent' : 'bg-bg3 text-muted hover:text-text'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div role="tabpanel">
          {tab === 'genero' && (
            <Section title="¿Cómo te representamos?">
              {GENEROS.map((o) => (
                <Choice key={o.id} label={o.label} selected={v.genero === o.id} onClick={() => set({ genero: o.id })}>
                  {thumb({ genero: o.id }, 'cuerpo')}
                </Choice>
              ))}
            </Section>
          )}

          {tab === 'piel' && (
            <Section title="Tono de piel">
              {PIEL.map((o) => (
                <Swatch key={o.id} label={o.label} color={o.base} selected={v.piel === o.id} onClick={() => set({ piel: o.id })} />
              ))}
            </Section>
          )}

          {tab === 'pelo' && (
            <>
              <Section title="Peinado">
                {PELO_ESTILOS.map((o) => (
                  <Choice key={o.id} label={o.label} selected={v.pelo.estilo === o.id} onClick={() => set({ pelo: { ...v.pelo, estilo: o.id } })}>
                    {thumb({ pelo: { ...v.pelo, estilo: o.id } })}
                  </Choice>
                ))}
              </Section>
              <Section title="Color de pelo">
                {PELO_COLORES.map((o) => (
                  <Swatch key={o.id} label={o.label} color={o.hex} selected={v.pelo.color === o.id} onClick={() => set({ pelo: { ...v.pelo, color: o.id } })} />
                ))}
              </Section>
            </>
          )}

          {tab === 'barba' && (
            <Section title="Barba y bigote">
              {BARBAS.map((o) => (
                <Choice key={o.id} label={o.label} selected={v.barba === o.id} onClick={() => set({ barba: o.id })}>
                  {thumb({ barba: o.id })}
                </Choice>
              ))}
            </Section>
          )}

          {tab === 'gafas' && (
            <Section title="Gafas">
              {GAFAS.map((o) => (
                <Choice key={o.id} label={o.label} selected={v.gafas === o.id} onClick={() => set({ gafas: o.id })}>
                  {thumb({ gafas: o.id })}
                </Choice>
              ))}
            </Section>
          )}

          {tab === 'tatuajes' && (
            <>
              <Section title="Tatuajes">
                {TATUAJES.map((o) => (
                  <Choice key={o.id} label={o.label} selected={v.tatuajes === o.id} onClick={() => set({ tatuajes: o.id })}>
                    {thumb({ tatuajes: o.id }, 'cuerpo')}
                  </Choice>
                ))}
              </Section>
              <p className="text-xs text-muted -mt-2">El tatuaje del brazo se ve mejor con camiseta.</p>
            </>
          )}

          {tab === 'ropa' && (
            <>
              <Section title="Prenda">
                {ROPA_TIPOS.map((o) => (
                  <Choice key={o.id} label={o.label} selected={v.ropa.tipo === o.id} onClick={() => set({ ropa: { ...v.ropa, tipo: o.id } })}>
                    {thumb({ ropa: { ...v.ropa, tipo: o.id } }, 'cuerpo')}
                  </Choice>
                ))}
              </Section>
              <Section title="Color">
                {ROPA_COLORES.map((o) => (
                  <Swatch key={o.id} label={o.label} color={o.fill} selected={v.ropa.color === o.id} onClick={() => set({ ropa: { ...v.ropa, color: o.id } })} />
                ))}
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
