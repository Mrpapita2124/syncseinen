import React, { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Cloud,
  FolderOpen,
  FolderSync,
  HardDrive,
  Laptop,
  Link2,
  Link2Off,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Trash2,
  XCircle,
} from 'lucide-react'
import { AppConfig, SyncMetadata, SyncProgressEvent } from './types'
import { CreateSyncModal } from './components/CreateSyncModal'

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

  const isAuthenticated = Boolean(config?.isConnected)

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
    const unsubscribe = window.syncApi.onProgress((ev) => {
      setProgress(ev)
    })

    ;(async () => {
      try {
        const cfg = await window.syncApi.getConfig()
        setConfig(cfg)
        setDeviceNameInput(cfg.deviceName)

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
      unsubscribe()
    }
  }, [])

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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <p className="text-sm font-medium">Iniciando SyncSeinen y verificando motor rclone...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FolderSync className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">SyncSeinen</h1>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Motor Rclone Integrado
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                  Windows &amp; Linux
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Sincronización de carpetas entre dispositivos con Google Drive sin configurar APIs
              </p>
            </div>
          </div>

          {/* Device Identifier + Rclone Status */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-1.5">
              <Laptop className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-slate-400">Este dispositivo:</span>
              {editingDevice ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={deviceNameInput}
                    onChange={(e) => setDeviceNameInput(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:border-indigo-500 w-36"
                  />
                  <button
                    onClick={handleSaveDeviceName}
                    className="text-xs px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                  >
                    Guardar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditingDevice(true)}
                  className="text-xs font-semibold text-emerald-300 hover:underline"
                  title="Haz clic para cambiar el nombre de este dispositivo"
                >
                  {config?.deviceName}
                </button>
              )}
            </div>

            {isAuthenticated && (
              <div className="flex items-center gap-2.5 bg-slate-950/90 border border-slate-800 rounded-xl px-3 py-1.5">
                <Cloud className="w-4 h-4 text-sky-400" />
                <span className="text-xs text-slate-200 font-medium">
                  Google Drive Conectado
                </span>
                <button
                  onClick={handleLogout}
                  title="Cerrar sesión de Google Drive en rclone"
                  className="text-slate-400 hover:text-rose-400 p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Progress Bar Banner (se muestra de forma normal cuando el cuadro modal no está abierto) */}
      {(progress || busyAction === 'create') && !isCreateModalOpen && (
        <div className="bg-indigo-950/90 border-b border-indigo-800/80 px-6 py-3">
          <div className="max-w-6xl mx-auto flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400 flex-shrink-0" />
                <span className="font-semibold text-white flex-shrink-0">
                  {progress ? `[${progress.operation.toUpperCase()}] ${progress.syncName}:` : '[PUSH] Sincronizando:'}
                </span>
                <span className="text-indigo-200 flex-shrink-0">
                  {progress ? progress.phase : 'Subiendo archivos a Google Drive con rclone...'}
                </span>
                {progress?.detail && (
                  <span className="text-indigo-300/80 font-mono truncate">({progress.detail})</span>
                )}
              </div>
              <span className="text-indigo-300 font-mono flex-shrink-0 ml-2">
                {progress ? `${progress.current}%` : '0%'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-200"
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
        <div className="max-w-6xl w-full mx-auto px-6 pt-4">
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-sm ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                : 'bg-rose-950/60 border-rose-800/80 text-rose-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <CheckCircle2
                className={`w-4 h-4 flex-shrink-0 ${
                  statusMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'
                }`}
              />
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-75 hover:opacity-100 underline"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-6">
        {!isAuthenticated ? (
          /* One-Click Rclone Login Card */
          <div className="max-w-xl mx-auto mt-10 bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-5">
              <Cloud className="w-7 h-7" />
            </div>

            <h2 className="text-2xl font-bold text-white">Conectar con Google Drive</h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              SyncSeinen utiliza <strong>rclone</strong> integrado para conectarse directamente con tu cuenta de Google Drive sin que tengas que configurar proyectos en Google Cloud ni crear claves de API.
            </p>

            <div className="mt-6 p-4 rounded-xl bg-slate-950 border border-slate-800/90 text-left space-y-2 text-xs text-slate-300">
              <div className="flex items-center gap-2 text-sky-300 font-semibold">
                <Terminal className="w-4 h-4" />
                <span>¿Cómo funciona?</span>
              </div>
              <p>1. Haz clic en el botón de abajo para iniciar la autorización de <strong>rclone</strong>.</p>
              <p>2. Se abrirá tu navegador web para que elijas tu cuenta de Google y autorices el acceso.</p>
              <p>3. Al aceptar, la aplicación detectará automáticamente tus sincronizaciones guardadas en <code className="text-sky-300">_SyncSeinen_Metadata</code>.</p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {!loggingIn ? (
                <button
                  type="button"
                  onClick={handleLoginWithRclone}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-600/25 transition"
                >
                  <ShieldCheck className="w-5 h-5" />
                  Iniciar Sesión con Google Drive (vía rclone)
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="w-full py-3.5 rounded-xl bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 font-medium text-sm flex items-center justify-center gap-2.5">
                    <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                    Esperando autorización en tu navegador web...
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelLogin}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                  >
                    <XCircle className="w-4 h-4 text-rose-400" />
                    Cancelar espera
                  </button>
                </div>
              )}
            </div>

            {config?.rcloneVersion && (
              <p className="mt-5 text-[11px] text-slate-500 font-mono">
                Motor detectado: {config.rcloneVersion}
              </p>
            )}
          </div>
        ) : (
          /* Authenticated Dashboard */
          <div className="space-y-6">
            {/* Global Controls Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  Sincronizaciones en tu Google Drive
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal">
                    {metadatas.length} total &bull; {linkedCount} vinculada(s) en esta PC
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Carpeta de metadatos automática:{' '}
                  <code className="text-sky-300 bg-slate-950 px-1.5 py-0.5 rounded">_SyncSeinen_Metadata</code> (solo contiene los JSON de metadata; los archivos sincronizados se guardan en la carpeta de Drive que elijas).
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={refreshMetadatas}
                  disabled={loadingSyncs || Boolean(busyAction)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
                  title="Volver a leer metadatas desde _SyncSeinen_Metadata"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingSyncs ? 'animate-spin text-sky-400' : ''}`} />
                  Actualizar
                </button>

                <button
                  onClick={handlePullAll}
                  disabled={linkedCount === 0 || Boolean(busyAction)}
                  className="px-4 py-2.5 rounded-xl bg-sky-600/20 hover:bg-sky-600 border border-sky-500/30 text-sky-300 hover:text-white disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5 transition"
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
                  className="px-4 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-300 hover:text-white disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5 transition"
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
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-600/25 transition"
                >
                  <Plus className="w-4 h-4" />
                  Nueva Sincronización
                </button>
              </div>
            </div>

            {/* List of Synchronizations */}
            {loadingSyncs && metadatas.length === 0 ? (
              <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
                <p className="text-sm">Leyendo metadatas de sincronización con rclone...</p>
              </div>
            ) : metadatas.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-12 text-center max-w-2xl mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
                  <FolderSync className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white">Aún no hay sincronizaciones registradas</h3>
                <p className="text-sm text-slate-400 mt-1 mb-6 leading-relaxed">
                  Haz clic en <strong>Nueva Sincronización</strong> para elegir una carpeta de tu computadora y una carpeta de tu Google Drive. Se subirán tus archivos mediante <strong>rclone</strong> y se creará automáticamente la metadata para que puedas sincronizarla en cualquier otro dispositivo.
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                >
                  <Plus className="w-4 h-4" />
                  Crear Primera Sincronización
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {metadatas.map((sync) => {
                  const localMapping = config?.localMappings[sync.id]
                  const isLinked = Boolean(localMapping?.localPath)
                  const isThisBusy =
                    busyAction === `push-${sync.id}` ||
                    busyAction === `pull-${sync.id}` ||
                    busyAction === `assign-${sync.id}` ||
                    busyAction === `delete-${sync.id}`

                  return (
                    <div
                      key={sync.id}
                      className={`rounded-2xl border p-5 transition ${
                        isLinked
                          ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-900/50 border-amber-500/30 hover:border-amber-500/50'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-[280px]">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="text-base font-bold text-white">{sync.name}</h3>
                            {isLinked ? (
                              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <Link2 className="w-3 h-3" />
                                Vinculada en este dispositivo
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                Disponible en la nube &bull; Sin ruta local asignada
                              </span>
                            )}
                          </div>

                          {/* Metadata info badges */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5">
                              <span className="text-slate-400 block text-[11px]">Carpeta en Google Drive</span>
                              <span
                                className="text-sky-300 font-medium font-mono flex items-center gap-1.5 mt-0.5 truncate"
                                title={`/${sync.driveFolderPath}`}
                              >
                                <Cloud className="w-3.5 h-3.5 flex-shrink-0" />/{sync.driveFolderPath}
                              </span>
                            </div>

                            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5">
                              <span className="text-slate-400 block text-[11px]">Último dispositivo que subió (Push)</span>
                              <span className="text-emerald-300 font-semibold flex items-center gap-1.5 mt-0.5 truncate">
                                <Laptop className="w-3.5 h-3.5 flex-shrink-0" />
                                {sync.lastPushedByDevice || sync.createdByDevice || 'N/A'}
                              </span>
                            </div>

                            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5">
                              <span className="text-slate-400 block text-[11px]">Última subida / Archivos</span>
                              <span className="text-slate-200 font-medium block mt-0.5 truncate">
                                {formatDate(sync.lastPushedAt)} ({sync.lastPushedFileCount} arch.)
                              </span>
                            </div>
                          </div>

                          {/* Local folder section */}
                          {isLinked ? (
                            <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
                                <HardDrive className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                <span className="text-slate-400 flex-shrink-0">Ruta en esta PC:</span>
                                <code className="text-slate-200 truncate font-mono">{localMapping?.localPath}</code>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => window.syncApi.openLocalPath(localMapping!.localPath)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition"
                                  title="Abrir carpeta en el explorador de archivos"
                                >
                                  <FolderOpen className="w-3.5 h-3.5" />
                                  Abrir
                                </button>
                                <button
                                  onClick={() => handleAssignLocalFolderAndPull(sync, false)}
                                  disabled={Boolean(busyAction)}
                                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                                >
                                  Cambiar ruta
                                </button>
                                <button
                                  onClick={() => handleUnlinkLocal(sync)}
                                  disabled={Boolean(busyAction)}
                                  className="p-1 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 transition"
                                  title="Desvincular carpeta en este dispositivo"
                                >
                                  <Link2Off className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                              <p className="text-xs text-amber-200/90">
                                Sincronización detectada desde <code className="text-amber-300">_SyncSeinen_Metadata</code>. Asígnale un directorio en esta computadora para descargar los archivos y activar Pull / Push.
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleAssignLocalFolderAndPull(sync, true)}
                                  disabled={Boolean(busyAction)}
                                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition shadow-md"
                                >
                                  <ArrowDownToLine className="w-4 h-4" />
                                  Asignar Directorio y Hacer Pull
                                </button>
                                <button
                                  onClick={() => handleAssignLocalFolderAndPull(sync, false)}
                                  disabled={Boolean(busyAction)}
                                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition"
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
                                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition"
                                title="Descargar los archivos desde Google Drive hacia esta computadora con rclone"
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
                                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
                                title="Subir los archivos de esta computadora a Google Drive con rclone y actualizar metadata"
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
                            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 transition"
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
    </div>
  )
}

export default App
