import { useState } from 'react'
import { X, Smartphone, Share, MoreVertical, CheckCircle2 } from 'lucide-react'
import { useInstallPWA } from '../hooks/useInstallPWA'

function Step({ number, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#5B4BFF] text-xs font-bold text-white">
        {number}
      </span>
      <p className="text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  )
}

function IOSSafariInstructions() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Para instalar o Lembrei na sua tela inicial siga os passos abaixo no <strong>Safari</strong>:
      </p>
      <div className="space-y-3">
        <Step number="1">
          Toque no ícone de compartilhar{' '}
          <Share size={13} className="inline -mt-0.5 text-[#5B4BFF]" />{' '}
          na barra inferior do Safari.
        </Step>
        <Step number="2">
          Role para baixo na lista e toque em{' '}
          <strong>"Adicionar à Tela de Início"</strong>.
        </Step>
        <Step number="3">
          Confirme tocando em <strong>"Adicionar"</strong> no canto superior direito.
        </Step>
      </div>
    </div>
  )
}

function IOSNotSafariInstructions() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      <p className="font-semibold">Abra no Safari para instalar</p>
      <p className="mt-1 leading-relaxed">
        No iPhone/iPad, a instalação de apps na tela inicial só é possível pelo navegador{' '}
        <strong>Safari</strong>. Abra este site lá e repita o processo.
      </p>
      <p className="mt-2 select-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-slate-700">
        www.uselembrei.com.br
      </p>
    </div>
  )
}

function AndroidInstructions() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Instale manualmente pelo menu do Chrome:
      </p>
      <div className="space-y-3">
        <Step number="1">
          Toque nos três pontinhos{' '}
          <MoreVertical size={13} className="inline -mt-0.5 text-[#5B4BFF]" />{' '}
          no canto superior direito do Chrome.
        </Step>
        <Step number="2">
          Selecione <strong>"Adicionar à tela inicial"</strong>.
        </Step>
        <Step number="3">
          Confirme tocando em <strong>"Adicionar"</strong>.
        </Step>
      </div>
    </div>
  )
}

function DesktopInstructions() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Instale pelo Chrome clicando no ícone na barra de endereço:
      </p>
      <div className="space-y-3">
        <Step number="1">
          Na barra de endereço do Chrome, clique no ícone de instalação{' '}
          <strong>⊕</strong> à direita.
        </Step>
        <Step number="2">
          Clique em <strong>"Instalar"</strong> na janela que aparece.
        </Step>
      </div>
      <p className="text-xs text-slate-400">
        Se o ícone não aparecer, use o menu Chrome → <strong>"Salvar e compartilhar"</strong> → <strong>"Instalar como app"</strong>.
      </p>
    </div>
  )
}

export default function InstallModal({ onClose }) {
  const { isInstalled, isIOS, isAndroid, isSafari, canPrompt, promptInstall } =
    useInstallPWA()
  const [installing, setInstalling] = useState(false)
  const [done, setDone] = useState(false)

  async function handleNativeInstall() {
    setInstalling(true)
    const accepted = await promptInstall()
    setInstalling(false)
    if (accepted) setDone(true)
  }

  const showNativeButton = canPrompt && !isInstalled

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-[#5B4BFF] px-6 pt-8 pb-6 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl bg-white/10 p-1.5 hover:bg-white/20 transition"
          >
            <X size={16} />
          </button>

          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl shadow-lg">
              <img src="/icon-lembrei.png" alt="Lembrei" className="h-full w-full object-cover" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Lembrei</h2>
              <p className="mt-0.5 text-sm text-white/70">Instale na tela inicial</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {done || isInstalled ? (
            <div className="flex flex-col items-center py-4 text-center">
              <CheckCircle2 size={48} className="text-emerald-500" />
              <p className="mt-3 text-lg font-bold text-[#070D2D]">App instalado!</p>
              <p className="mt-1 text-sm text-slate-500">
                O Lembrei já está na sua tela inicial. Pode fechar esta janela.
              </p>
            </div>
          ) : (
            <>
              {isIOS && isSafari && <IOSSafariInstructions />}
              {isIOS && !isSafari && <IOSNotSafariInstructions />}
              {isAndroid && !showNativeButton && <AndroidInstructions />}
              {!isIOS && !isAndroid && !showNativeButton && <DesktopInstructions />}

              {showNativeButton && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">
                    Instale o Lembrei diretamente na sua tela inicial para acesso rápido, como um app nativo.
                  </p>
                  <button
                    type="button"
                    onClick={handleNativeInstall}
                    disabled={installing}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5B4BFF] py-3.5 text-sm font-bold text-white transition hover:bg-[#4A3BE8] disabled:opacity-60"
                  >
                    <Smartphone size={16} />
                    {installing ? 'Aguarde...' : 'Instalar agora'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!done && !isInstalled && (
          <div className="border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
