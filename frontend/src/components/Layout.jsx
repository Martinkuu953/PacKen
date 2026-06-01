import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="flex bg-[#F3F4F6] min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
