import ListaGenerica from '../components/ListaGenerica';

const ListasCostos = () => (
  <ListaGenerica
    tipo="costo"
    tituloPagina="Listas de costos"
    descripcion="Armá listas con un costo por zona y agregá transportistas: es lo que le pagás a cada transportista por sus entregas."
    entidadLabel="Transportista"
    entidadLabelPlural="transportistas"
    campoMontoLabel="Costo"
  />
);

export default ListasCostos;
