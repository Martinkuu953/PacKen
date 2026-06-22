import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUpload, FiMapPin } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import AuthShell, { CampoSubrayado, BotonPrincipal } from '../components/auth/AuthShell';

export default function Registro() {
  const { registrarSeller } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nombre: '',
    empresa: '',
    correoelectronico: '',
    telefono: '',
    contrasena: '',
    ubicacion: '',
  });
  const [fotoNombre, setFotoNombre] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  function actualizar(campo) {
    return (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  }

  async function manejarSubmit(e) {
    e.preventDefault();
    setError('');
    setEnviando(true);
    try {
      await registrarSeller({
        ...form,
        nombre: form.nombre.trim(),
        correoelectronico: form.correoelectronico.trim(),
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'No pudimos crear la cuenta');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
        Registrarse
      </h1>

      <form onSubmit={manejarSubmit} className="space-y-4">
        <CampoSubrayado
          label="Nombre:"
          type="text"
          value={form.nombre}
          onChange={actualizar('nombre')}
          required
        />
        <CampoSubrayado
          label="Empresa:"
          type="text"
          value={form.empresa}
          onChange={actualizar('empresa')}
        />
        <CampoSubrayado
          label="Correo electrónico:"
          type="email"
          value={form.correoelectronico}
          onChange={actualizar('correoelectronico')}
          autoComplete="email"
          required
        />
        <CampoSubrayado
          label="Número Telefónico:"
          type="tel"
          value={form.telefono}
          onChange={actualizar('telefono')}
          autoComplete="tel"
        />
        <CampoSubrayado
          label="Contraseña:"
          type="password"
          value={form.contrasena}
          onChange={actualizar('contrasena')}
          autoComplete="new-password"
          required
        />

        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          {/* Foto de perfil (visual por ahora: aún no se persiste) */}
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <span>Foto de Perfil:</span>
            <span className="inline-flex items-center gap-1 text-[#1f3b8c] hover:underline">
              <FiUpload /> {fotoNombre || 'Subir'}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFotoNombre(e.target.files?.[0]?.name ?? '')}
            />
          </label>

          {/* Ubicación */}
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 flex-1">
            <FiMapPin className="shrink-0" />
            <input
              type="text"
              placeholder="Ubicación"
              value={form.ubicacion}
              onChange={actualizar('ubicacion')}
              className="w-full border-0 border-b border-gray-300 bg-transparent px-1 py-1
                         focus:outline-none focus:border-[#FDE047] focus:border-b-2"
            />
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center" role="alert">
            {error}
          </p>
        )}

        <BotonPrincipal type="submit" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Registrarse'}
        </BotonPrincipal>
      </form>

      <p className="text-sm text-center text-gray-600 mt-6">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-semibold text-[#1f3b8c] hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </AuthShell>
  );
}
