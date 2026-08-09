import GestorListas from '../components/GestorListas';

const ListasCostos = () => (
  <GestorListas
    tipo="costo"
    titulo="Listas de costos"
    descripcion="Cada lista fija un costo por zona. Los transportistas se asignan a una lista: eso es lo que se les paga."
    entidadSingular="transportista"
    entidadPlural="transportistas"
  />
);

export default ListasCostos;
