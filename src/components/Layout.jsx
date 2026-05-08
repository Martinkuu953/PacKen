import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="flex bg-[#F3F4F6] min-h-screen">
      <Sidebar />
      {/* El margen izquierdo (ml-64) deja espacio para el Sidebar fijo */}
      <main className="flex-1 ml-64 p-8">
        {/* Acá adentro se va a renderizar la pantalla que corresponda */}
        {children}
      </main>
    </div>
  );
};

export default Layout;