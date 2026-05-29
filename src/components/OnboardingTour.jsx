import { useCallback, useEffect, useState } from 'react'
import { BellRing, FileText, PlugZap, Users, Wallet, Zap } from 'lucide-react'

const STEPS = [
  {
    target: null,
    Icon: Zap,
    bg: 'bg-[#5B4BFF]',
    iconCls: 'text-white',
    title: 'Bem-vindo ao Lembrei!',
    description: 'Automatize suas cobranças via WhatsApp em poucos cliques. Siga este guia rápido para configurar tudo.',
    tip: null,
  },
  {
    target: 'nav-clientes',
    Icon: Users,
    bg: 'bg-[#5B4BFF]/10',
    iconCls: 'text-[#5B4BFF]',
    title: 'Cadastre seus clientes',
    description: 'Adicione clientes um a um, importe dos contatos do celular (Android) ou faça upload de uma planilha CSV.',
    tip: 'Comece por aqui — sem clientes não é possível criar cobranças.',
  },
  {
    target: 'nav-cobrancas',
    Icon: Wallet,
    bg: 'bg-emerald-100',
    iconCls: 'text-emerald-700',
    title: 'Crie suas cobranças',
    description: 'Escolha o cliente, informe valor e vencimento. O Pix é gerado automaticamente. Você pode parcelar ou criar recorrência mensal.',
    tip: null,
  },
  {
    target: 'nav-templates',
    Icon: FileText,
    bg: 'bg-blue-100',
    iconCls: 'text-blue-600',
    title: 'Templates de descrição',
    description: 'Crie textos prontos para reutilizar nas cobranças. Ex: "Mensalidade Janeiro", "Aluguel", "Consulta".',
    tip: null,
  },
  {
    target: 'nav-automacoes',
    Icon: BellRing,
    bg: 'bg-amber-100',
    iconCls: 'text-amber-700',
    title: 'Automação de lembretes',
    description: 'Veja todas as mensagens agendadas. O sistema envia os lembretes nos dias que você configurar em cada cobrança.',
    tip: null,
  },
  {
    target: 'nav-configuracoes',
    Icon: PlugZap,
    bg: 'bg-violet-100',
    iconCls: 'text-violet-600',
    title: 'Conecte o Mercado Pago',
    description: 'Para gerar Pix automático nas cobranças, conecte sua conta Mercado Pago aqui. É necessário para o sistema funcionar.',
    tip: 'Tudo pronto! Agora é só cadastrar seus clientes e criar a primeira cobrança.',
  },
]

const DARK = 'rgba(7,13,45,0.82)'
const SPOTLIGHT_PAD = 10
const TOOLTIP_W = 276
const ARROW = 10

function findTarget(id) {
  if (!id) return null
  const els = document.querySelectorAll(`[data-tour="${id}"]`)
  for (const el of els) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 1) return el
  }
  return null
}

function autoPlace(r) {
  if (r.bottom > window.innerHeight * 0.72) return 'top'
  if (r.right < window.innerWidth * 0.45) return 'right'
  return 'left'
}

export function useOnboardingTour(userId) {
  const key = `lembrei_tour_v2_${userId}`
  const [show, setShow] = useState(() => Boolean(userId && !localStorage.getItem(key)))
  function finish() {
    if (userId) localStorage.setItem(key, '1')
    setShow(false)
  }
  return { show, finish }
}

function Dots({ total, current }) {
  return (
    <div className="flex justify-center gap-1.5 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? 'w-5 bg-[#5B4BFF]' : 'w-1.5 bg-slate-200'}`}
        />
      ))}
    </div>
  )
}

function Buttons({ stepIndex, totalSteps, isLast, onPrev, onNext, onClose, size = 'sm' }) {
  const py = size === 'lg' ? 'py-3' : 'py-2'
  const text = size === 'lg' ? 'text-sm' : 'text-xs'
  const radius = size === 'lg' ? 'rounded-2xl' : 'rounded-xl'
  return (
    <div className={`flex gap-2 border-t border-slate-100 px-5 ${size === 'lg' ? 'px-8 py-4' : 'py-3'}`}>
      {stepIndex > 0 ? (
        <button type="button" onClick={onPrev}
          className={`flex-1 ${radius} border border-slate-200 ${py} ${text} font-semibold text-slate-600 hover:bg-slate-50 transition`}>
          Voltar
        </button>
      ) : <div className="flex-1" />}
      <button type="button" onClick={isLast ? onClose : onNext}
        className={`flex-1 ${radius} bg-[#5B4BFF] ${py} ${text} font-bold text-white hover:bg-[#4A3BE8] transition`}>
        {isLast ? 'Começar!' : 'Próximo'}
      </button>
    </div>
  )
}

export default function OnboardingTour({ onClose }) {
  const [step, setStep] = useState(0)
  const [spotlight, setSpotlight] = useState(null) // { top, left, right, bottom, placement }

  const { target, Icon, bg, iconCls, title, description, tip } = STEPS[step]
  const isLast = step === STEPS.length - 1
  const next = () => setStep(s => s + 1)
  const prev = () => setStep(s => s - 1)

  const measure = useCallback(() => {
    const el = findTarget(target)
    if (!el) { setSpotlight(null); return }
    const r = el.getBoundingClientRect()
    setSpotlight({
      top: r.top - SPOTLIGHT_PAD,
      left: r.left - SPOTLIGHT_PAD,
      right: r.right + SPOTLIGHT_PAD,
      bottom: r.bottom + SPOTLIGHT_PAD,
      placement: autoPlace(r),
    })
  }, [target])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  const btnProps = {
    stepIndex: step, totalSteps: STEPS.length, isLast,
    onPrev: prev, onNext: next, onClose,
  }

  // ── Centered modal (step 0 or target not visible) ──────────────
  if (!spotlight) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070D2D]/82 p-4 backdrop-blur-sm">
        <button type="button" onClick={onClose}
          className="absolute right-5 top-5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition">
          Pular tour
        </button>
        <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="px-8 pb-2 pt-10 text-center">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${bg}`}>
              <Icon size={28} className={iconCls} />
            </div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[#5B4BFF]">
              Passo {step + 1} de {STEPS.length}
            </p>
            <h2 className="text-xl font-bold text-[#070D2D]">{title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">{description}</p>
            {tip && (
              <div className="mt-4 rounded-2xl bg-[#5B4BFF]/5 px-4 py-3 text-xs font-medium leading-relaxed text-[#5B4BFF]">
                {tip}
              </div>
            )}
          </div>
          <Dots total={STEPS.length} current={step} />
          <Buttons {...btnProps} size="lg" />
        </div>
      </div>
    )
  }

  // ── Spotlight mode ─────────────────────────────────────────────
  const { top: sTop, left: sLeft, right: sRight, bottom: sBottom, placement } = spotlight
  const vh = window.innerHeight
  const vw = window.innerWidth

  // Tooltip position
  const midV = sTop + (sBottom - sTop) / 2
  const midH = sLeft + (sRight - sLeft) / 2

  let ttStyle = {}
  let arrowStyle = {}

  if (placement === 'right') {
    const top = Math.max(8, Math.min(midV - 155, vh - 320))
    ttStyle = { position: 'fixed', top, left: sRight + 16 }
    arrowStyle = {
      position: 'absolute', left: -ARROW,
      top: Math.min(Math.max(ARROW * 2, midV - top - ARROW), 280),
      width: 0, height: 0,
      borderTop: `${ARROW}px solid transparent`,
      borderBottom: `${ARROW}px solid transparent`,
      borderRight: `${ARROW}px solid white`,
    }
  } else if (placement === 'left') {
    const top = Math.max(8, Math.min(midV - 155, vh - 320))
    ttStyle = { position: 'fixed', top, left: sLeft - 16 - TOOLTIP_W }
    arrowStyle = {
      position: 'absolute', right: -ARROW,
      top: Math.min(Math.max(ARROW * 2, midV - top - ARROW), 280),
      width: 0, height: 0,
      borderTop: `${ARROW}px solid transparent`,
      borderBottom: `${ARROW}px solid transparent`,
      borderLeft: `${ARROW}px solid white`,
    }
  } else { // top — tooltip above element
    const left = Math.max(8, Math.min(midH - TOOLTIP_W / 2, vw - TOOLTIP_W - 8))
    const arrowLeft = Math.min(Math.max(ARROW * 2, midH - left - ARROW), TOOLTIP_W - ARROW * 3)
    ttStyle = { position: 'fixed', bottom: vh - sTop + 16, left }
    arrowStyle = {
      position: 'absolute', bottom: -ARROW, left: arrowLeft,
      width: 0, height: 0,
      borderLeft: `${ARROW}px solid transparent`,
      borderRight: `${ARROW}px solid transparent`,
      borderTop: `${ARROW}px solid white`,
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* Dark overlay — 4 panels surrounding spotlight */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: Math.max(0, sTop), background: DARK }} />
      <div style={{ position: 'fixed', top: sTop, left: 0, width: Math.max(0, sLeft), height: sBottom - sTop, background: DARK }} />
      <div style={{ position: 'fixed', top: sTop, left: sRight, right: 0, height: sBottom - sTop, background: DARK }} />
      <div style={{ position: 'fixed', top: sBottom, left: 0, right: 0, bottom: 0, background: DARK }} />

      {/* Spotlight ring */}
      <div style={{
        position: 'fixed',
        top: sTop, left: sLeft,
        width: sRight - sLeft, height: sBottom - sTop,
        borderRadius: 12,
        boxShadow: '0 0 0 3px #5B4BFF, 0 0 0 7px rgba(91,75,255,0.25)',
        pointerEvents: 'none',
      }} />

      {/* Tooltip */}
      <div style={{ ...ttStyle, zIndex: 60 }}>
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ width: TOOLTIP_W }}>
          {/* Arrow */}
          <div style={arrowStyle} />

          {/* Content */}
          <div className="px-5 pt-5 pb-3">
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${bg}`}>
              <Icon size={18} className={iconCls} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#5B4BFF] mb-0.5">
              Passo {step + 1} de {STEPS.length}
            </p>
            <h3 className="text-sm font-bold text-[#070D2D]">{title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{description}</p>
            {tip && (
              <div className="mt-3 rounded-xl bg-[#5B4BFF]/5 px-3 py-2 text-[11px] font-medium leading-relaxed text-[#5B4BFF]">
                {tip}
              </div>
            )}
          </div>

          <Dots total={STEPS.length} current={step} />
          <Buttons {...btnProps} size="sm" />
        </div>
      </div>

      {/* Skip */}
      <button type="button" onClick={onClose}
        className="fixed right-5 top-5 z-[61] rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-white/20 transition">
        Pular tour
      </button>
    </div>
  )
}
