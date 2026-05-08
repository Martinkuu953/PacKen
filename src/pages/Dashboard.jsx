import { 
  FaChartBar, 
  FaUserTie, 
  FaMotorcycle, 
  FaFileInvoiceDollar, 
  FaMobileAlt, 
  FaClipboardList 
} from 'react-icons/fa';

const Dashboard = () => {
  // Datos simulados (Mock data) para la tabla de la derecha
  const paquetesRecientes = [
    { cliente: 'Ana', seller: 'Baby Movil', transportista: 'Jorge Moreno', ubicacion: 'CABA', zona: 'Capital', estado: 'Atrasado' },
    { cliente: 'Marcos', seller: 'Baby Movil', transportista: 'Jorge Moreno', ubicacion: 'CABA', zona: 'Capital', estado: 'En camino' },
    { cliente: 'Federico', seller: 'Toca Juguetería', transportista: 'Jorge Moreno', ubicacion: 'CABA', zona: 'Capital', estado: 'Entregado' },
    { cliente: 'Valentín', seller: 'Toys Kids', transportista: 'Jorge Moreno', ubicacion: 'CABA', zona: 'Capital', estado: 'Atrasado' },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      
      {/* 1. Tarjeta Principal: Estado Logístico */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">La Veloz</h2>
        
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Columna Izquierda: Resumen Numérico */}
          <div className="flex flex-col justify-between w-full lg:w-1/3 space-y-4">
            <div>
              <p className="text-gray-500 font-semibold text-sm">Paquetes Actuales</p>
              <p className="text-xl font-bold"><span className="text-green-500">208</span>/2800 Entregados</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold text-sm">Demorados</p>
              <p className="text-xl font-bold text-yellow-500">105/2080</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold text-sm">Reprogramados</p>
              <p className="text-xl font-bold text-orange-500">100/2080</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold text-sm">Cancelados</p>
              <p className="text-xl font-bold text-red-500">15/2080</p>
            </div>
          </div>

          {/* Columna Derecha: Tabla de Seguimiento Rápido */}
          <div className="w-full lg:w-2/3 bg-gray-50 rounded-xl p-4 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase border-b border-gray-200">
                <tr>
                  <th className="py-2 px-2">Cliente Final</th>
                  <th className="py-2 px-2">Seller</th>
                  <th className="py-2 px-2">Transportista</th>
                  <th className="py-2 px-2">Ubicación</th>
                  <th className="py-2 px-2">Zona</th>
                  <th className="py-2 px-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {paquetesRecientes.map((paquete, index) => (
                  <tr key={index} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 px-2 font-medium">{paquete.cliente}</td>
                    <td className="py-2 px-2">{paquete.seller}</td>
                    <td className="py-2 px-2">{paquete.transportista}</td>
                    <td className="py-2 px-2">{paquete.ubicacion}</td>
                    <td className="py-2 px-2">{paquete.zona}</td>
                    <td className={`py-2 px-2 font-bold ${
                      paquete.estado === 'Atrasado' ? 'text-red-500' :
                      paquete.estado === 'Entregado' ? 'text-green-500' : 'text-yellow-500'
                    }`}>
                      {paquete.estado}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. Tarjeta de Utilidad */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-bold text-gray-800">Utilidad</h3>
          <select className="bg-yellow-200 text-yellow-800 font-bold px-3 py-1 rounded-full outline-none cursor-pointer">
            <option>Este Día</option>
            <option>Esta Semana</option>
            <option>Este Mes</option>
          </select>
        </div>
        <p className="text-2xl font-bold text-green-500">$ 200,000</p>
      </div>

      {/* 3. Grilla de Botones de Acceso Rápido */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
        {[
          { icon: <FaChartBar size={40} />, label: 'Estadísticas' },
          { icon: <FaUserTie size={40} />, label: 'Sellers' },
          { icon: <FaMotorcycle size={40} />, label: 'Transportistas' },
          { icon: <FaFileInvoiceDollar size={40} />, label: 'Facturas' },
          { icon: <FaMobileAlt size={40} />, label: 'Liquidaciones' },
          { icon: <FaClipboardList size={40} />, label: 'Lista de Precios' },
        ].map((btn, index) => (
          <button 
            key={index}
            className="flex flex-col items-center justify-center bg-white border border-gray-200 rounded-2xl p-8 hover:shadow-md hover:border-yellow-400 transition-all cursor-pointer group"
          >
            <div className="text-gray-600 group-hover:text-yellow-500 transition-colors mb-4">
              {btn.icon}
            </div>
            <span className="font-semibold text-gray-800">{btn.label}</span>
          </button>
        ))}
      </div>

    </div>
  );
};

export default Dashboard;