// Marca de PacKen. `fondo` es el color del fondo sobre el que se apoya, no el
// del logo: la variante "claro" tiene tinta oscura y la "oscuro" tinta clara.
// Los nombres siguen los de los archivos en public/ para que no se inviertan.
//
// width/height son los del PNG: con la relación de aspecto declarada el
// navegador reserva el espacio antes de bajar la imagen y no salta el layout.
const Logo = ({ className = 'h-7', fondo = 'claro' }) => (
  <img
    src={`/packen-7b-${fondo}.png`}
    alt="PacKen"
    width={433}
    height={73}
    className={`w-auto ${className}`}
  />
);

export default Logo;
