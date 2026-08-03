// Input de búsqueda para las tablas. Filtra en el cliente sobre los datos ya
// cargados, así que responde en el acto y no pega a la API en cada tecla.

const Buscador = ({ valor, onChange, placeholder = 'Buscar...', resultados, total }) => {
  const filtrando = valor.trim().length > 0;

  return (
    <div className="mb-4">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
          🔍
        </span>
        <input
          type="search"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all"
        />
        {filtrando && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors duration-150 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {filtrando && typeof resultados === 'number' && (
        <p className="mt-1.5 text-xs text-gray-500">
          {resultados === 0
            ? 'Sin resultados'
            : `${resultados} de ${total} resultado${resultados === 1 ? '' : 's'}`}
        </p>
      )}
    </div>
  );
};

export default Buscador;
