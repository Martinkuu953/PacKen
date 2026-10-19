// Packi, la mascota de PacKen: la caja inclinada del logo (grafito, tapa más
// clara y la cinta crema al medio) con dos ojos. A propósito mínima: es un
// ícono, no un personaje.
const Packi = ({ size = 32, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
    <polygon points="16,12 54,12 50,52 10,52" fill="#2E3136" />
    <polygon points="16,12 54,12 53,22 15,22" fill="#4A4E55" />
    <polygon points="29,12 37,12 33,52 25,52" fill="#FCFBF8" />
    <circle cx="20" cy="35" r="2.6" fill="#FCFBF8" />
    <circle cx="42" cy="35" r="2.6" fill="#FCFBF8" />
  </svg>
);

export default Packi;
