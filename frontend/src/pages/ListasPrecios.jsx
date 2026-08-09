import GestorListas from '../components/GestorListas';

const ListasPrecios = () => (
  <GestorListas
    tipo="precio"
    titulo="Listas de precios"
    descripcion="Cada lista fija un precio por zona. Los sellers se asignan a una lista: ese es el precio que se les cobra."
    entidadSingular="seller"
    entidadPlural="sellers"
  />
);

export default ListasPrecios;
