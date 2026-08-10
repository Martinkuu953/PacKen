import { useAuth } from '../context/AuthContext';
import PaquetesEmpresa from './PaquetesEmpresa';
import PaquetesTransportista from './PaquetesTransportista';

const Paquetes = () => {
  const { esTransportista } = useAuth();
  return esTransportista ? <PaquetesTransportista /> : <PaquetesEmpresa />;
};

export default Paquetes;
