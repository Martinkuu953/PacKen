import { FaBoxOpen } from 'react-icons/fa';

// Contenedor visual compartido por Login y Registro:
// fondo gris, banda amarilla superior, logo PacKen y una card blanca.
export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col">
      {/* Banda amarilla superior, como en el diseño */}
      <div className="h-12 sm:h-14 bg-[#FBE38A] w-full" />

      <div className="flex-1 flex flex-col items-center px-4 py-8">
        {/* Logo PacKen */}
        <div className="flex items-center gap-2 mb-6">
          <FaBoxOpen className="text-3xl text-orange-500" />
          <span className="text-3xl font-bold text-[#1f3b8c]">PacKen</span>
        </div>

        {/* Card */}
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-xl shadow-sm px-6 sm:px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}

// Input con etiqueta y estilo de subrayado, como el diseño de Figma.
export function CampoSubrayado({ label, ...props }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      <input
        className="w-full border-0 border-b border-gray-300 bg-transparent px-1 py-1.5
                   text-gray-800 text-center focus:outline-none focus:border-[#FDE047]
                   focus:border-b-2 transition-colors"
        {...props}
      />
    </label>
  );
}

// Botón amarillo principal.
export function BotonPrincipal({ children, ...props }) {
  return (
    <button
      className="w-full bg-[#FDE047] hover:bg-[#facc15] disabled:opacity-60
                 disabled:cursor-not-allowed text-gray-800 font-bold py-2.5 rounded-lg
                 border border-yellow-500/40 shadow-sm transition-colors"
      {...props}
    >
      {children}
    </button>
  );
}
