'use client'

/**
 * Última red de la app: cualquier error de servidor que nadie atrapó.
 *
 * No puede decir QUÉ pasó: en producción Next solo le entrega un digest, sin
 * tipo ni mensaje. Por eso las fallas que sí se saben (sin sesión, sin permiso,
 * módulo apagado) se resuelven antes, redirigiendo desde la página — ver
 * requireModuleOrRedirect en lib/auth-helpers.ts. Esto es para lo imprevisto.
 *
 * El digest se muestra a propósito: es lo único que permite cruzar lo que vio
 * el usuario con el log del servidor cuando llama un día de elecciones.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1rem',
      padding: '2rem', textAlign: 'center',
    }}>
      <h1 style={{ margin: 0, fontSize: '1.35rem', color: '#0f172a' }}>
        Algo falló al cargar esta pantalla
      </h1>
      <p style={{ margin: 0, maxWidth: '32rem', color: '#64748b', fontSize: '0.9rem', lineHeight: 1.5 }}>
        No se pudo completar la operación. Puedes reintentar; si vuelve a pasar,
        reporta el código de abajo para que quede rastro de qué ocurrió.
      </p>

      {error.digest && (
        <code style={{
          background: '#f1f5f9', color: '#334155', padding: '0.35rem 0.6rem',
          borderRadius: '6px', fontSize: '0.8rem',
        }}>
          {error.digest}
        </code>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button
          onClick={reset}
          style={{
            padding: '0.6rem 1.1rem', fontSize: '0.875rem', borderRadius: '8px',
            border: 'none', background: '#1e40af', color: '#fff',
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          Reintentar
        </button>
        <a
          href="/"
          style={{
            padding: '0.6rem 1.1rem', fontSize: '0.875rem', borderRadius: '8px',
            border: '1px solid #cbd5e1', background: '#fff', color: '#334155',
            cursor: 'pointer', fontWeight: 600, textDecoration: 'none',
          }}
        >
          Volver al inicio
        </a>
      </div>
    </div>
  )
}
