import PanelEmision from '../components/PanelEmision';

// Liquidaciones: lo que la empresa le PAGA a cada transportista por los
// paquetes que entregó en el período, según su lista de costos.
//
// Todo el flujo vive en PanelEmision, compartido con Facturas: acá solo está
// el vocabulario y a qué endpoint le pega.
const CONFIG = {
  endpoint: '/api/liquidaciones',
  titulo: 'Liquidaciones',
  documento: 'liquidación',
  documentos: 'liquidaciones',
  contraparte: 'transportista',
  contrapartes: 'transportistas',
  // La otra punta del paquete, en el detalle: quién lo despachó.
  columnaSecundaria: 'Seller',
  archivo: 'liquidacion',
  archivos: 'liquidaciones',
  textoRango: 'Se liquidan',
  sinLista: 'Sin lista de costos asignada',
  noEmitible: 'No liquidable',
  vacio: 'Todavía no creaste ningún transportista.',
};

const Liquidaciones = () => <PanelEmision config={CONFIG} />;

export default Liquidaciones;
