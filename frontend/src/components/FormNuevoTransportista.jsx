import { useState } from 'react';
import { apiFetch } from '../services/api';

const INPUT = 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-yellow-300';
const LABEL = 'block text-[11px] font-semibold text-gray-500 uppercase mb-1';

const VACIO = { nombre: '', email: '', dni: '', password: '' };

const FormNuevoTransportista = ({ onCreado, onCancelar }) => {
  const [valores, setValores] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const set = (campo) => (e) => setValores((prev) => ({ ...prev, [campo]: e.target.value }));

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      await apiFetch('/api/transportistas', { method: 'POST', body: JSON.stringify(valores) });
      setValores(VACIO);
      onCreado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
      <h3 className="text-sm font-bold text-gray-800 mb-3">Nuevo transportista</h3>

      {error && (
        <p className="mb-3 text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className={LABEL} htmlFor="transp-nombre">Nombre</label>
          <input id="transp-nombre" className={INPUT} value={valores.nombre} onChange={set('nombre')} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="transp-email">Email</label>
          <input id="transp-email" type="email" className={INPUT} value={valores.email} onChange={set('email')} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="transp-dni">DNI</label>
          <input id="transp-dni" className={INPUT} value={valores.dni} onChange={set('dni')} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="transp-password">Contraseña inicial</label>
          <input
            id="transp-password"
            type="text"
            className={INPUT}
            value={valores.password}
            onChange={set('password')}
            placeholder="Mínimo 8 caracteres"
            minLength={8}
            required
          />
        </div>
      </div>

      <p className="mt-2 text-xs text-gray-500">
        El transportista queda activo al crearlo. Pasale la contraseña para que ingrese y la cambie.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={guardando}
          className="text-sm px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50 font-medium"
        >
          {guardando ? 'Creando...' : 'Crear transportista'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="text-sm px-4 py-2 text-gray-600 hover:text-gray-900 font-medium"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default FormNuevoTransportista;
