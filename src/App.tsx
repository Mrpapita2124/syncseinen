import React, { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
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
  Terminal,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import {
  AppConfig,
  SyncMetadata,
  SyncProgressEvent,
  UpdateCheckResult,
  UpdateProgressEvent,
} from './types'
import { CreateSyncModal } from './components/CreateSyncModal'
import { IgnoreFilesModal } from './components/IgnoreFilesModal'
import { UpdateModal } from './components/UpdateModal'
import { CoverPickerModal } from './components/CoverPickerModal'

export const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [metadatas, setMetadatas] = useState<SyncMetadata[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [loadingSyncs, setLoadingSyncs] = useState(false)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [progress, setProgress] = useState<SyncProgressEvent | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [loggingIn, setLoggingIn] = useState(false)
  const [deviceNameInput, setDeviceNameInput] = useState('')
  const [editingDevice, setEditingDevice] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingIgnoreSync, setEditingIgnoreSync] = useState<SyncMetadata | null>(null)
  const [editingCoverSync, setEditingCoverSync] = useState<SyncMetadata | null>(null)

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [theme, setTheme] = useState<'liquid' | 'flat-red'>('liquid')
  const [closeBehavior, setCloseBehavior] = useState<'tray' | 'quit'>('tray')
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false)
  const settingsMenuRef = useRef<HTMLDivElement | null>(null)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<UpdateProgressEvent | null>(null)

  const isAuthenticated = Boolean(config?.isConnected)

  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-liquid', 'theme-flat-red')
    document.body.classList.add(theme === 'flat-red' ? 'theme-flat-red' : 'theme-liquid')
  }, [theme])

  useEffect(() => {
    const handleClickOutside = (ev: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(ev.target as Node)) {
        setIsSettingsMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      showBanner('error', err instanceof Error ? err.message : 'Error al leer las metadatas de Google Drive')
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

    // Background update check on startup without blocking the UI
    window.syncApi
      .checkForUpdates()
      .then((res) => {
        if (res && res.hasUpdate) {
          setUpdateInfo(res)
        }
      })
      .catch(() => {
        // Ignore network errors silently so the user is not interrupted
      })

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

        if (cfg.isConnected) {
          await refreshMetadatas()
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

  const handleLoginWithRclone = async () => {
    setLoggingIn(true)
    setStatusMessage(null)
    try {
      const updatedCfg = await window.syncApi.login()
      setConfig(updatedCfg)
      setDeviceNameInput(updatedCfg.deviceName)
      showBanner('success', '¡Cuenta de Google Drive vinculada con éxito mediante rclone!')
      await refreshMetadatas()
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'No se completó el inicio de sesión con rclone')
    } finally {
      setLoggingIn(false)
      setProgress(null)
    }
  }

  const handleCancelLogin = async () => {
    const cfg = await window.syncApi.cancelLogin()
    setConfig(cfg)
    setLoggingIn(false)
  }

  const handleLogout = async () => {
    const cfg = await window.syncApi.logout()
    setConfig(cfg)
    setMetadatas([])
    showBanner('success', 'Sesión de Google Drive desconectada de rclone.')
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
    name: string
    driveFolderPath: string
    driveFolderName: string
    localPath: string
    ignoredPaths?: string[]
    coverImage?: string | null
  }) => {
    setBusyAction('create')
    try {
      const { meta, config: updatedConfig } = await window.syncApi.createSync(params)
      setConfig(updatedConfig)
      await refreshMetadatas()
      showBanner(
        'success',
        `Sincronización "${meta.name}" creada, archivos subidos con rclone a "/${meta.driveFolderPath}" y metadata guardada en _SyncSeinen_Metadata.`
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
        showBanner('success', `Directorio asignado y archivos descargados con rclone (Pull) en "${picked}".`)
      } else {
        showBanner('success', `Directorio local asignado a "${sync.name}": ${picked}`)
      }
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'Error al vincular carpeta y descargar archivos')
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
    const confirmDelete = window.confirm(
      `¿Eliminar la metadata de la sincronización "${sync.name}"?\n\nNota: Los archivos dentro de la carpeta "/${sync.driveFolderPath}" en tu Google Drive NO se borrarán, únicamente se eliminará el registro en _SyncSeinen_Metadata.`
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

  const handlePushAll = async () => {
    setBusyAction('push-all')
    setStatusMessage(null)
    try {
      const res = await window.syncApi.pushAll()
      setConfig(res.config)
      setMetadatas(res.metas)
      showBanner(
        'success',
        `Push a todos finalizado: ${res.processedCount} sincronización(es) vinculadas subidas desde ${res.config.deviceName}.`
      )
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'Error al ejecutar Push a todos')
    } finally {
      setBusyAction(null)
      setProgress(null)
    }
  }

  const handlePullAll = async () => {
    setBusyAction('pull-all')
    setStatusMessage(null)
    try {
      const res = await window.syncApi.pullAll()
      setConfig(res.config)
      setMetadatas(res.metas)
      showBanner(
        'success',
        `Pull a todos finalizado: ${res.processedCount} sincronización(es) vinculadas descargadas en esta PC.`
      )
    } catch (err: unknown) {
      showBanner('error', err instanceof Error ? err.message : 'Error al ejecutar Pull a todos')
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

  const linkedCount = metadatas.filter((m) => Boolean(config?.localMappings[m.id]?.localPath)).length

  if (loadingInit) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center liquid-text-primary gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
        <p className="text-sm font-medium">Iniciando SyncSeinen y verificando motor rclone...</p>
      </div>
    )
  }

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

      {/* Top Liquid Glass Navbar */}
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
                <h1 className="text-lg font-extrabold tracking-tight liquid-text-primary">SyncSeinen</h1>
              </div>
              <p className="text-xs liquid-text-muted">
                Sincronización multi-dispositivo con Google Drive &bull; Motor Rclone
              </p>
            </div>
          </div>

          {/* Right Controls: Update Notification + Device Name + Account + App Icon on top-right */}
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

            {isAuthenticated && (
              <div className="flex items-center gap-2 liquid-glass-sub rounded-2xl px-3.5 py-1.5">
                <Cloud className="w-4 h-4 text-sky-400" />
                <span className="text-xs liquid-text-primary font-semibold">Drive Activo</span>
                <button
                  onClick={handleLogout}
                  title="Cerrar sesión de Google Drive en rclone"
                  className="liquid-text-muted hover:text-rose-400 p-1 rounded-lg hover:bg-white/10 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Botón de engrane con menú pequeño de configuración arriba a la derecha */}
            <div className="relative" ref={settingsMenuRef}>
              <button
                type="button"
                onClick={() => setIsSettingsMenuOpen((prev) => !prev)}
                title="Configuración"
                className="w-10 h-10 rounded-2xl liquid-glass-sub hover:bg-white/10 flex items-center justify-center liquid-text-primary transition"
              >
                <Settings
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isSettingsMenuOpen ? 'rotate-90 text-sky-400' : ''
                  }`}
                />
              </button>

              {isSettingsMenuOpen && (
                <div
                  className={`absolute right-0 mt-2 w-64 rounded-2xl p-3 z-50 space-y-3 ${
                    theme === 'flat-red'
                      ? 'bg-[#121215] border border-red-600'
                      : 'liquid-glass-modal shadow-2xl'
                  }`}
                >
                  {/* Opción 1: Comportamiento al cerrar */}
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider liquid-text-muted px-2 mb-1.5">
                      Al cerrar la aplicación
                    </span>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => handleChangeCloseBehavior('tray')}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                          closeBehavior === 'tray'
                            ? theme === 'flat-red'
                              ? 'bg-red-600 text-white border border-red-500'
                              : 'liquid-glass-sub text-sky-400 border border-sky-400/40'
                            : theme === 'flat-red'
                              ? 'bg-[#18181c] text-zinc-300 border border-zinc-800 hover:border-red-500/60 hover:text-white'
                              : 'liquid-text-secondary hover:bg-white/10'
                        }`}
                      >
                        <span>Quedarse en segundo plano</span>
                        {closeBehavior === 'tray' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleChangeCloseBehavior('quit')}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                          closeBehavior === 'quit'
                            ? theme === 'flat-red'
                              ? 'bg-red-600 text-white border border-red-500'
                              : 'liquid-glass-sub text-sky-400 border border-sky-400/40'
                            : theme === 'flat-red'
                              ? 'bg-[#18181c] text-zinc-300 border border-zinc-800 hover:border-red-500/60 hover:text-white'
                              : 'liquid-text-secondary hover:bg-white/10'
                        }`}
                      >
                        <span>Cerrarse por completo</span>
                        {closeBehavior === 'quit' && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div
                    className={`border-t ${
                      theme === 'flat-red' ? 'border-zinc-800' : 'border-white/10'
                    }`}
                  />

                  {/* Opción 2: Tema visual */}
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider liquid-text-muted px-2 mb-1.5">
                      Tema visual
                    </span>
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => handleChangeTheme('liquid')}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                          theme === 'liquid'
                            ? 'liquid-glass-sub text-sky-400 border border-sky-400/40'
                            : 'bg-[#18181c] text-zinc-300 border border-zinc-800 hover:border-red-500/60 hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full inline-block"
                            style={{ background: 'linear-gradient(135deg, #38bdf8, #6366f1)' }}
                          />
                          Actual (Liquid Glass)
                        </span>
                        {theme === 'liquid' && <Check className="w-3.5 h-3.5" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleChangeTheme('flat-red')}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                          theme === 'flat-red'
                            ? 'bg-red-600 text-white border border-red-500'
                            : 'liquid-text-secondary hover:bg-white/10'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full inline-block border border-white/30"
                            style={{ backgroundColor: '#dc2626' }}
                          />
                          Negro y Rojo Plano
                        </span>
                        {theme === 'flat-red' && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar Banner (cuando el cuadro modal de creación no está abierto) */}
      {(progress || busyAction === 'create') && !isCreateModalOpen && (
        <div className="liquid-glass border-x-0 border-t-0 px-6 py-3 z-20">
          <div className="max-w-6xl mx-auto flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400 flex-shrink-0" />
                <span className="font-bold liquid-text-primary flex-shrink-0">
                  {progress ? `[${progress.operation.toUpperCase()}] ${progress.syncName}:` : '[PUSH] Sincronizando:'}
                </span>
                <span className="liquid-text-secondary flex-shrink-0">
                  {progress ? progress.phase : 'Subiendo archivos a Google Drive con rclone...'}
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
              statusMessage.type === 'success'
                ? 'border-emerald-400/50'
                : 'border-rose-400/50'
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
        {!isAuthenticated ? (
          /* One-Click Rclone Login Card */
          <div className="max-w-xl mx-auto mt-10 liquid-glass rounded-3xl p-8 text-center">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-sky-400/20 to-indigo-500/20 border border-sky-400/40 text-sky-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-sky-500/15">
              <Cloud className="w-8 h-8" />
            </div>

            <h2 className="text-2xl font-extrabold liquid-text-primary">Conectar con Google Drive</h2>
            <p className="text-sm liquid-text-secondary mt-2 leading-relaxed">
              SyncSeinen utiliza <strong>rclone</strong> integrado para conectarse directamente con tu cuenta de Google Drive sin que tengas que configurar proyectos en Google Cloud ni crear claves de API.
            </p>

            <div className="mt-6 p-4 rounded-2xl liquid-glass-sub text-left space-y-2 text-xs liquid-text-secondary">
              <div className="flex items-center gap-2 text-sky-400 font-bold">
                <Terminal className="w-4 h-4" />
                <span>¿Cómo funciona?</span>
              </div>
              <p>1. Haz clic en el botón de abajo para iniciar la autorización de <strong>rclone</strong>.</p>
              <p>2. Se abrirá tu navegador web para que elijas tu cuenta de Google y autorices el acceso.</p>
              <p>3. Al aceptar, la aplicación detectará automáticamente tus sincronizaciones y sus carátulas guardadas en <code className="text-sky-400 font-mono">_SyncSeinen_Metadata</code>.</p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {!loggingIn ? (
                <button
                  type="button"
                  onClick={handleLoginWithRclone}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 hover:from-indigo-400 hover:via-sky-400 hover:to-emerald-400 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-sky-500/25 transition"
                >
                  <ShieldCheck className="w-5 h-5" />
                  Iniciar Sesión con Google Drive (vía rclone)
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="w-full py-3.5 rounded-2xl liquid-glass-sub text-sky-400 font-semibold text-sm flex items-center justify-center gap-2.5">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Esperando autorización en tu navegador web...
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelLogin}
                    className="w-full py-2.5 rounded-2xl liquid-glass liquid-text-secondary text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <XCircle className="w-4 h-4 text-rose-400" />
                    Cancelar espera
                  </button>
                </div>
              )}
            </div>

            {config?.rcloneVersion && (
              <p className="mt-5 text-[11px] liquid-text-muted font-mono">
                Motor detectado: {config.rcloneVersion}
              </p>
            )}
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="space-y-6">
            {/* Global Controls Bar */}
            <div className="liquid-glass rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold liquid-text-primary flex items-center gap-2.5">
                  Sincronizaciones en tu Google Drive
                  <span className="text-xs px-3 py-0.5 rounded-full liquid-glass-sub liquid-text-secondary font-semibold">
                    {metadatas.length} total &bull; {linkedCount} vinculada(s) en esta PC
                  </span>
                </h2>
                <p className="text-xs liquid-text-muted mt-1">
                  Carpeta de metadatos y carátulas:{' '}
                  <code className="text-sky-400 font-mono">_SyncSeinen_Metadata</code>
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
                  title="Volver a leer metadatas desde _SyncSeinen_Metadata"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingSyncs ? 'animate-spin text-sky-400' : ''}`} />
                  Actualizar
                </button>

                <button
                  onClick={handlePullAll}
                  disabled={linkedCount === 0 || Boolean(busyAction)}
                  className="px-4 py-2.5 rounded-2xl bg-sky-500/20 hover:bg-sky-500 border border-sky-400/40 text-sky-400 hover:text-white disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  {busyAction === 'pull-all' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="w-4 h-4" />
                  )}
                  Pull a todos ({linkedCount})
                </button>

                <button
                  onClick={handlePushAll}
                  disabled={linkedCount === 0 || Boolean(busyAction)}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500 border border-emerald-400/40 text-emerald-400 hover:text-white disabled:opacity-40 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  {busyAction === 'push-all' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowUpFromLine className="w-4 h-4" />
                  )}
                  Push a todos ({linkedCount})
                </button>

                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  disabled={Boolean(busyAction)}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 hover:from-indigo-400 hover:via-sky-400 hover:to-emerald-400 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-500/25 transition"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Sincronización
                </button>
              </div>
            </div>

            {/* List / Grid of Synchronizations */}
            {loadingSyncs && metadatas.length === 0 ? (
              <div className="liquid-glass rounded-3xl p-12 flex flex-col items-center justify-center liquid-text-muted gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
                <p className="text-sm font-medium">Leyendo metadatas y carátulas con rclone...</p>
              </div>
            ) : metadatas.length === 0 ? (
              <div className="liquid-glass rounded-3xl p-12 text-center max-w-2xl mx-auto">
                <div className="w-14 h-14 rounded-3xl bg-sky-500/15 border border-sky-400/30 text-sky-400 flex items-center justify-center mx-auto mb-4">
                  <FolderSync className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-extrabold liquid-text-primary">
                  Aún no hay sincronizaciones registradas
                </h3>
                <p className="text-sm liquid-text-secondary mt-1 mb-6 leading-relaxed">
                  Haz clic en <strong>Nueva Sincronización</strong> para elegir una carátula, una carpeta de tu computadora y una carpeta de tu Google Drive.
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-sky-500 hover:from-indigo-400 hover:to-sky-400 text-white text-sm font-bold inline-flex items-center gap-2 shadow-lg shadow-sky-500/25 transition"
                >
                  <Plus className="w-4 h-4" />
                  Crear Primera Sincronización
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* VISTA EN CUADRÍCULA DE CARTAS (GRID VIEW) */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metadatas.map((sync) => {
                  const localMapping = config?.localMappings[sync.id]
                  const isLinked = Boolean(localMapping?.localPath)
                  const effectiveIgnored = Array.from(
                    new Set([...(sync.ignoredPaths || []), ...(localMapping?.ignoredPaths || [])])
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
                              <span className="text-xs font-medium liquid-text-muted">Sin carátula</span>
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
                              <span className="liquid-text-muted block text-[10px]">Último Push</span>
                              <span className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5 truncate">
                                <Laptop className="w-3 h-3 flex-shrink-0" />
                                {sync.lastPushedByDevice || sync.createdByDevice || 'N/A'}
                              </span>
                            </div>

                            <div className="liquid-glass-sub rounded-2xl p-2.5">
                              <span className="liquid-text-muted block text-[10px]">Archivos / Fecha</span>
                              <span className="liquid-text-primary font-semibold block mt-0.5 truncate">
                                {sync.lastPushedFileCount} arch. &bull; {formatDate(sync.lastPushedAt)}
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
                                    onClick={() => window.syncApi.openLocalPath(localMapping!.localPath)}
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
              /* VISTA EN FILA / LISTA (ROW VIEW - COMO ESTABA ACTUALMENTE) */
              <div className="grid grid-cols-1 gap-4">
                {metadatas.map((sync) => {
                  const localMapping = config?.localMappings[sync.id]
                  const isLinked = Boolean(localMapping?.localPath)
                  const effectiveIgnored = Array.from(
                    new Set([...(sync.ignoredPaths || []), ...(localMapping?.ignoredPaths || [])])
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
                      className="liquid-glass-card rounded-3xl p-5"
                    >
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
                              <span className="text-[10px] font-medium liquid-text-muted">Carátula</span>
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
                            <h3 className="text-base font-extrabold liquid-text-primary">{sync.name}</h3>
                            {isLinked ? (
                              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-400/30 flex items-center gap-1">
                                <Link2 className="w-3 h-3" />
                                Vinculada en este dispositivo
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-400/30">
                                Disponible en la nube &bull; Sin ruta local asignada
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
                              <span className="liquid-text-muted block text-[11px]">Carpeta en Google Drive</span>
                              <span
                                className="text-sky-400 font-semibold font-mono flex items-center gap-1.5 mt-0.5 truncate"
                                title={`/${sync.driveFolderPath}`}
                              >
                                <Cloud className="w-3.5 h-3.5 flex-shrink-0" />/{sync.driveFolderPath}
                              </span>
                            </div>

                            <div className="liquid-glass-sub rounded-2xl p-2.5">
                              <span className="liquid-text-muted block text-[11px]">Último dispositivo que subió (Push)</span>
                              <span className="text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5 truncate">
                                <Laptop className="w-3.5 h-3.5 flex-shrink-0" />
                                {sync.lastPushedByDevice || sync.createdByDevice || 'N/A'}
                              </span>
                            </div>

                            <div className="liquid-glass-sub rounded-2xl p-2.5">
                              <span className="liquid-text-muted block text-[11px]">Última subida / Archivos</span>
                              <span className="liquid-text-primary font-semibold block mt-0.5 truncate">
                                {formatDate(sync.lastPushedAt)} ({sync.lastPushedFileCount} arch.)
                              </span>
                            </div>
                          </div>

                          {/* Local folder section */}
                          {isLinked ? (
                            <div className="mt-3 p-3 rounded-2xl liquid-glass-sub flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
                                <HardDrive className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                <span className="liquid-text-muted flex-shrink-0">Ruta en esta PC:</span>
                                <code className="liquid-text-primary truncate font-mono">{localMapping?.localPath}</code>
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
                                  onClick={() => window.syncApi.openLocalPath(localMapping!.localPath)}
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
                                Sincronización detectada desde <code className="text-amber-400 font-mono">_SyncSeinen_Metadata</code>. Asígnale un directorio en esta computadora para descargar los archivos.
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
          </div>
        )}
      </main>

      <CreateSyncModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        progress={progress}
        isCreating={busyAction === 'create'}
        onCreated={handleCreateSync}
      />

      {editingIgnoreSync && (
        <IgnoreFilesModal
          isOpen={Boolean(editingIgnoreSync)}
          title={editingIgnoreSync.name}
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
