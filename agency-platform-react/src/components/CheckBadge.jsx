import React from 'react';

// Sello de "hecho": círculo verde que aparece con rebote y un chulo que se dibuja.
// Las animaciones están en index.css (.noma-badge / .noma-check) y se apagan con prefers-reduced-motion.
export default function CheckBadge({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      className={`noma-badge ${className}`}
    >
      <circle cx="14" cy="14" r="12.5" fill="var(--success)" stroke="#0A0A0A" strokeWidth="2" />
      <path
        className="noma-check"
        d="M8.5 14.5 L12.5 18.5 L19.5 10"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
