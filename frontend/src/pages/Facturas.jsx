import PanelEmision from '../components/PanelEmision';

// Facturas: lo que la empresa le COBRA a cada seller por los paquetes que se le
// entregaron en el período, según su lista de precios.
//
// Es el espejo de Liquidaciones y comparte con ella toda la pantalla: lo que
// cambia es a quién se le emite y con qué lista se valoriza cada paquete.
const CONFIG = {
  endpoint: '/api/facturas',
  titulo: 'Facturas',
  documento: 'factura',
  documentos: 'facturas',
  contraparte: 'seller',
  contrapartes: 'sellers',
  // La otra punta del paquete, en el detalle: quién lo entregó.
  columnaSecundaria: 'Transportista',
  archivo: 'factura',
  archivos: 'facturas',
  textoRango: 'Se facturan',
  sinLista: 'Sin lista de precios asignada',
  noEmitible: 'No facturable',
  vacio: 'Todavía no creaste ningún seller.',
};

const Facturas = () => <PanelEmision config={CONFIG} />;

export default Facturas;
