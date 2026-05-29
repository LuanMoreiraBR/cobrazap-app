import { useState } from 'react'
import { BellRing, FileText, FolderOpen, Users, Wallet, Zap } from 'lucide-react'

const STEPS = [
  {
    icon: Zap,
    bg: 'bg-[#5B4BFF]',
    iconCls: 'text-white',
    title: 'Bem-vindo ao Lembrei!',
    description:
      'Automatize suas cobranças via WhatsApp em poucos cliques. Este guia rápido mostra como começar.',
    tip: null,
  },
  {
    icon: Users,
    bg: 'bg-[#5B4BFF]/10',
    iconCls: 'text-[#5B4BFF]',
    title: 'Cadastre seus clientes',
    description:
      'Vá em Clientes e adicione um a um, importe pelo contatos do celular (Android) ou suba uma planilha CSV com nome e telefone.',
    tip: 'Baixe o modelo CSV na página de Clientes para agilizar a importação em massa.',
  },
  {
    icon: FolderOpen,
    bg: 'bg-violet-100',
    iconCls: 'text-violet-600',
    title: 'Crie grupos de cobrança',
    description:
      'Agrupe clientes para cobrar vários de uma vez com o mesmo valor, vencimento e mensagem — sem repetir o trabalho.',
    tip: 'Ideal para turmas, assinaturas ou clientes com plano idêntico.',
  },
  {
    icon: FileText,
    bg: 'bg-blue-100',
    iconCls: 'text-blue-600',
    title: 'Monte seus templates',
    description:
      'Crie descrições prontas para reutilizar nas cobranças. Ex: "Mensalidade Janeiro", "Aluguel Março", "Consulta".',
    tip: null,
  },
  {
    icon: Wallet,
    bg: 'bg-emerald-100',
    iconCls: 'text-emerald-700',
    title: 'Crie suas cobranças',
    description:
      'Escolha o cliente (ou grupo), informe valor e vencimento. O Pix é gerado automaticamente. Você pode parcelar ou criar recorrência mensal.',
    tip: 'Conecte sua conta Mercado Pago em Configurações para ativar o Pix.',
  },
  {
    icon: BellRing,
    bg: 'bg-amber-100',
    iconCls: 'text-amber-700',
    title: 'Automação no WhatsApp',
    description:
      'Configure quando o sistema envia os lembretes: 30 dias antes, no vencimento ou após o prazo. Tudo acontece automaticamente.',
    tip: 'Pronto! Agora é só cadastrar seus clientes e criar a primeira cobrança.',
  },
]

export function useOnboardingTour(userId) {
  const key = `lembrei_tour_v1_${userId}`
  const [show, setShow] = useState(() => Boolean(userId && !localStorage.getItem(key)))

  function finish() {
    if (userId) localStorage.setItem(`lembrei_tour_v1_${userId}`, '1')
    setShow(false)
  }

  return { show, finish }
}

export default function OnboardingTour({ onClose }) {
  const [step, setStep] = useState(0)
  const { icon: Icon, bg, iconCls, title, description, tip } = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070D2D]/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl">
        {/* Skip */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 text-xs font-semibold text-slate-400 transition hover:text-slate-600"
        >
          Pular tour
        </button>

        {/* Content */}
        <div className="px-8 pb-4 pt-10 text-center">
          <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl ${bg}`}>
            <Icon size={28} className={iconCls} />
          </div>

          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-[#5B4BFF]">
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

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 py-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all ${
                i === step ? 'w-6 bg-[#5B4BFF]' : 'w-2 bg-slate-200 hover:bg-slate-300'
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 border-t border-slate-100 px-8 py-5">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Voltar
            </button>
          ) : (
            <div className="flex-1" />
          )}
          <button
            type="button"
            onClick={isLast ? onClose : () => setStep((s) => s + 1)}
            className="flex-1 rounded-2xl bg-[#5B4BFF] py-3 text-sm font-bold text-white transition hover:bg-[#4A3BE8]"
          >
            {isLast ? 'Começar agora!' : 'Próximo'}
          </button>
        </div>
      </div>
    </div>
  )
}
