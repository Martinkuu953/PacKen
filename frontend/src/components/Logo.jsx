// Marca de PacKen. `fondo` es el color del fondo sobre el que se apoya, no el
// del logo: la variante "claro" tiene tinta oscura y la "oscuro" tinta clara.
// Los nombres siguen los de los archivos en public/ para que no se inviertan.
//
// width/height son los del PNG: con la relación de aspecto declarada el
// navegador reserva el espacio antes de bajar la imagen y no salta el layout.
//
// `max-w-none` y `object-contain` están por el achatamiento en celular: el
// reset de Tailwind le pone max-width:100% a toda imagen, y como acá la altura
// va fija por clase, en un contenedor angosto el ancho se recortaba y el logo
// salía aplastado. Con max-w-none conserva su ancho natural, y object-contain
// lo deja proporcionado igual si algún contenedor lo llega a apretar.
const Logo = ({ className = 'h-7', fondo = 'claro' }) => (
  <img
    src={`/packen-7b-${fondo}.png`}
    alt="PacKen"
    width={433}
    height={73}
    className={`w-auto max-w-none object-contain ${className}`}
  />
);

export default Logo;
