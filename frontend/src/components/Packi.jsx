// Packi, la mascota de PacKen: la caja inclinada del logo (grafito, tapa más
// clara y la cinta crema al medio) con cara. SVG inline para que se vea nítida
// en cualquier tamaño y no sume una imagen a la carga.
//
// `animado` activa la flotación, el parpadeo y el saludo al pasar el mouse
// (clases packi-* en index.css, que se apagan con "reducir movimiento").
const Packi = ({ size = 64, animado = false, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    aria-hidden="true"
    className={`${animado ? 'packi-animado' : ''} ${className}`}
  >
    {/* Sombra en el piso: queda fija mientras el cuerpo flota. */}
    <ellipse className="packi-sombra" cx="31" cy="59" rx="15" ry="2.6" fill="#2E3136" opacity="0.18" />

    <g className="packi-cuerpo">
      {/* Bracito izquierdo */}
      <path d="M13 37 L8 41" stroke="#2E3136" strokeWidth="3.2" strokeLinecap="round" />
      {/* Bracito derecho: es el que saluda */}
      <path className="packi-brazo" d="M49 35 L55 29" stroke="#2E3136" strokeWidth="3.2" strokeLinecap="round" />

      {/* Caja */}
      <polygon points="16,13 53,13 49,53 11,53" fill="#2E3136" />
      <polygon points="16,13 53,13 52,23 15,23" fill="#4A4E55" />
      {/* Cinta */}
      <polygon points="29,13 36.5,13 32.5,53 25,53" fill="#FCFBF8" />

      {/* Cachetes */}
      <ellipse cx="17.5" cy="41" rx="2.6" ry="1.6" fill="#F2B400" opacity="0.85" />
      <ellipse cx="43.5" cy="41" rx="2.6" ry="1.6" fill="#F2B400" opacity="0.85" />

      {/* Ojos */}
      <g className="packi-ojos">
        <ellipse cx="20.5" cy="33" rx="4" ry="4.6" fill="#FCFBF8" />
        <circle cx="21.3" cy="33.6" r="2.2" fill="#2E3136" />
        <circle cx="22.1" cy="32.6" r="0.8" fill="#FCFBF8" />

        <ellipse cx="41.5" cy="33" rx="4" ry="4.6" fill="#FCFBF8" />
        <circle cx="42.3" cy="33.6" r="2.2" fill="#2E3136" />
        <circle cx="43.1" cy="32.6" r="0.8" fill="#FCFBF8" />
      </g>

      {/* Sonrisa, sobre la cinta */}
      <path d="M26.8 42.5 Q29.8 45.6 32.8 42.5" stroke="#2E3136" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </g>
  </svg>
);

export default Packi;
