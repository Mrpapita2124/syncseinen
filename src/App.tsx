import React, { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Cloud,
  EyeOff,
  FolderOpen,
  FolderSync,
  HardDrive,
  ImagePlus,
  Laptop,
  LayoutGrid,
  Link2,
  Link2Off,
  List,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Rocket,
  Settings,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import {
  AppConfig,
  CloudProvider,
  SyncMetadata,
  SyncProgressEvent,
  UpdateCheckResult,
  UpdateProgressEvent,
} from './types'
import { CreateSyncModal } from './components/CreateSyncModal'
import { IgnoreFilesModal } from './components/IgnoreFilesModal'
import { UpdateModal } from './components/UpdateModal'
import { CoverPickerModal } from './components/CoverPickerModal'

const ALL_PROVIDERS: CloudProvider[] = ['gdrive', 'dropbox', 'onedrive']

const PROVIDER_META: Record<
  CloudProvider,
  {
    label: string
    shortDesc: string
    badgeColor: string
    accentText: string
  }
> = {
  gdrive: {
    label: 'Google Drive',
    shortDesc: 'Sincronización directa con tu unidad de Google Drive',
    badgeColor: 'from-sky-500/25 to-blue-600/25 border-sky-400/40 text-sky-300',
    accentText: 'text-sky-400',
  },
  dropbox: {
    label: 'Dropbox',
    shortDesc: 'Sincronización rápida con tus carpetas de Dropbox',
    badgeColor: 'from-indigo-500/25 to-sky-500/25 border-indigo-400/40 text-indigo-300',
    accentText: 'text-indigo-400',
  },
  onedrive: {
    label: 'OneDrive',
    shortDesc: 'Sincronización con tu nube de Microsoft OneDrive',
    badgeColor: 'from-blue-500/25 to-cyan-500/25 border-cyan-400/40 text-cyan-300',
    accentText: 'text-cyan-400',
  },
}

const ProviderIcon: React.FC<{ provider: CloudProvider; className?: string }> = ({
  provider,
  className = 'w-5 h-5',
}) => {
  if (provider === 'gdrive') {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path
          d="M8.5 3.5L15.5 3.5L22 14.5L15 14.5L8.5 3.5Z"
          fill="#FFC107"
        />
        <path
          d="M2 14.5L8.5 3.5L12 9.5L5.5 20.5L2 14.5Z"
          fill="#00AC47"
        />
        <path
          d="M5.5 20.5L22 14.5L18.5 20.5L5.5 20.5Z"
          fill="#2684FC"
        />
      </svg>
    )
  }
  if (provider === 'dropbox') {
    return (
      <svg viewBox="0 0 24 24" fill="#0061FF" className={className}>
        <path d="M6.5 3L1 6.6L6.5 10.2L12 6.6L6.5 3ZM17.5 3L12 6.6L17.5 10.2L23 6.6L17.5 3ZM1 13.8L6.5 17.4L12 13.8L6.5 10.2L1 13.8ZM17.5 10.2L12 13.8L17.5 17.4L23 13.8L17.5 10.2ZM6.5 18.7L12 22.3L17.5 18.7L12 15.1L6.5 18.7Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="#0078D4" className={className}>
      <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14C0 17.31 2.69 20 6 20H19C21.76 20 24 17.76 24 15C24 12.36 21.95 10.22 19.35 10.04Z" />
    </svg>
  )
}

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [metadatas, setMetadatas] = useState<SyncMetadata[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingSyncs, setLoadingSyncs] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null)
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const [loggingInProvider, setLoggingInProvider] = useState<CloudProvider | null>(null)
  const [hasEnteredDashboard, setHasEnteredDashboard] = useState(false)

  const [deviceNameInput, setDeviceNameInput] = useState('')
  const [editingDevice, setEditingDevice] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createModalProvider, setCreateModalProvider] = useState<CloudProvider>('gdrive')
  const [editingIgnoreSync, setEditingIgnoreSync] = useState<SyncMetadata | null>(null)
  const [editingCoverSync, setEditingCoverSync] = useState<SyncMetadata | null>(null)

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [theme, setTheme] = useState<'liquid' | 'flat-red'>('liquid')
  const [closeBehavior, setCloseBehavior] = useState<'tray' | 'quit'>('tray')
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<UpdateProgressEvent | null>(null)

  const connectedServices: Record<CloudProvider, boolean> = config?.connectedServices || {
    gdrive: Boolean(config?.isConnected),
    dropbox: false,
    onedrive: false,
  }
  const activeProviders = ALL_PROVIDERS.filter((p) => connectedServices[p])
  const isAuthenticated = activeProviders.length > 0

  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-liquid', 'theme-flat-red')
    document.body.classList.add(theme === 'flat-red' ? 'theme-flat-red' : 'theme-liquid')
  }, [theme])

  // Si el usuario desconecta todos los servicios, volver a la pantalla de inicio de sesión
  useEffect(() => {
    if (!loadingInit && !isAuthenticated) {
      setHasEnteredDashboard(false)
    }
  }, [loadingInit, isAuthenticated])

  const showBanner = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text })
    if (type === 'success') {
      setTimeout(() => {
        setStatusMessage((prev) => (prev?.text === text ? null : prev))
      }, 6000)
    }
  }

  const refreshMetadatas = async () => {
    setLoadingSyncs(true)
    try {
      const list = await window.syncApi.listSyncMetadatas()
      setMetadatas(list)
    } catch (err: unknown) {
      showBanner(
        'error',
        err instanceof Error ? err.message : 'Error al leer las metadatas de tus servicios en la nube'
      )
    } finally {
      setLoadingSyncs(false)
    }
  }

  useEffect(() => {
    const unsubscribeProgress = window.syncApi.onProgress((ev) => {
      setProgress(ev)
    })
    const unsubscribeUpdate = window.syncApi.onUpdateProgress((ev) => {
      setUpdateProgress(ev)
    })

    window.syncApi
      .checkForUpdates()
      .then((res) => {
        if (res && res.hasUpdate) {
          setUpdateInfo(res)
        }
      })
      .catch(() => {})

    ;(async () => {
      try {
        const cfg = await window.syncApi.getConfig()
        setConfig(cfg)
        setDeviceNameInput(cfg.deviceName)
        if (cfg.viewMode) setViewMode(cfg.viewMode)
        if (cfg.theme === 'flat-red' || cfg.theme === 'liquid') setTheme(cfg.theme)
        if (cfg.closeBehavior === 'tray' || cfg.closeBehavior === 'quit') {
          setCloseBehavior(cfg.closeBehavior)
        }

        const anyConnected =
          cfg.isConnected ||
          Boolean(
            cfg.connectedServices &&
              Object.values(cfg.connectedServices).some(Boolean)
          )

        if (anyConnected) {
          setHasEnteredDashboard(true)
          await refreshMetadatas()
        } else {
          setHasEnteredDashboard(false)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoadingInit(false)
      }
    })()

    return () => {
      unsubscribeProgress()
      unsubscribeUpdate()
    }
  }, [])

  const handleChangeViewMode = async (mode: 'grid' | 'list') => {
    setViewMode(mode)
    const updated = await window.syncApi.setPreferences({ viewMode: mode })
    setConfig(updated)
  }

  const handleChangeTheme = async (nextTheme: 'liquid' | 'flat-red') => {
    setTheme(nextTheme)
    const updated = await window.syncApi.setPreferences({ theme: nextTheme })
    setConfig(updated)
  }

  const handleChangeCloseBehavior = async (nextBehavior: 'tray' | 'quit') => {
    setCloseBehavior(nextBehavior)
    const updated = await window.syncApi.setPreferences({ closeBehavior: nextBehavior })
    setConfig(updated)
  }

  const handleLoginWithProvider = async (provider: CloudProvider) => {
    setLoggingInProvider(provider)
    setStatusMessage(null)
    const label = PROVIDER_META[provider].label
    try {
      const updatedCfg = await window.syncApi.login(provider)
      setConfig(updatedCfg)
      setDeviceNameInput(updatedCfg.deviceName)
      showBanner('success', `¡Sesión iniciada en ${label} con éxito mediante rclone!`)
      await refreshMetadatas()
    } catch (err: unknown) {
      const freshCfg = await window.syncApi.getConfig()
      setConfig(freshCfg)
      const msg = err instanceof Error ? err.message : `No se completó el inicio de sesión en ${label}`
      if (!msg.toLowerCase().includes('cancelado')) {
        showBanner('error', msg)
      }
    } finally {
      setLoggingInProvider(null)
      setProgress(null)
    }
  }

  const handleCancelLogin = async () => {
    const cfg = await window.syncApi.cancelLogin()
    setConfig(cfg)
    setLoggingInProvider(null)
    setStatusMessage(null)
  }

  const handleLogoutProvider = async (provider: CloudProvider) => {
    const label = PROVIDER_META[provider].label
    const cfg = await window.syncApi.logout(provider)
    setConfig(cfg)
    await refreshMetadatas()
    showBanner('success', `Sesión de ${label} cerrada correctamente.`)
  }

  const handleEnterDashboard = async () => {
    if (!isAuthenticated) return
    setHasEnteredDashboard(true)
    await refreshMetadatas()
  }

  const handleOpenCreateModal = (defaultProv?: CloudProvider) => {
    const chosen =
      defaultProv && connectedServices[defaultProv]
        ? defaultProv
        : activeProviders[0] || 'gdrive'
    setCreateModalProvider(chosen)
    setIsCreateModalOpen(true)
  }

  const handleSaveDeviceName = async () => {
    if (!deviceNameInput.trim()) return
    const cfg = await window.syncApi.setDeviceName(deviceNameInput.trim())
    setConfig(cfg)
    setDeviceNameInput(cfg.deviceName)
    setEditingDevice(false)
    showBanner('success', `Nombre de este dispositivo actualizado a "${cfg.deviceName}".`)
  }

  const handleCreateSync = async (params: {
    provider: CloudProvider
    name: string
    driveFolderPath: string
    driveFolderName: string
    localPath: string
    ignoredPaths?: string[]
    coverImage?: string | null
  }) => {
    setBusyAction('create')
    const label = PROVIDER_META[params.provider]?.label || 'la nube'
    try {
      const { meta, config: updatedConfig } = await window.syncApi.createSync(params)
      setConfig(updatedConfig)
      await refreshMetadatas()
      showBanner(
        'success',
        `Sincronización "${meta.name}" creada en ${label}, archivos subidos a "/${meta.driveFolderPath}" y metadata guardada.`
      )
    } finally {
      setBusyAction(null)
      setProgress(null)
    }
  }

  const handleChangeCoverForSync = (sync: SyncMetadata) => {
    setEditingCoverSync(sync)
  }

  const handleApplyCoverForSync = async (sync: SyncMetadata, dataUrl: string) => {
    setBusyAction(`cover-${sync.id}`)
    try {
      const { meta, config: updatedCfg } = await window.syncApi.updateCoverImage(sync.id, dataUrl)
      setConfig(updatedCfg)
      setMetadatas((prev) => prev.map((m) => (m.id === meta.id ? meta : m)))
      showBanner(
        'success',
        `Carátula actualizada en la metadata de "${meta.name}". Ahora se verá en todos tus dispositivos.`
      )
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo actualizar la carátula')
    } finally {
      setBusyAction(null)
    }
  }

  const handleRemoveCoverForSync = async (sync: SyncMetadata) => {
    setBusyAction(`cover-${sync.id}`)
    try {
      const { meta, config: updatedCfg } = await window.syncApi.updateCoverImage(sync.id, null)
      setConfig(updatedCfg)
      setMetadatas((prev) => prev.map((m) => (m.id === meta.id ? meta : m)))
      showBanner('success', `Carátula eliminada de "${meta.name}".`)
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo quitar la carátula')
    } finally {
      setBusyAction(null)
    }
  }

  const handleSaveIgnoredForSync = async (sync: SyncMetadata, newIgnoredPaths: string[]) => {
    setBusyAction(`ignore-${sync.id}`)
    try {
      const { meta, config: updatedCfg } = await window.syncApi.updateIgnoredPaths(
        sync.id,
        newIgnoredPaths
      )
      setConfig(updatedCfg)
      setMetadatas((prev) => prev.map((m) => (m.id === meta.id ? meta : m)))
      showBanner(
        'success',
        `Lista de archivos ignorados actualizada para "${meta.name}" (${newIgnoredPaths.length} ruta(s) ignorada(s)).`
      )
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'Error al guardar archivos ignorados')
    } finally {
      setBusyAction(null)
    }
  }

  const handleAssignLocalFolderAndPull = async (sync: SyncMetadata, autoPull: boolean) => {
    const picked = await window.syncApi.pickLocalFolder()
    if (!picked) return

    setBusyAction(`assign-${sync.id}`)
    try {
      const updatedCfg = await window.syncApi.assignLocalFolder(sync.id, picked)
      setConfig(updatedCfg)
      if (autoPull) {
        const res = await window.syncApi.pullSync(sync.id)
        setConfig(res.config)
        await refreshMetadatas()
        showBanner(
          'success',
          `Directorio asignado y archivos descargados con rclone (Pull) en "${picked}".`
        )
      } else {
        showBanner('success', `Directorio local asignado a "${sync.name}": ${picked}`)
      }
    } catch (err: unknown) {
      showBanner(
        'error',
        err instanceof Error ? err.message : 'Error al vincular carpeta y descargar archivos'
      )
    } finally {
      setBusyAction(null)
      setProgress(null)
    }
  }

  const handleUnlinkLocal = async (sync: SyncMetadata) => {
    const updatedCfg = await window.syncApi.unlinkLocalFolder(sync.id)
    setConfig(updatedCfg)
    showBanner('success', `Se desvinculó la ruta local de "${sync.name}" en este dispositivo.`)
  }

  const handleDeleteSyncMetadata = async (sync: SyncMetadata) => {
    const providerLabel = PROVIDER_META[sync.provider || 'gdrive']?.label || 'la nube'
    const confirmDelete = window.confirm(
      `¿Eliminar la metadata de la sincronización "${sync.name}"?\n\nNota: Los archivos dentro de la carpeta "/${sync.driveFolderPath}" en tu ${providerLabel} NO se borrarán, únicamente se eliminará el registro en _SyncSeinen_Metadata.`
    )
    if (!confirmDelete) return

    setBusyAction(`delete-${sync.id}`)
    try {
      const updatedCfg = await window.syncApi.deleteSyncMetadata(sync.id)
      setConfig(updatedCfg)
      await refreshMetadatas()
      showBanner('success', `Metadata de sincronización "${sync.name}" eliminada.`)
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'No se pudo eliminar la metadata')
    } finally {
      setBusyAction(null)
    }
  }

  const handlePushOne = async (sync: SyncMetadata) => {
    setBusyAction(`push-${sync.id}`)
    setStatusMessage(null)
    try {
      const { meta, config: updatedCfg } = await window.syncApi.pushSync(sync.id)
      setConfig(updatedCfg)
      setMetadatas((prev) => prev.map((m) => (m.id === meta.id ? meta : m)))
      showBanner(
        'success',
        `Push completado en "${meta.name}" con rclone (${meta.lastPushedFileCount} archivos subidos por ${meta.lastPushedByDevice}).`
      )
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'Error durante el Push con rclone')
    } finally {
      setBusyAction(null)
      setProgress(null)
    }
  }

  const handlePullOne = async (sync: SyncMetadata) => {
    setBusyAction(`pull-${sync.id}`)
    setStatusMessage(null)
    try {
      const { meta, config: updatedCfg } = await window.syncApi.pullSync(sync.id)
      setConfig(updatedCfg)
      setMetadatas((prev) => prev.map((m) => (m.id === meta.id ? meta : m)))
      showBanner('success', `Pull completado en "${meta.name}" con rclone.`)
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'Error durante el Pull con rclone')
    } finally {
      setBusyAction(null)
      setProgress(null)
    }
  }

  const handlePushAll = async (provider?: CloudProvider) => {
    const actionKey = provider ? `push-all-${provider}` : 'push-all'
    const label = provider ? PROVIDER_META[provider].label : 'todos los servicios'
    setBusyAction(actionKey)
    setStatusMessage(null)
    try {
      const res = await window.syncApi.pushAll(provider)
      setConfig(res.config)
      setMetadatas(res.metas)
      showBanner(
        'success',
        `Push en ${label} finalizado: ${res.processedCount} sincronización(es) vinculadas subidas desde ${res.config.deviceName}.`
      )
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : `Error al ejecutar Push en ${label}`)
    } finally {
      setBusyAction(null)
      setProgress(null)
    }
  }

  const handlePullAll = async (provider?: CloudProvider) => {
    const actionKey = provider ? `pull-all-${provider}` : 'pull-all'
    const label = provider ? PROVIDER_META[provider].label : 'todos los servicios'
    setBusyAction(actionKey)
    setStatusMessage(null)
    try {
      const res = await window.syncApi.pullAll(provider)
      setConfig(res.config)
      setMetadatas(res.metas)
      showBanner(
        'success',
        `Pull en ${label} finalizado: ${res.processedCount} sincronización(es) vinculadas descargadas en esta PC.`
      )
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : `Error al ejecutar Pull en ${label}`)
    } finally {
      setBusyAction(null)
      setProgress(null)
    }
  }

  useEffect(() => {
    const unsubscribeTray = window.syncApi.onTrayAction((action) => {
      if (action === 'pushAll') {
        handlePushAll()
      } else if (action === 'pullAll') {
        handlePullAll()
      }
    })
    return () => {
      unsubscribeTray()
    }
  })

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return 'Sin registro aún'
    try {
      return new Date(iso).toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return iso
    }
  }

  /**
   * Vista en FILAS de los servicios en la nube (para el menú de Configuración)
   */
  const renderServicesRowsList = () => {
    return (
      <div className="flex flex-col gap-2.5">
        {ALL_PROVIDERS.map((provider) => {
          const info = PROVIDER_META[provider]
          const isConn = Boolean(connectedServices[provider])
          const isThisLoggingIn = loggingInProvider === provider
          const isOtherLoggingIn = loggingInProvider !== null && loggingInProvider !== provider

          return (
            <div
              key={provider}
              className={`rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 border transition ${
                isConn
                  ? theme === 'flat-red'
                    ? 'bg-[#18181c] border-red-500 shadow'
                    : 'liquid-glass-sub border-emerald-400/45 shadow'
                  : 'liquid-glass-sub border-white/10'
              }`}
            >
              {/* Izquierda: Icono + Nombre + Estado */}
              <div className="flex items-center gap-3.5 min-w-[220px]">
                <div className="w-10 h-10 rounded-xl liquid-glass flex items-center justify-center flex-shrink-0">
                  <ProviderIcon provider={provider} className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-extrabold liquid-text-primary">{info.label}</h4>
                    {isConn ? (
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Sesión iniciada
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/5 liquid-text-muted border border-white/10">
                        Sin vincular
                      </span>
                    )}
                  </div>
                  <p className="text-xs liquid-text-muted mt-0.5">{info.shortDesc}</p>
                </div>
              </div>

              {/* Derecha: Botón de Acción */}
              <div className="flex items-center gap-2 ml-auto">
                {isThisLoggingIn ? (
                  <div className="flex items-center gap-2">
                    <div className="py-2 px-3 rounded-xl liquid-glass text-sky-400 font-semibold text-xs flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      <span>Autoriza en el navegador...</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelLogin}
                      className="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancelar
                    </button>
                  </div>
                ) : isConn ? (
                  <div className="flex items-center gap-2">
                    <div className="py-2 px-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      Conectado
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(loggingInProvider) || Boolean(busyAction)}
                      onClick={() => handleLogoutProvider(provider)}
                      title={`Cerrar sesión de ${info.label}`}
                      className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Cerrar sesión
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isOtherLoggingIn || Boolean(busyAction)}
                    onClick={() => handleLoginWithProvider(provider)}
                    className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow ${
                      theme === 'flat-red'
                        ? 'bg-red-600 hover:bg-red-500 text-white disabled:opacity-40'
                        : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 hover:from-indigo-400 hover:via-sky-400 hover:to-emerald-400 text-white disabled:opacity-40'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Iniciar sesión
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  /**
   * Vista en Tarjetas para la pantalla de bienvenida inicial
   */
  const renderOnboardingServiceCards = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ALL_PROVIDERS.map((provider) => {
          const info = PROVIDER_META[provider]
          const isConn = Boolean(connectedServices[provider])
          const isThisLoggingIn = loggingInProvider === provider
          const isOtherLoggingIn = loggingInProvider !== null && loggingInProvider !== provider

          return (
            <div
              key={provider}
              className={`rounded-2xl p-4 flex flex-col justify-between gap-4 border transition ${
                isConn
                  ? theme === 'flat-red'
                    ? 'bg-[#18181c] border-red-500 shadow-lg'
                    : 'liquid-glass-sub border-emerald-400/50 shadow-lg shadow-emerald-500/10'
                  : 'liquid-glass-sub border-white/10'
              }`}
            >
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl liquid-glass flex items-center justify-center">
                      <ProviderIcon provider={provider} className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-extrabold liquid-text-primary">{info.label}</h4>
                  </div>

                  {isConn ? (
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Sesión iniciada
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/5 liquid-text-muted border border-white/10">
                      Sin vincular
                    </span>
                  )}
                </div>

                <p className="text-xs liquid-text-secondary leading-relaxed">{info.shortDesc}</p>
              </div>

              <div>
                {isThisLoggingIn ? (
                  <div className="space-y-2">
                    <div className="w-full py-2 px-3 rounded-xl liquid-glass text-sky-400 font-semibold text-xs flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      <span>Autoriza en el navegador...</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelLogin}
                      className="w-full py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancelar
                    </button>
                  </div>
                ) : isConn ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      Conectado
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(loggingInProvider) || Boolean(busyAction)}
                      onClick={() => handleLogoutProvider(provider)}
                      title={`Cerrar sesión de ${info.label}`}
                      className="p-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/30 text-rose-400 transition disabled:opacity-40"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isOtherLoggingIn || Boolean(busyAction)}
                    onClick={() => handleLoginWithProvider(provider)}
                    className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow ${
                      theme === 'flat-red'
                        ? 'bg-red-600 hover:bg-red-500 text-white disabled:opacity-40'
                        : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 hover:from-indigo-400 hover:via-sky-400 hover:to-emerald-400 text-white disabled:opacity-40'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4" />
                    Iniciar sesión en {info.label}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  if (loadingInit) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center liquid-text-primary gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <p className="text-sm font-medium">Iniciando SyncSeinen y verificando motor rclone...</p>
      </div>
    )
  }

  const showOnboardingLoginView = !hasEnteredDashboard || !isAuthenticated

  return (
    <div
      className={`min-h-screen flex flex-col relative overflow-x-hidden ${
        theme === 'flat-red' ? 'theme-flat-red' : 'theme-liquid'
      }`}
    >
      {/* Ambient Liquid Glass Light Orbs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute -top-28 -left-24 w-[480px] h-[480px] rounded-full blur-[110px] animate-orb-1"
          style={{ background: 'var(--orb-1)' }}
        />
        <div
          className="absolute top-1/3 -right-32 w-[520px] h-[520px] rounded-full blur-[125px] animate-orb-2"
          style={{ background: 'var(--orb-2)' }}
        />
        <div
          className="absolute -bottom-32 left-1/3 w-[440px] h-[440px] rounded-full blur-[115px] animate-orb-1"
          style={{ background: 'var(--orb-3)' }}
        />
      </div>

      {/* Top Navbar */}
      <header className="liquid-glass border-x-0 border-t-0 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <img
              src="./app-icon.png"
              alt="SyncSeinen"
              className="w-11 h-11 rounded-2xl object-cover shadow-lg border border-white/20"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-tight liquid-text-primary">
                  SyncSeinen
                </h1>
              </div>
              <p className="text-xs liquid-text-muted">
                Sincronización multi-nube (Google Drive, Dropbox y OneDrive) &bull; Motor Rclone
              </p>
            </div>
          </div>

          {/* Right Controls: Update Notification + Device Name + Connected Services + Gear Button */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {updateInfo?.hasUpdate && (
              <button
                type="button"
                onClick={() => setIsUpdateModalOpen(true)}
                className="px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-emerald-500/25 via-sky-500/25 to-indigo-500/25 hover:from-emerald-500/40 hover:to-indigo-500/40 border border-emerald-400/50 flex items-center gap-2 text-xs font-extrabold text-emerald-300 shadow-lg shadow-emerald-500/15 transition animate-pulse"
                title="Haz clic para ver qué cambia e instalar la nueva versión"
              >
                <Rocket className="w-4 h-4 text-emerald-400" />
                <span>¡Nueva versión v{updateInfo.latestVersion}!</span>
              </button>
            )}

            {/* Device Name */}
            <div className="flex items-center gap-2 liquid-glass-sub rounded-2xl px-3.5 py-1.5">
              <Laptop className="w-4 h-4 text-emerald-400" />
              <span className="text-xs liquid-text-muted">Dispositivo:</span>
              {editingDevice ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={deviceNameInput}
                    onChange={(e) => setDeviceNameInput(e.target.value)}
                    className="liquid-glass rounded-lg px-2 py-0.5 text-xs liquid-text-primary focus:outline-none w-36"
                  />
                  <button
                    onClick={handleSaveDeviceName}
                    className="text-xs px-2.5 py-0.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold"
                  >
                    OK
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingDevice(true)}
                  className="text-xs font-bold text-emerald-400 hover:underline"
                  title="Haz clic para cambiar el nombre de este dispositivo"
                >
                  {config?.deviceName}
                </button>
              )}
            </div>

            {activeProviders.length > 0 && (
              <button
                type="button"
                onClick={() => setIsSettingsMenuOpen(true)}
                className="flex items-center gap-2 liquid-glass-sub rounded-2xl px-3.5 py-1.5 hover:opacity-90 transition"
                title="Abrir menú para gestionar servicios conectados"
              >
                <Cloud className="w-4 h-4 text-sky-400" />
                <span className="text-xs liquid-text-primary font-semibold">
                  {activeProviders.length}{' '}
                  {activeProviders.length === 1 ? 'Servicio Activo' : 'Servicios Activos'}
                </span>
              </button>
            )}

            {/* Botón de engrane que abre el menú sobrepuesto estilo pausa de videojuego */}
            <button
              type="button"
              onClick={() => setIsSettingsMenuOpen(true)}
              title="Abrir Menú de Configuración"
              className="w-10 h-10 rounded-2xl liquid-glass-sub hover:bg-white/10 flex items-center justify-center liquid-text-primary transition"
            >
              <Settings
                className={`w-5 h-5 transition-transform duration-300 ${
                  isSettingsMenuOpen ? 'rotate-90 text-sky-400' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Menú Sobrepuesto de Configuración (Estilo Pausa de Videojuego) */}
      {isSettingsMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSettingsMenuOpen(false)
          }}
        >
          <div
            className={`w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] ${
              theme === 'flat-red'
                ? 'bg-[#121215] border-2 border-red-600 shadow-2xl'
                : 'liquid-glass-modal shadow-2xl border border-sky-400/35'
            }`}
          >
            {/* Header del Menú de Pausa */}
            <div className="px-7 py-5 border-b border-white/15 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-2xl ${
                    theme === 'flat-red'
                      ? 'bg-red-600/20 border border-red-500 text-red-400'
                      : 'bg-sky-500/20 border border-sky-400/40 text-sky-400'
                  }`}
                >
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] liquid-text-muted block">
                    MENÚ DEL SISTEMA
                  </span>
                  <h2 className="text-xl font-black tracking-tight liquid-text-primary">
                    Configuración y Servicios en la Nube
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsMenuOpen(false)}
                className="px-4 py-2 rounded-2xl liquid-glass-sub hover:bg-white/10 liquid-text-primary text-xs font-bold flex items-center gap-1.5 transition"
              >
                <X className="w-4 h-4" />
                Reanudar
              </button>
            </div>

            {/* Cuerpo del Menú Sobrepuesto */}
            <div className="p-7 space-y-6 overflow-y-auto">
              {/* Sección 1: Servicios en la Nube en vista de FILAS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider liquid-text-primary">
                      1. Servicios en la Nube Vinculados
                    </h3>
                    <p className="text-xs liquid-text-muted mt-0.5">
                      Inicia sesión o desconecta tus cuentas de Google Drive, Dropbox y OneDrive.
                    </p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full liquid-glass-sub liquid-text-secondary">
                    {activeProviders.length} de 3 activos
                  </span>
                </div>

                {renderServicesRowsList()}
              </div>

              <div
                className={`border-t ${
                  theme === 'flat-red' ? 'border-zinc-800' : 'border-white/10'
                }`}
              />

              {/* Sección 2 y 3: Comportamiento al cerrar y Selector de Temas con Muestra de Colores */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Opción: Al cerrar la aplicación */}
                <div className="space-y-2.5">
                  <span className="block text-xs font-extrabold uppercase tracking-wider liquid-text-primary">
                    2. Al cerrar la aplicación
                  </span>
                  <p className="text-xs liquid-text-muted">
                    Elige si SyncSeinen permanece activo en segundo plano o se cierra por completo.
                  </p>
                  <div className="space-y-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleChangeCloseBehavior('tray')}
                      className={`w-full px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between transition ${
                        closeBehavior === 'tray'
                          ? theme === 'flat-red'
                            ? 'bg-red-600 text-white border border-red-500'
                            : 'liquid-glass-sub text-sky-400 border border-sky-400/50'
                          : theme === 'flat-red'
                            ? 'bg-[#18181c] text-zinc-300 border border-zinc-800 hover:border-red-500/60 hover:text-white'
                            : 'liquid-glass-sub liquid-text-secondary hover:bg-white/10'
                      }`}
                    >
                      <span>Quedarse en segundo plano (Bandeja)</span>
                      {closeBehavior === 'tray' && <Check className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleChangeCloseBehavior('quit')}
                      className={`w-full px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between transition ${
                        closeBehavior === 'quit'
                          ? theme === 'flat-red'
                            ? 'bg-red-600 text-white border border-red-500'
                            : 'liquid-glass-sub text-sky-400 border border-sky-400/50'
                          : theme === 'flat-red'
                            ? 'bg-[#18181c] text-zinc-300 border border-zinc-800 hover:border-red-500/60 hover:text-white'
                            : 'liquid-glass-sub liquid-text-secondary hover:bg-white/10'
                      }`}
                    >
                      <span>Cerrarse por completo</span>
                      {closeBehavior === 'quit' && <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Opción: Selector de Temas como Botones con Muestra Visual de Colores */}
                <div className="space-y-2.5">
                  <span className="block text-xs font-extrabold uppercase tracking-wider liquid-text-primary">
                    3. Tema visual
                  </span>
                  <p className="text-xs liquid-text-muted">
                    Selecciona el estilo visual de la aplicación:
                  </p>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {/* Botón Tema 1: Cristal Líquido (degradado de azules y morados) */}
                    <button
                      type="button"
                      onClick={() => handleChangeTheme('liquid')}
                      className={`p-3 rounded-2xl flex flex-col items-center gap-2.5 border transition ${
                        theme === 'liquid'
                          ? 'liquid-glass-sub border-sky-400 text-sky-300 shadow-lg shadow-sky-500/15'
                          : theme === 'flat-red'
                            ? 'bg-[#18181c] border-zinc-800 text-zinc-300 hover:border-zinc-600'
                            : 'liquid-glass-sub border-white/10 liquid-text-secondary hover:bg-white/10'
                      }`}
                    >
                      <div
                        className="w-12 h-12 rounded-xl border border-white/25 shadow-md flex-shrink-0"
                        style={{
                          background:
                            'linear-gradient(135deg, #38bdf8 0%, #6366f1 52%, #a855f7 100%)',
                        }}
                      />
                      <div className="flex items-center gap-1.5 text-xs font-extrabold">
                        <span>Cristal Líquido</span>
                        {theme === 'liquid' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                      </div>
                    </button>

                    {/* Botón Tema 2: Negro y Rojo (cuadrado partido en dos triángulos rectángulos: negro y rojo) */}
                    <button
                      type="button"
                      onClick={() => handleChangeTheme('flat-red')}
                      className={`p-3 rounded-2xl flex flex-col items-center gap-2.5 border transition ${
                        theme === 'flat-red'
                          ? 'bg-[#18181c] border-red-500 text-white shadow-lg shadow-red-600/20'
                          : 'liquid-glass-sub border-white/10 liquid-text-secondary hover:bg-white/10'
                      }`}
                    >
                      <div
                        className="w-12 h-12 rounded-xl border border-white/25 shadow-md flex-shrink-0"
                        style={{
                          background:
                            'linear-gradient(135deg, #09090b 0%, #09090b 49.5%, #dc2626 50.5%, #dc2626 100%)',
                        }}
                      />
                      <div className="flex items-center gap-1.5 text-xs font-extrabold">
                        <span>Negro y Rojo</span>
                        {theme === 'flat-red' && <Check className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer del Menú de Pausa */}
            <div className="px-7 py-4 border-t border-white/15 flex items-center justify-between">
              <span className="text-xs liquid-text-muted font-mono">
                {config?.rcloneVersion || 'Motor Rclone activo'}
              </span>
              <button
                type="button"
                onClick={() => setIsSettingsMenuOpen(false)}
                className={`px-6 py-2.5 rounded-2xl text-xs font-extrabold transition shadow-lg ${
                  theme === 'flat-red'
                    ? 'bg-red-600 hover:bg-red-500 text-white'
                    : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 hover:from-indigo-400 hover:to-emerald-400 text-white'
                }`}
              >
                Volver a SyncSeinen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Progress Bar Banner (cuando el cuadro modal de creación no está abierto) */}
      {(progress || busyAction === 'create') && !isCreateModalOpen && (
        <div className="liquid-glass border-x-0 border-t-0 px-6 py-3 z-20">
          <div className="max-w-6xl mx-auto flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400 flex-shrink-0" />
                <span className="font-bold liquid-text-primary flex-shrink-0">
                  {progress
                    ? `[${progress.operation.toUpperCase()}] ${progress.syncName}:`
                    : '[PUSH] Sincronizando:'}
                </span>
                <span className="liquid-text-secondary flex-shrink-0">
                  {progress ? progress.phase : 'Subiendo archivos a la nube con rclone...'}
                </span>
                {progress?.detail && (
                  <span className="liquid-text-muted font-mono truncate">({progress.detail})</span>
                )}
              </div>
              <span className="text-sky-400 font-mono font-bold flex-shrink-0 ml-2">
                {progress ? `${progress.current}%` : '0%'}
              </span>
            </div>
            <div className="w-full h-2 bg-black/25 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-200"
                style={{
                  width: `${progress ? Math.min(100, Math.max(5, progress.current)) : 10}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Status Notification */}
      {statusMessage && (
        <div className="max-w-6xl w-full mx-auto px-6 pt-4 relative z-10">
          <div
            className={`p-3.5 rounded-2xl liquid-glass flex items-center justify-between gap-3 text-sm ${
              statusMessage.type === 'success' ? 'border-emerald-400/50' : 'border-rose-400/50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className={`w-4 h-4 flex-shrink-0 ${
                  statusMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              />
              <span className="liquid-text-primary font-medium">{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs liquid-text-muted hover:liquid-text-primary underline"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6 relative z-10">
        {showOnboardingLoginView ? (
          /* Vista de Inicio de Sesión Multi-Servicio */
          <div className="max-w-4xl mx-auto mt-6 liquid-glass rounded-3xl p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-sky-400/20 to-indigo-500/20 border border-sky-400/40 text-sky-400 flex items-center justify-center mx-auto shadow-lg shadow-sky-500/15">
              <Cloud className="w-8 h-8" />
            </div>

            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-extrabold liquid-text-primary">
                Conecta tus servicios en la nube
              </h2>
              <p className="text-sm liquid-text-secondary mt-2 leading-relaxed">
                Inicia sesión con <strong>Google Drive</strong>, <strong>Dropbox</strong> o{' '}
                <strong>OneDrive</strong>. Cada servicio en el que inicies sesión se marcará como{' '}
                <span className="text-emerald-400 font-semibold">Sesión iniciada</span> para que puedas
                vincular varios a la vez antes de pasar a la vista de sincronizaciones.
              </p>
            </div>

            {renderOnboardingServiceCards()}

            {/* Botón para ir a la vista de sincronizaciones (habilitado al tener al menos 1 servicio vinculado) */}
            <div className="pt-4 border-t border-white/10 flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={!isAuthenticated || Boolean(loggingInProvider)}
                onClick={handleEnterDashboard}
                className={`px-8 py-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2.5 transition shadow-xl ${
                  isAuthenticated
                    ? theme === 'flat-red'
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/25 cursor-pointer'
                      : 'bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 hover:from-emerald-400 hover:via-sky-400 hover:to-indigo-400 text-white shadow-sky-500/25 cursor-pointer'
                    : 'liquid-glass-sub liquid-text-muted opacity-50 cursor-not-allowed'
                }`}
              >
                <span>Ir a la vista de sincronizaciones</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <span className="text-xs liquid-text-muted">
                {isAuthenticated
                  ? `Tienes ${activeProviders.length} servicio(s) vinculado(s). También podrás agregar más después desde el engrane de configuración.`
                  : 'Vincula al menos un servicio arriba para habilitar el acceso a tus sincronizaciones.'}
              </span>
            </div>
          </div>
        ) : (
          /* Vista de Sincronizaciones Dividida por Servicios */
          <div className="space-y-8">
            {/* Barra Superior General */}
            <div className="liquid-glass rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold liquid-text-primary flex items-center gap-2.5">
                  Panel de Sincronizaciones por Servicio
                  <span className="text-xs px-3 py-0.5 rounded-full liquid-glass-sub liquid-text-secondary font-semibold">
                    {activeProviders.length} servicio(s) activo(s) &bull; {metadatas.length} sync(s) en total
                  </span>
                </h2>
                <p className="text-xs liquid-text-muted mt-1">
                  Cada servicio tiene sus propios botones de <strong>Pull</strong> y{' '}
                  <strong>Push</strong>. Puedes agregar más cuentas desde el botón de engrane.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* View Mode Toggle: Cuadrícula (Grid) vs Fila (List) */}
                <div className="flex items-center liquid-glass-sub rounded-2xl p-1">
                  <button
                    type="button"
                    onClick={() => handleChangeViewMode('grid')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                      viewMode === 'grid'
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md'
                        : 'liquid-text-muted hover:liquid-text-primary'
                    }`}
                    title="Vista en cuadrícula de cartas"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Cartas
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeViewMode('list')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                      viewMode === 'list'
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md'
                        : 'liquid-text-muted hover:liquid-text-primary'
                    }`}
                    title="Vista en filas"
                  >
                    <List className="w-3.5 h-3.5" />
                    Filas
                  </button>
                </div>

                <button
                  onClick={refreshMetadatas}
                  disabled={loadingSyncs || Boolean(busyAction)}
                  className="px-3.5 py-2.5 rounded-2xl liquid-glass-sub hover:opacity-90 disabled:opacity-50 liquid-text-primary text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Volver a leer metadatas de todos los servicios conectados"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingSyncs ? 'animate-spin text-sky-400' : ''}`} />
                  Actualizar todo
                </button>

                <button
                  onClick={() => handleOpenCreateModal()}
                  disabled={Boolean(busyAction)}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 hover:from-indigo-400 hover:via-sky-400 hover:to-emerald-400 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-500/25 transition"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Sincronización
                </button>
              </div>
            </div>

            {/* Secciones Divididas por Cada Servicio Conectado */}
            {activeProviders.map((provider) => {
              const pInfo = PROVIDER_META[provider]
              const serviceMetas = metadatas.filter((m) => (m.provider || 'gdrive') === provider)
              const serviceLinkedCount = serviceMetas.filter((m) =>
                Boolean(config?.localMappings[m.id]?.localPath)
              ).length

              return (
                <section key={provider} className="space-y-4">
                  {/* Encabezado limpio en línea: (icono) Nombre -------- Pull  Push */}
                  <div className="flex items-center gap-3.5 px-1">
                    <div className="flex items-center gap-2.5 flex-shrink-0">
                      <div className="w-8 h-8 rounded-xl liquid-glass-sub flex items-center justify-center">
                        <ProviderIcon provider={provider} className="w-4 h-4" />
                      </div>
                      <h3 className="text-base font-extrabold liquid-text-primary tracking-tight">
                        {pInfo.label}
                      </h3>
                    </div>

                    {/* Línea divisoria horizontal */}
                    <div
                      className={`flex-1 h-px ${
                        theme === 'flat-red' ? 'bg-zinc-800' : 'bg-white/15'
                      }`}
                    />

                    {/* Botones de Pull y Push para toda la sección del servicio */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handlePullAll(provider)}
                        disabled={serviceLinkedCount === 0 || Boolean(busyAction)}
                        className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500 border border-sky-400/40 text-sky-400 hover:text-white disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 transition"
                        title={`Hacer Pull a todas las sincronizaciones vinculadas en ${pInfo.label}`}
                      >
                        {busyAction === `pull-all-${provider}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                        )}
                        Pull
                      </button>

                      <button
                        onClick={() => handlePushAll(provider)}
                        disabled={serviceLinkedCount === 0 || Boolean(busyAction)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-400/40 text-emerald-400 hover:text-white disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 transition"
                        title={`Hacer Push a todas las sincronizaciones vinculadas en ${pInfo.label}`}
                      >
                        {busyAction === `push-all-${provider}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowUpFromLine className="w-3.5 h-3.5" />
                        )}
                        Push
                      </button>
                    </div>
                  </div>

                  {/* Lista o Cuadrícula de Sincronizaciones de este Servicio */}
                  {loadingSyncs && serviceMetas.length === 0 ? (
                    <div className="liquid-glass rounded-3xl p-8 flex flex-col items-center justify-center liquid-text-muted gap-3">
                      <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                      <p className="text-xs font-medium">
                        Consultando sincronizaciones en {pInfo.label}...
                      </p>
                    </div>
                  ) : serviceMetas.length === 0 ? (
                    <div className="liquid-glass rounded-3xl p-6 text-center">
                      <p className="text-xs liquid-text-muted">
                        No hay sincronizaciones registradas en <strong>{pInfo.label}</strong>. Usa el botón superior <strong>+ Nueva Sincronización</strong> para agregar una.
                      </p>
                    </div>
                  ) : viewMode === 'grid' ? (
                    /* VISTA EN CUADRÍCULA DE CARTAS (GRID VIEW) */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {serviceMetas.map((sync) => {
                        const localMapping = config?.localMappings[sync.id]
                        const isLinked = Boolean(localMapping?.localPath)
                        const effectiveIgnored = Array.from(
                          new Set([
                            ...(sync.ignoredPaths || []),
                            ...(localMapping?.ignoredPaths || []),
                          ])
                        )
                        const isThisBusy =
                          busyAction === `push-${sync.id}` ||
                          busyAction === `pull-${sync.id}` ||
                          busyAction === `assign-${sync.id}` ||
                          busyAction === `delete-${sync.id}` ||
                          busyAction === `ignore-${sync.id}` ||
                          busyAction === `cover-${sync.id}`

                        return (
                          <div
                            key={sync.id}
                            className="liquid-glass-card rounded-3xl overflow-hidden flex flex-col justify-between group"
                          >
                            <div>
                              {/* Cover Image Header */}
                              <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-indigo-500/25 via-sky-500/20 to-emerald-500/25 border-b border-white/15">
                                {sync.coverImage ? (
                                  <img
                                    src={sync.coverImage}
                                    alt={sync.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-sky-400/70">
                                    <FolderSync className="w-10 h-10 stroke-[1.5]" />
                                    <span className="text-xs font-medium liquid-text-muted">
                                      Sin carátula
                                    </span>
                                  </div>
                                )}

                                {/* Top Floating Badges on Cover */}
                                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                                  {isLinked ? (
                                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-emerald-300 border border-emerald-400/40 flex items-center gap-1 shadow">
                                      <Link2 className="w-3 h-3" />
                                      Vinculada
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-amber-300 border border-amber-400/40 shadow">
                                      Sin vincular en PC
                                    </span>
                                  )}

                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                    <button
                                      type="button"
                                      disabled={Boolean(busyAction)}
                                      onClick={() => handleChangeCoverForSync(sync)}
                                      className="px-2.5 py-1 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1 border border-white/20 transition"
                                      title="Cambiar imagen de carátula"
                                    >
                                      <ImagePlus className="w-3 h-3 text-sky-300" />
                                      {sync.coverImage ? 'Cambiar' : 'Carátula'}
                                    </button>
                                    {sync.coverImage && (
                                      <button
                                        type="button"
                                        disabled={Boolean(busyAction)}
                                        onClick={() => handleRemoveCoverForSync(sync)}
                                        className="p-1 rounded-full bg-black/65 hover:bg-rose-600/80 backdrop-blur-md text-white border border-white/20 transition"
                                        title="Quitar carátula"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Bottom Title Overlay on Cover */}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-8">
                                  <h3 className="text-base font-extrabold text-white truncate drop-shadow">
                                    {sync.name}
                                  </h3>
                                  <p className="text-[11px] text-sky-300 font-mono truncate flex items-center gap-1">
                                    <Cloud className="w-3 h-3 flex-shrink-0" />/{sync.driveFolderPath}
                                  </p>
                                </div>
                              </div>

                              {/* Card Body */}
                              <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div className="liquid-glass-sub rounded-2xl p-2.5">
                                    <span className="liquid-text-muted block text-[10px]">
                                      Último Push
                                    </span>
                                    <span className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5 truncate">
                                      <Laptop className="w-3 h-3 flex-shrink-0" />
                                      {sync.lastPushedByDevice || sync.createdByDevice || 'N/A'}
                                    </span>
                                  </div>

                                  <div className="liquid-glass-sub rounded-2xl p-2.5">
                                    <span className="liquid-text-muted block text-[10px]">
                                      Archivos / Fecha
                                    </span>
                                    <span className="liquid-text-primary font-semibold block mt-0.5 truncate">
                                      {sync.lastPushedFileCount} arch. &bull;{' '}
                                      {formatDate(sync.lastPushedAt)}
                                    </span>
                                  </div>
                                </div>

                                {isLinked ? (
                                  <div className="liquid-glass-sub rounded-2xl p-2.5 space-y-2">
                                    <div className="flex items-center gap-1.5 text-xs min-w-0">
                                      <HardDrive className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                      <code className="liquid-text-secondary truncate font-mono text-[11px]">
                                        {localMapping?.localPath}
                                      </code>
                                    </div>
                                    <div className="flex items-center justify-between gap-1 pt-1 border-t border-white/10">
                                      <button
                                        onClick={() => setEditingIgnoreSync(sync)}
                                        disabled={Boolean(busyAction)}
                                        className="px-2 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-[11px] font-semibold flex items-center gap-1 transition"
                                      >
                                        <EyeOff className="w-3 h-3" />
                                        Ignorar ({effectiveIgnored.length})
                                      </button>
                                      <div className="flex items-center gap-1">
                                        <button
                                          onClick={() =>
                                            window.syncApi.openLocalPath(localMapping!.localPath)
                                          }
                                          className="px-2 py-1 rounded-lg liquid-glass liquid-text-secondary text-[11px] hover:opacity-90"
                                          title="Abrir carpeta"
                                        >
                                          Abrir
                                        </button>
                                        <button
                                          onClick={() => handleAssignLocalFolderAndPull(sync, false)}
                                          disabled={Boolean(busyAction)}
                                          className="px-2 py-1 rounded-lg liquid-glass liquid-text-secondary text-[11px] hover:opacity-90"
                                        >
                                          Ruta
                                        </button>
                                        <button
                                          onClick={() => handleUnlinkLocal(sync)}
                                          disabled={Boolean(busyAction)}
                                          className="p-1 rounded-lg liquid-glass text-rose-400 hover:opacity-90"
                                          title="Desvincular de esta PC"
                                        >
                                          <Link2Off className="w-3 h-3" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="liquid-glass-sub rounded-2xl p-3 space-y-2 border-amber-400/30">
                                    <p className="text-[11px] liquid-text-secondary">
                                      Asígnale una carpeta local en esta PC para sincronizar:
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => handleAssignLocalFolderAndPull(sync, true)}
                                        disabled={Boolean(busyAction)}
                                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition"
                                      >
                                        <ArrowDownToLine className="w-3.5 h-3.5" />
                                        Vincular y Pull
                                      </button>
                                      <button
                                        onClick={() => setEditingIgnoreSync(sync)}
                                        disabled={Boolean(busyAction)}
                                        className="p-1.5 rounded-xl liquid-glass text-amber-400"
                                        title="Ignorar archivos"
                                      >
                                        <EyeOff className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Card Footer Controls */}
                            <div className="px-4 pb-4 pt-1 flex items-center gap-2">
                              {isLinked && (
                                <>
                                  <button
                                    onClick={() => handlePullOne(sync)}
                                    disabled={Boolean(busyAction)}
                                    className="flex-1 py-2.5 rounded-2xl bg-sky-500/20 hover:bg-sky-500 border border-sky-400/40 text-sky-400 hover:text-white disabled:opacity-40 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                                  >
                                    {busyAction === `pull-${sync.id}` ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <ArrowDownToLine className="w-4 h-4" />
                                    )}
                                    Pull
                                  </button>

                                  <button
                                    onClick={() => handlePushOne(sync)}
                                    disabled={Boolean(busyAction)}
                                    className="flex-1 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-400/40 text-emerald-400 hover:text-white disabled:opacity-40 text-xs font-bold flex items-center justify-center gap-1.5 transition"
                                  >
                                    {busyAction === `push-${sync.id}` ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <ArrowUpFromLine className="w-4 h-4" />
                                    )}
                                    Push
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => handleDeleteSyncMetadata(sync)}
                                disabled={Boolean(busyAction) || isThisBusy}
                                className="p-2.5 rounded-2xl liquid-glass-sub hover:bg-rose-500/20 liquid-text-muted hover:text-rose-400 transition ml-auto"
                                title="Eliminar metadata de sincronización"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* VISTA EN FILA / LISTA (ROW VIEW) */
                    <div className="grid grid-cols-1 gap-4">
                      {serviceMetas.map((sync) => {
                        const localMapping = config?.localMappings[sync.id]
                        const isLinked = Boolean(localMapping?.localPath)
                        const effectiveIgnored = Array.from(
                          new Set([
                            ...(sync.ignoredPaths || []),
                            ...(localMapping?.ignoredPaths || []),
                          ])
                        )
                        const isThisBusy =
                          busyAction === `push-${sync.id}` ||
                          busyAction === `pull-${sync.id}` ||
                          busyAction === `assign-${sync.id}` ||
                          busyAction === `delete-${sync.id}` ||
                          busyAction === `ignore-${sync.id}` ||
                          busyAction === `cover-${sync.id}`

                        return (
                          <div key={sync.id} className="liquid-glass-card rounded-3xl p-5">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              {/* Cover Thumbnail on the left of the row */}
                              <div
                                onClick={() => !busyAction && handleChangeCoverForSync(sync)}
                                className="relative w-28 h-28 rounded-2xl overflow-hidden liquid-glass-sub flex-shrink-0 cursor-pointer group border border-white/15"
                                title="Haz clic para agregar o cambiar la carátula"
                              >
                                {sync.coverImage ? (
                                  <img
                                    src={sync.coverImage}
                                    alt={sync.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-sky-400/75 gap-1">
                                    <ImagePlus className="w-6 h-6" />
                                    <span className="text-[10px] font-medium liquid-text-muted">
                                      Carátula
                                    </span>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                  <span className="text-[10px] font-bold text-white px-2 py-1 rounded-lg bg-black/60">
                                    Cambiar
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2 flex-1 min-w-[260px]">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <h3 className="text-base font-extrabold liquid-text-primary">
                                    {sync.name}
                                  </h3>
                                  {isLinked ? (
                                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-400/30 flex items-center gap-1">
                                      <Link2 className="w-3 h-3" />
                                      Vinculada en este dispositivo
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-400/30">
                                      Disponible en {pInfo.label} &bull; Sin ruta local asignada
                                    </span>
                                  )}
                                  {effectiveIgnored.length > 0 && (
                                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-400/30 flex items-center gap-1">
                                      <EyeOff className="w-3 h-3" />
                                      {effectiveIgnored.length} ignorado(s)
                                    </span>
                                  )}
                                </div>

                                {/* Metadata info badges */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                                  <div className="liquid-glass-sub rounded-2xl p-2.5">
                                    <span className="liquid-text-muted block text-[11px]">
                                      Carpeta en {pInfo.label}
                                    </span>
                                    <span
                                      className="text-sky-400 font-semibold font-mono flex items-center gap-1.5 mt-0.5 truncate"
                                      title={`/${sync.driveFolderPath}`}
                                    >
                                      <Cloud className="w-3.5 h-3.5 flex-shrink-0" />/
                                      {sync.driveFolderPath}
                                    </span>
                                  </div>

                                  <div className="liquid-glass-sub rounded-2xl p-2.5">
                                    <span className="liquid-text-muted block text-[11px]">
                                      Último dispositivo que subió (Push)
                                    </span>
                                    <span className="text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5 truncate">
                                      <Laptop className="w-3.5 h-3.5 flex-shrink-0" />
                                      {sync.lastPushedByDevice || sync.createdByDevice || 'N/A'}
                                    </span>
                                  </div>

                                  <div className="liquid-glass-sub rounded-2xl p-2.5">
                                    <span className="liquid-text-muted block text-[11px]">
                                      Última subida / Archivos
                                    </span>
                                    <span className="liquid-text-primary font-semibold block mt-0.5 truncate">
                                      {formatDate(sync.lastPushedAt)} ({sync.lastPushedFileCount}{' '}
                                      arch.)
                                    </span>
                                  </div>
                                </div>

                                {/* Local folder section */}
                                {isLinked ? (
                                  <div className="mt-3 p-3 rounded-2xl liquid-glass-sub flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
                                      <HardDrive className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                      <span className="liquid-text-muted flex-shrink-0">
                                        Ruta en esta PC:
                                      </span>
                                      <code className="liquid-text-primary truncate font-mono">
                                        {localMapping?.localPath}
                                      </code>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <button
                                        onClick={() => setEditingIgnoreSync(sync)}
                                        disabled={Boolean(busyAction)}
                                        className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/30 text-amber-400 text-xs font-semibold flex items-center gap-1 transition"
                                      >
                                        <EyeOff className="w-3.5 h-3.5" />
                                        Ignorar archivos ({effectiveIgnored.length})
                                      </button>
                                      <button
                                        onClick={() =>
                                          window.syncApi.openLocalPath(localMapping!.localPath)
                                        }
                                        className="px-2.5 py-1 rounded-xl liquid-glass liquid-text-secondary text-xs flex items-center gap-1 transition hover:opacity-90"
                                      >
                                        <FolderOpen className="w-3.5 h-3.5" />
                                        Abrir
                                      </button>
                                      <button
                                        onClick={() => handleAssignLocalFolderAndPull(sync, false)}
                                        disabled={Boolean(busyAction)}
                                        className="px-2.5 py-1 rounded-xl liquid-glass liquid-text-secondary text-xs transition hover:opacity-90"
                                      >
                                        Cambiar ruta
                                      </button>
                                      <button
                                        onClick={() => handleUnlinkLocal(sync)}
                                        disabled={Boolean(busyAction)}
                                        className="p-1 rounded-xl liquid-glass text-rose-400 transition hover:opacity-90"
                                        title="Desvincular carpeta en este dispositivo"
                                      >
                                        <Link2Off className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="mt-3 p-3 rounded-2xl liquid-glass-sub border-amber-400/30 flex flex-wrap items-center justify-between gap-3">
                                    <p className="text-xs liquid-text-secondary">
                                      Sincronización detectada en {pInfo.label}. Asígnale un
                                      directorio en esta computadora para descargar los archivos.
                                    </p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <button
                                        onClick={() => setEditingIgnoreSync(sync)}
                                        disabled={Boolean(busyAction)}
                                        className="px-3 py-2 rounded-xl liquid-glass text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition"
                                      >
                                        <EyeOff className="w-3.5 h-3.5" />
                                        Ignorar ({effectiveIgnored.length})
                                      </button>
                                      <button
                                        onClick={() => handleAssignLocalFolderAndPull(sync, true)}
                                        disabled={Boolean(busyAction)}
                                        className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md"
                                      >
                                        <ArrowDownToLine className="w-4 h-4" />
                                        Asignar Directorio y Hacer Pull
                                      </button>
                                      <button
                                        onClick={() => handleAssignLocalFolderAndPull(sync, false)}
                                        disabled={Boolean(busyAction)}
                                        className="px-3 py-2 rounded-xl liquid-glass liquid-text-primary text-xs font-semibold transition"
                                      >
                                        Solo asignar ruta
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Individual Pull / Push & Delete Controls */}
                              <div className="flex items-center gap-2 self-center">
                                {isLinked && (
                                  <>
                                    <button
                                      onClick={() => handlePullOne(sync)}
                                      disabled={Boolean(busyAction)}
                                      className="px-4 py-2.5 rounded-2xl bg-sky-500/20 hover:bg-sky-500 border border-sky-400/40 text-sky-400 hover:text-white disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 shadow-md transition"
                                    >
                                      {busyAction === `pull-${sync.id}` ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <ArrowDownToLine className="w-4 h-4" />
                                      )}
                                      Pull
                                    </button>

                                    <button
                                      onClick={() => handlePushOne(sync)}
                                      disabled={Boolean(busyAction)}
                                      className="px-4 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-400/40 text-emerald-400 hover:text-white disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 shadow-md transition"
                                    >
                                      {busyAction === `push-${sync.id}` ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : (
                                        <ArrowUpFromLine className="w-4 h-4" />
                                      )}
                                      Push
                                    </button>
                                  </>
                                )}

                                <button
                                  onClick={() => handleDeleteSyncMetadata(sync)}
                                  disabled={Boolean(busyAction) || isThisBusy}
                                  className="p-2.5 rounded-2xl liquid-glass-sub hover:bg-rose-500/20 liquid-text-muted hover:text-rose-400 transition"
                                  title="Eliminar metadata de sincronización"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </section>
              )
            })}
          </div>
        )}
      </main>

      <CreateSyncModal
        isOpen={isCreateModalOpen}
        initialProvider={createModalProvider}
        connectedServices={connectedServices}
        onClose={() => setIsCreateModalOpen(false)}
        progress={progress}
        isCreating={busyAction === 'create'}
        onCreated={handleCreateSync}
      />

      {editingIgnoreSync && (
        <IgnoreFilesModal
          isOpen={Boolean(editingIgnoreSync)}
          title={editingIgnoreSync.name}
          provider={editingIgnoreSync.provider || 'gdrive'}
          localPath={config?.localMappings[editingIgnoreSync.id]?.localPath}
          driveFolderPath={editingIgnoreSync.driveFolderPath}
          initialIgnoredPaths={Array.from(
            new Set([
              ...(editingIgnoreSync.ignoredPaths || []),
              ...(config?.localMappings[editingIgnoreSync.id]?.ignoredPaths || []),
            ])
          )}
          onClose={() => setEditingIgnoreSync(null)}
          onSave={async (newPaths) => {
            await handleSaveIgnoredForSync(editingIgnoreSync, newPaths)
          }}
        />
      )}

      {updateInfo && (
        <UpdateModal
          isOpen={isUpdateModalOpen}
          updateInfo={updateInfo}
          updateProgress={updateProgress}
          onClose={() => setIsUpdateModalOpen(false)}
        />
      )}

      {editingCoverSync && (
        <CoverPickerModal
          isOpen={Boolean(editingCoverSync)}
          onClose={() => setEditingCoverSync(null)}
          onSelectCover={async (dataUrl) => {
            await handleApplyCoverForSync(editingCoverSync, dataUrl)
          }}
        />
      )}
    </div>
  )
}

export default App
