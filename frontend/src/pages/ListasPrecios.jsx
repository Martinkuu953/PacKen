import ListaGenerica from '../components/ListaGenerica';

const ListasPrecios = () => (
  <ListaGenerica
    tipo="precio"
    tituloPagina="Listas de precios"
    descripcion="Armá listas con un precio por zona y agregá sellers: es lo que le cobrás a cada seller por sus entregas."
    entidadLabel="Seller"
    entidadLabelPlural="sellers"
    campoMontoLabel="Precio"
  />
);

export default ListasPrecios;
