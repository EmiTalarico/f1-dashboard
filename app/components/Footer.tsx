export default function Footer() {
  return (
    <footer
      className="mt-16 px-6 py-8 text-center"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="max-w-2xl mx-auto">
        {/* Logo texto */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <span className="text-lg font-black tracking-tight">
            <span style={{ color: 'var(--f1-red)' }}>F1</span>
            <span style={{ color: 'rgba(255,255,255,0.9)' }}>Pasión</span>
          </span>
        </div>

        {/* Texto del proyecto */}
        <p className="text-sm leading-relaxed mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
          Un proyecto independiente hecho con{' '}
          <span style={{ color: 'var(--f1-red)' }}>❤️</span>{' '}
          para fanáticos de la Fórmula 1. Sin afiliación oficial con la FIA,
          Formula 1 ni ninguna escudería. Solo pasión pura por el Motorsport!
        </p>

        {/* Cafecito */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Si te gusta lo que hago
          </span>
          <a
            href="https://cafecito.app/f1pasion"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-150 hover:scale-105 hover:opacity-90"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
            }}
          >
            🍩 Hacete un Donout!
          </a>
        </div>

        {/* Disclaimer */}
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Los datos se obtienen de fuentes públicas. F1Pasión no se responsabiliza
          por la exactitud o disponibilidad de la información.
        </p>
      </div>
    </footer>
  )
}