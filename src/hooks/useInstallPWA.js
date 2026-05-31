import { useEffect, useState } from 'react'

export function useInstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true

  useEffect(() => {
    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    function onBeforeInstall(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    function onAppInstalled() {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [isStandalone])

  async function promptInstall() {
    if (!deferredPrompt) return false
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setDeferredPrompt(null)
    return outcome === 'accepted'
  }

  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream
  const isAndroid = /android/i.test(ua)
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua)
  const canPrompt = Boolean(deferredPrompt)

  return {
    isInstalled: isInstalled || isStandalone,
    isIOS,
    isAndroid,
    isSafari,
    canPrompt,
    promptInstall,
  }
}
