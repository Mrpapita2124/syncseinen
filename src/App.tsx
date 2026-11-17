import React, { useEffect, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  Check,
  CheckCircle2,
  Cloud,
  EyeOff,
  FolderOpen,
  FolderSync,
  Gamepad2,
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
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react'
import {
  AppConfig,
  AutoDetectedSaveMatch,
  CloudProvider,
  DetectedGameSaveItem,
  SyncMetadata,
  SyncProgressEvent,
  UpdateCheckResult,
  UpdateProgressEvent,
} from './types'
import { CreateSyncModal } from './components/CreateSyncModal'
import { IgnoreFilesModal } from './components/IgnoreFilesModal'
import { UpdateModal } from './components/UpdateModal'
import { CoverPickerModal } from './components/CoverPickerModal'
import { useLang } from './i18n'

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
  const [lang, setLang, tr] = useLang()
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
  const [activeSection, setActiveSection] = useState<'files' | 'games'>('files')
  const [theme, setTheme] = useState<'liquid' | 'flat-red' | 'material'>('liquid')
  const [closeBehavior, setCloseBehavior] = useState<'tray' | 'quit'>('tray')
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [updateProgress, setUpdateProgress] = useState<UpdateProgressEvent | null>(null)

  // Estados del menú sobrepuesto de Saves de Videojuegos (PC, Emuladores y SteamGridDB)
  const [isGameScannerOpen, setIsGameScannerOpen] = useState(false)
  const [gameScannerStep, setGameScannerStep] = useState<'select' | 'configure'>('select')
  const [scanningGames, setScanningGames] = useState(false)
  const [detectedGames, setDetectedGames] = useState<DetectedGameSaveItem[]>([])
  const [gameSearchQuery, setGameSearchQuery] = useState('')
  const [gameScannerSourceFilter, setGameScannerSourceFilter] = useState<'all' | 'pc' | 'emulators'>('all')
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([])
  const [gameProviderChoices, setGameProviderChoices] = useState<Record<string, CloudProvider>>({})
  const [syncingGameId, setSyncingGameId] = useState<string | null>(null)
  const [syncedGameIds, setSyncedGameIds] = useState<Record<string, CloudProvider>>({})

  // Auto-detección de rutas locales en otro dispositivo para saves sin vincular
  const [autoSaveMatches, setAutoSaveMatches] = useState<Record<string, AutoDetectedSaveMatch>>({})
  const [scanningAutoPaths, setScanningAutoPaths] = useState(false)
  const [manualPathInputs, setManualPathInputs] = useState<Record<string, string>>({})

  const connectedServices: Record<CloudProvider, boolean> = config?.connectedServices || {
    gdrive: Boolean(config?.isConnected),
    dropbox: false,
    onedrive: false,
  }
  const activeProviders = ALL_PROVIDERS.filter((p) => connectedServices[p])
  const isAuthenticated = activeProviders.length > 0

  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-liquid', 'theme-flat-red', 'theme-material')
    document.body.classList.add(
      theme === 'flat-red' ? 'theme-flat-red' : theme === 'material' ? 'theme-material' : 'theme-liquid'
    )
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

  const runAutoSavePathScan = async (
    metasList: SyncMetadata[],
    cfgOverride?: AppConfig | null
  ) => {
    const activeCfg = cfgOverride ?? config
    const unlinkedGames = metasList.filter(
      (m) => Boolean(m.isGameSave) && !activeCfg?.localMappings[m.id]?.localPath
    )
    if (unlinkedGames.length === 0) {
      setAutoSaveMatches({})
      return
    }
    setScanningAutoPaths(true)
    try {
      const found = await window.syncApi.findAutoSavePaths(unlinkedGames)
      setAutoSaveMatches(found || {})
    } catch {
      // ignore auto-scan errors
    } finally {
      setScanningAutoPaths(false)
    }
  }

  const refreshMetadatas = async (cfgOverride?: AppConfig | null) => {
    setLoadingSyncs(true)
    try {
      const list = await window.syncApi.listSyncMetadatas()
      setMetadatas(list)
      runAutoSavePathScan(list, cfgOverride)
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
        if (cfg.theme === 'flat-red' || cfg.theme === 'liquid' || cfg.theme === 'material') setTheme(cfg.theme)
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
          await refreshMetadatas(cfg)
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

  const handleChangeTheme = async (nextTheme: 'liquid' | 'flat-red' | 'material') => {
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
      await refreshMetadatas(updatedCfg)
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
    isGameSave?: boolean
  }) => {
    setBusyAction('create')
    const label = PROVIDER_META[params.provider]?.label || 'la nube'
    try {
      const { meta, config: updatedConfig } = await window.syncApi.createSync(params)
      setConfig(updatedConfig)
      await refreshMetadatas()
      if (params.isGameSave) {
        setActiveSection('games')
      }
      showBanner(
        'success',
        `Sincronización "${meta.name}" creada en ${label}, archivos subidos a "/${meta.driveFolderPath}" y metadata guardada.`
      )
    } finally {
      setBusyAction(null)
      setProgress(null)
    }
  }

  const runGameSavesScan = async () => {
    setScanningGames(true)
    try {
      const results = await window.syncApi.scanGameSaves()
      setDetectedGames(results)
      const defaultProv = activeProviders[0] || 'gdrive'
      setGameProviderChoices((prev) => {
        const next = { ...prev }
        for (const g of results) {
          if (!next[g.id] || !connectedServices[next[g.id]]) {
            next[g.id] = defaultProv
          }
        }
        return next
      })
    } catch (err: unknown) {
      showBanner(
        'error',
        err instanceof Error
          ? err.message
          : 'No se pudo escanear los saves de videojuegos y emuladores'
      )
    } finally {
      setScanningGames(false)
    }
  }

  const handleOpenGameScanner = () => {
    setIsGameScannerOpen(true)
    setGameScannerStep('select')
    setGameSearchQuery('')
    if (detectedGames.length === 0 && !scanningGames) {
      runGameSavesScan()
    }
  }

  const handleToggleGameSelect = (gameId: string) => {
    setSelectedGameIds((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    )
  }

  const handleSyncAllSelectedGames = async () => {
    const gamesToSync = detectedGames.filter((g) => selectedGameIds.includes(g.id))
    if (gamesToSync.length === 0) {
      setIsGameScannerOpen(false)
      return
    }

    setBusyAction('game-sync-batch')
    setStatusMessage(null)
    let syncedCount = 0
    const errors: string[] = []

    try {
      for (const game of gamesToSync) {
        const chosenProvider =
          gameProviderChoices[game.id] && connectedServices[gameProviderChoices[game.id]]
            ? gameProviderChoices[game.id]
            : activeProviders[0] || 'gdrive'

        setSyncingGameId(game.id)
        try {
          const { config: updatedCfg } = await window.syncApi.createGameSaveSync({
            provider: chosenProvider,
            name: game.name,
            localPath: game.localPath,
            ignoredPaths: game.ignoredPaths,
            coverUrl: game.coverUrl || null,
            thumbUrl: game.thumbUrl || null,
            emulatorName: game.emulatorName || null,
            systemName: game.systemName || null,
          })
          setConfig(updatedCfg)
          setSyncedGameIds((prev) => ({
            ...prev,
            [game.id]: chosenProvider,
          }))
          syncedCount++
        } catch (err: unknown) {
          errors.push(
            `${game.name}: ${err instanceof Error ? err.message : 'Error al sincronizar'}`
          )
        }
      }

      await refreshMetadatas()
      setActiveSection('games')

      if (errors.length === 0) {
        setSelectedGameIds([])
        setIsGameScannerOpen(false)
        showBanner(
          'success',
          `¡Se sincronizaron ${syncedCount} videojuego(s) correctamente en /SyncSeinen_games_saves!`
        )
      } else {
        showBanner(
          'error',
          `Se sincronizaron ${syncedCount} de ${gamesToSync.length}. Errores: ${errors.join(' | ')}`
        )
      }
    } finally {
      setSyncingGameId(null)
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
        await refreshMetadatas(res.config)
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

  const handleAutoPullWithDetectedPath = async (
    sync: SyncMetadata,
    match: AutoDetectedSaveMatch
  ) => {
    setBusyAction(`assign-${sync.id}`)
    setStatusMessage(null)
    try {
      const updatedCfg = await window.syncApi.assignLocalFolder(sync.id, match.localPath)
      setConfig(updatedCfg)
      const res = await window.syncApi.pullSync(sync.id)
      setConfig(res.config)
      await refreshMetadatas(res.config)
      showBanner(
        'success',
        `Sincronización automática (Pull) completada para "${sync.name}" en "${match.localPath}".`
      )
    } catch (err: unknown) {
      showBanner(
        'error',
        err instanceof Error
          ? err.message
          : `Error al sincronizar automáticamente "${sync.name}"`
      )
    } finally {
      setBusyAction(null)
      setProgress(null)
    }
  }

  const handleBrowseManualPath = async (sync: SyncMetadata) => {
    const picked = await window.syncApi.pickLocalFolder()
    if (!picked) return
    setManualPathInputs((prev) => ({
      ...prev,
      [sync.id]: picked,
    }))
  }

  const handleLinkManualPathAndPull = async (sync: SyncMetadata, autoPull: boolean) => {
    let targetPath = (manualPathInputs[sync.id] || '').trim()
    if (!targetPath) {
      const picked = await window.syncApi.pickLocalFolder()
      if (!picked) return
      targetPath = picked
      setManualPathInputs((prev) => ({ ...prev, [sync.id]: picked }))
    }

    setBusyAction(`assign-${sync.id}`)
    setStatusMessage(null)
    try {
      const updatedCfg = await window.syncApi.assignLocalFolder(sync.id, targetPath)
      setConfig(updatedCfg)
      if (autoPull) {
        const res = await window.syncApi.pullSync(sync.id)
        setConfig(res.config)
        await refreshMetadatas(res.config)
        showBanner(
          'success',
          `Ruta vinculada y archivos descargados (Pull) en "${targetPath}".`
        )
      } else {
        showBanner('success', `Ruta local asignada a "${sync.name}": ${targetPath}`)
      }
    } catch (err: unknown) {
      showBanner(
        'error',
        err instanceof Error ? err.message : 'Error al vincular la ruta ingresada'
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
                        {tr('Signed in', 'Sesión iniciada')}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/5 liquid-text-muted border border-white/10">
                        {tr('Not linked', 'Sin vincular')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs liquid-text-muted mt-0.5">
                    {provider === 'gdrive'
                      ? tr('Direct sync with your Google Drive', 'Sincronización directa con tu unidad de Google Drive')
                      : provider === 'dropbox'
                        ? tr('Fast sync with your Dropbox folders', 'Sincronización rápida con tus carpetas de Dropbox')
                        : tr('Sync with your Microsoft OneDrive cloud', 'Sincronización con tu nube de Microsoft OneDrive')}
                  </p>
                </div>
              </div>

              {/* Derecha: Botón de Acción */}
              <div className="flex items-center gap-2 ml-auto">
                {isThisLoggingIn ? (
                  <div className="flex items-center gap-2">
                    <div className="py-2 px-3 rounded-xl liquid-glass text-sky-400 font-semibold text-xs flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      <span>{tr('Authorize in browser...', 'Autoriza en el navegador...')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelLogin}
                      className="py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {tr('Cancel', 'Cancelar')}
                    </button>
                  </div>
                ) : isConn ? (
                  <div className="flex items-center gap-2">
                    <div className="py-2 px-3.5 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      {tr('Connected', 'Conectado')}
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(loggingInProvider) || Boolean(busyAction)}
                      onClick={() => handleLogoutProvider(provider)}
                      title={tr(`Sign out of ${info.label}`, `Cerrar sesión de ${info.label}`)}
                      className="px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/30 text-rose-400 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-40"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {tr('Sign out', 'Cerrar sesión')}
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
                    {tr('Sign in', 'Iniciar sesión')}
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
                      {tr('Signed in', 'Sesión iniciada')}
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/5 liquid-text-muted border border-white/10">
                      {tr('Not linked', 'Sin vincular')}
                    </span>
                  )}
                </div>

                <p className="text-xs liquid-text-secondary leading-relaxed">
                  {provider === 'gdrive'
                    ? tr('Direct sync with your Google Drive', 'Sincronización directa con tu unidad de Google Drive')
                    : provider === 'dropbox'
                      ? tr('Fast sync with your Dropbox folders', 'Sincronización rápida con tus carpetas de Dropbox')
                      : tr('Sync with your Microsoft OneDrive cloud', 'Sincronización con tu nube de Microsoft OneDrive')}
                </p>
              </div>

              <div>
                {isThisLoggingIn ? (
                  <div className="space-y-2">
                    <div className="w-full py-2 px-3 rounded-xl liquid-glass text-sky-400 font-semibold text-xs flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                      <span>{tr('Authorize in browser...', 'Autoriza en el navegador...')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleCancelLogin}
                      className="w-full py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {tr('Cancel', 'Cancelar')}
                    </button>
                  </div>
                ) : isConn ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 py-2 px-3 rounded-xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5">
                      <Check className="w-3.5 h-3.5" />
                      {tr('Connected', 'Conectado')}
                    </div>
                    <button
                      type="button"
                      disabled={Boolean(loggingInProvider) || Boolean(busyAction)}
                      onClick={() => handleLogoutProvider(provider)}
                      title={tr(`Sign out of ${info.label}`, `Cerrar sesión de ${info.label}`)}
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
                    {tr(`Sign in to ${info.label}`, `Iniciar sesión en ${info.label}`)}
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
        <p className="text-sm font-medium">
          {tr('Starting SyncSeinen and checking rclone engine...', 'Iniciando SyncSeinen y verificando motor rclone...')}
        </p>
      </div>
    )
  }

  const showOnboardingLoginView = !hasEnteredDashboard || !isAuthenticated
  const sectionMetadatas = metadatas.filter(
    (m) => Boolean(m.isGameSave) === (activeSection === 'games')
  )
  const pcDetectedCount = detectedGames.filter(
    (g) => !g.source || g.source === 'ludusavi'
  ).length
  const emulatorDetectedCount = detectedGames.filter(
    (g) => g.source === 'emuatlas' || g.source === 'emuvault' || Boolean(g.emulatorName)
  ).length
  const filteredDetectedGames = detectedGames.filter((g) => {
    const isEmu = g.source === 'emuatlas' || g.source === 'emuvault' || Boolean(g.emulatorName)
    if (gameScannerSourceFilter === 'pc' && isEmu) return false
    if (gameScannerSourceFilter === 'emulators' && !isEmu) return false

    const q = gameSearchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      g.name.toLowerCase().includes(q) ||
      g.localPath.toLowerCase().includes(q) ||
      Boolean(g.emulatorName && g.emulatorName.toLowerCase().includes(q)) ||
      Boolean(g.systemName && g.systemName.toLowerCase().includes(q))
    )
  })
  const selectedGameObjects = detectedGames.filter((g) => selectedGameIds.includes(g.id))

  return (
    <div
      className={`min-h-screen flex flex-col relative overflow-x-hidden ${
        theme === 'flat-red' ? 'theme-flat-red' : theme === 'material' ? 'theme-material' : 'theme-liquid'
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
                {tr(
                  'Multi-cloud sync (Google Drive, Dropbox & OneDrive) • Rclone Engine',
                  'Sincronización multi-nube (Google Drive, Dropbox y OneDrive) • Motor Rclone'
                )}
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
                title={tr('Click to see release notes and install update', 'Haz clic para ver qué cambia e instalar la nueva versión')}
              >
                <Rocket className="w-4 h-4 text-emerald-400" />
                <span>{tr(`New version v${updateInfo.latestVersion}!`, `¡Nueva versión v${updateInfo.latestVersion}!`)}</span>
              </button>
            )}

            {/* Device Name */}
            <div className="flex items-center gap-2 liquid-glass-sub rounded-2xl px-3.5 py-1.5">
              <Laptop className="w-4 h-4 text-emerald-400" />
              <span className="text-xs liquid-text-muted">{tr('Device:', 'Dispositivo:')}</span>
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
                  title={tr('Click to rename this device', 'Haz clic para cambiar el nombre de este dispositivo')}
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
                title={tr('Open menu to manage connected services', 'Abrir menú para gestionar servicios conectados')}
              >
                <Cloud className="w-4 h-4 text-sky-400" />
                <span className="text-xs liquid-text-primary font-semibold">
                  {activeProviders.length}{' '}
                  {activeProviders.length === 1
                    ? tr('Active Service', 'Servicio Activo')
                    : tr('Active Services', 'Servicios Activos')}
                </span>
              </button>
            )}

            {/* Botón de engrane que abre el menú sobrepuesto estilo pausa de videojuego */}
            <button
              type="button"
              onClick={() => setIsSettingsMenuOpen(true)}
              title={tr('Open Settings Menu', 'Abrir Menú de Configuración')}
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
                    {tr('SYSTEM MENU', 'MENÚ DEL SISTEMA')}
                  </span>
                  <h2 className="text-xl font-black tracking-tight liquid-text-primary">
                    {tr('Settings & Cloud Services', 'Configuración y Servicios en la Nube')}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsMenuOpen(false)}
                className="px-4 py-2 rounded-2xl liquid-glass-sub hover:bg-white/10 liquid-text-primary text-xs font-bold flex items-center gap-1.5 transition"
              >
                <X className="w-4 h-4" />
                {tr('Resume', 'Reanudar')}
              </button>
            </div>

            {/* Cuerpo del Menú Sobrepuesto */}
            <div className="p-7 space-y-6 overflow-y-auto">
              {/* Sección 1: Servicios en la Nube en vista de FILAS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold uppercase tracking-wider liquid-text-primary">
                      {tr('1. Linked Cloud Services', '1. Servicios en la Nube Vinculados')}
                    </h3>
                    <p className="text-xs liquid-text-muted mt-0.5">
                      {tr(
                        'Sign in or disconnect your Google Drive, Dropbox, and OneDrive accounts.',
                        'Inicia sesión o desconecta tus cuentas de Google Drive, Dropbox y OneDrive.'
                      )}
                    </p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full liquid-glass-sub liquid-text-secondary">
                    {tr(`${activeProviders.length} of 3 active`, `${activeProviders.length} de 3 activos`)}
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
                    {tr('2. When closing the app', '2. Al cerrar la aplicación')}
                  </span>
                  <p className="text-xs liquid-text-muted">
                    {tr(
                      'Choose whether SyncSeinen stays running in the background or quits completely.',
                      'Elige si SyncSeinen permanece activo en segundo plano o se cierra por completo.'
                    )}
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
                      <span>{tr('Keep in background (Tray)', 'Quedarse en segundo plano (Bandeja)')}</span>
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
                      <span>{tr('Quit completely', 'Cerrarse por completo')}</span>
                      {closeBehavior === 'quit' && <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Opción: Selector de Temas como Botones con Muestra Visual de Colores */}
                <div className="space-y-2.5">
                  <span className="block text-xs font-extrabold uppercase tracking-wider liquid-text-primary">
                    {tr('3. Visual theme', '3. Tema visual')}
                  </span>
                  <p className="text-xs liquid-text-muted">
                    {tr('Select the app visual style:', 'Selecciona el estilo visual de la aplicación:')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Botón Tema 1: Cristal Líquido */}
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
                        <span>{tr('Liquid Glass', 'Cristal Líquido')}</span>
                        {theme === 'liquid' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                      </div>
                    </button>

                    {/* Botón Tema 2: Negro y Rojo */}
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
                        <span>{tr('Black & Red', 'Negro y Rojo')}</span>
                        {theme === 'flat-red' && <Check className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </button>

                    {/* Botón Tema 3: Material Expressive */}
                    <button
                      type="button"
                      onClick={() => handleChangeTheme('material')}
                      className={`p-3 rounded-2xl flex flex-col items-center gap-2.5 border transition ${
                        theme === 'material'
                          ? 'bg-[#361940] border-[#cf9fff] text-[#f7ebff]'
                          : 'liquid-glass-sub border-white/10 liquid-text-secondary hover:bg-white/10'
                      }`}
                    >
                      <div
                        className="w-12 h-12 rounded-2xl border border-[#cf9fff]/50 flex flex-col items-center justify-center gap-1 p-1.5 flex-shrink-0"
                        style={{ backgroundColor: '#24102b' }}
                      >
                        <div className="w-full h-3 rounded-full" style={{ backgroundColor: '#cf9fff' }} />
                        <div className="w-3/4 h-2.5 rounded-full self-end" style={{ backgroundColor: '#ff9e9d' }} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-extrabold">
                        <span>Material</span>
                        {theme === 'material' && <Check className="w-3.5 h-3.5 text-[#cf9fff]" />}
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`border-t ${
                  theme === 'flat-red' ? 'border-zinc-800' : 'border-white/10'
                }`}
              />

              {/* Sección 4: Idioma / Language */}
              <div className="space-y-2.5">
                <span className="block text-xs font-extrabold uppercase tracking-wider liquid-text-primary">
                  {tr('4. Language / Idioma', '4. Idioma / Language')}
                </span>
                <p className="text-xs liquid-text-muted">
                  {tr('Choose the display language for SyncSeinen:', 'Elige el idioma de la interfaz de SyncSeinen:')}
                </p>
                <div className="grid grid-cols-2 gap-3 pt-1 max-w-sm">
                  <button
                    type="button"
                    onClick={() => setLang('en')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between transition ${
                      lang === 'en'
                        ? theme === 'flat-red'
                          ? 'bg-red-600 text-white border border-red-500'
                          : 'liquid-glass-sub text-sky-400 border border-sky-400/50'
                        : theme === 'flat-red'
                          ? 'bg-[#18181c] text-zinc-300 border border-zinc-800 hover:border-red-500/60 hover:text-white'
                          : 'liquid-glass-sub liquid-text-secondary hover:bg-white/10'
                    }`}
                  >
                    <span>English</span>
                    {lang === 'en' && <Check className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLang('es')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between transition ${
                      lang === 'es'
                        ? theme === 'flat-red'
                          ? 'bg-red-600 text-white border border-red-500'
                          : 'liquid-glass-sub text-sky-400 border border-sky-400/50'
                        : theme === 'flat-red'
                          ? 'bg-[#18181c] text-zinc-300 border border-zinc-800 hover:border-red-500/60 hover:text-white'
                          : 'liquid-glass-sub liquid-text-secondary hover:bg-white/10'
                    }`}
                  >
                    <span>Español</span>
                    {lang === 'es' && <Check className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Footer del Menú de Pausa */}
            <div className="px-7 py-4 border-t border-white/15 flex items-center justify-between">
              <span className="text-xs liquid-text-muted font-mono">
                {config?.rcloneVersion || tr('Rclone engine active', 'Motor Rclone activo')}
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
                {tr('Back to SyncSeinen', 'Volver a SyncSeinen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menú Sobrepuesto de Saves de Videojuegos (Estilo Pausa • SteamGridDB) */}
      {isGameScannerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !syncingGameId) {
              setIsGameScannerOpen(false)
            }
          }}
        >
          <div
            className={`w-full max-w-5xl rounded-3xl overflow-hidden flex flex-col max-h-[90vh] ${
              theme === 'flat-red'
                ? 'bg-[#121215] border-2 border-red-600 shadow-2xl'
                : 'liquid-glass-modal shadow-2xl border border-sky-400/35'
            }`}
          >
            {/* Header del Menú de Pausa de Saves de Videojuegos */}
            <div className="px-7 py-5 border-b border-white/15 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2.5 rounded-2xl ${
                    theme === 'flat-red'
                      ? 'bg-red-600/20 border border-red-500 text-red-400'
                      : 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-400'
                  }`}
                >
                  <Gamepad2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] liquid-text-muted block">
                    {gameScannerStep === 'select'
                      ? tr(
                          'STEP 1 • GAME & EMULATOR SAVE SCANNER',
                          'PASO 1 • ESCÁNER DE SAVES DE VIDEOJUEGOS Y EMULADORES'
                        )
                      : tr(
                          'STEP 2 • PER-GAME SYNC (SYNCSEINEN_GAMES_SAVES)',
                          'PASO 2 • SINCRONIZACIÓN POR JUEGO (SYNCSEINEN_GAMES_SAVES)'
                        )}
                  </span>
                  <h2 className="text-xl font-black tracking-tight liquid-text-primary">
                    {gameScannerStep === 'select'
                      ? tr(
                          'Game & Emulator Saves Found on Your PC',
                          'Saves de Videojuegos y Emuladores Encontrados en tu PC'
                        )
                      : tr('Sync Selected Games', 'Sincronizar Videojuegos Seleccionados')}
                  </h2>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {gameScannerStep === 'select' && (
                  <button
                    type="button"
                    disabled={scanningGames}
                    onClick={runGameSavesScan}
                    className="px-3.5 py-2 rounded-2xl liquid-glass-sub hover:bg-white/10 liquid-text-primary text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${scanningGames ? 'animate-spin text-sky-400' : ''}`} />
                    {tr('Rescan PC', 'Reescanear PC')}
                  </button>
                )}

                {gameScannerStep === 'configure' && (
                  <button
                    type="button"
                    disabled={Boolean(syncingGameId)}
                    onClick={() => setGameScannerStep('select')}
                    className="px-3.5 py-2 rounded-2xl liquid-glass-sub hover:bg-white/10 liquid-text-primary text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {tr('Back to selection', 'Volver a selección')}
                  </button>
                )}

                <button
                  type="button"
                  disabled={Boolean(syncingGameId)}
                  onClick={() => setIsGameScannerOpen(false)}
                  className="px-4 py-2 rounded-2xl liquid-glass-sub hover:bg-white/10 liquid-text-primary text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  {tr('Close', 'Cerrar')}
                </button>
              </div>
            </div>

            {gameScannerStep === 'select' ? (
              /* ==================== PASO 1: FILTRAR Y SELECCIONAR JUEGOS ==================== */
              <>
                {/* Barra de búsqueda de texto, filtro de origen (PC vs Emuladores) y contador de seleccionados */}
                <div className="px-7 py-4 border-b border-white/10 flex flex-col gap-3 bg-black/20">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex-1 min-w-[240px]">
                      <Search className="w-4 h-4 liquid-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={gameSearchQuery}
                        onChange={(e) => setGameSearchQuery(e.target.value)}
                        placeholder={tr('Search by game name, emulator, console or path...', 'Buscar por nombre del juego, emulador, consola o ruta...')}
                        className="w-full liquid-glass-sub rounded-2xl pl-10 pr-4 py-2.5 text-sm liquid-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold px-3 py-1.5 rounded-xl liquid-glass-sub liquid-text-secondary">
                        {filteredDetectedGames.length} {tr('found', 'encontrado(s)')} &bull;{' '}
                        <strong className="text-emerald-400">
                          {selectedGameIds.length} {tr('selected', 'seleccionado(s)')}
                        </strong>
                      </span>

                      {filteredDetectedGames.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const allVisibleSelected = filteredDetectedGames.every((g) =>
                              selectedGameIds.includes(g.id)
                            )
                            if (allVisibleSelected) {
                              const visibleSet = new Set(filteredDetectedGames.map((g) => g.id))
                              setSelectedGameIds((prev) => prev.filter((id) => !visibleSet.has(id)))
                            } else {
                              setSelectedGameIds((prev) =>
                                Array.from(new Set([...prev, ...filteredDetectedGames.map((g) => g.id)]))
                              )
                            }
                          }}
                          className="px-3 py-2 rounded-xl liquid-glass-sub hover:bg-white/10 text-xs font-semibold liquid-text-primary transition"
                        >
                          {filteredDetectedGames.every((g) => selectedGameIds.includes(g.id))
                            ? tr('Unselect visible', 'Deseleccionar visibles')
                            : tr('Select visible', 'Seleccionar visibles')}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filtros por origen */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setGameScannerSourceFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        gameScannerSourceFilter === 'all'
                          ? theme === 'flat-red'
                            ? 'bg-red-600 border-red-500 text-white shadow'
                            : 'bg-sky-500/25 border-sky-400 text-sky-300 shadow'
                          : 'liquid-glass-sub border-white/10 liquid-text-secondary hover:bg-white/10'
                      }`}
                    >
                      {tr('All', 'Todos')} ({detectedGames.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setGameScannerSourceFilter('pc')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        gameScannerSourceFilter === 'pc'
                          ? theme === 'flat-red'
                            ? 'bg-red-600 border-red-500 text-white shadow'
                            : 'bg-emerald-500/25 border-emerald-400 text-emerald-300 shadow'
                          : 'liquid-glass-sub border-white/10 liquid-text-secondary hover:bg-white/10'
                      }`}
                    >
                      {tr('PC Games', 'Juegos de PC')} ({pcDetectedCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setGameScannerSourceFilter('emulators')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                        gameScannerSourceFilter === 'emulators'
                          ? theme === 'flat-red'
                            ? 'bg-red-600 border-red-500 text-white shadow'
                            : 'bg-indigo-500/25 border-indigo-400 text-indigo-300 shadow'
                          : 'liquid-glass-sub border-white/10 liquid-text-secondary hover:bg-white/10'
                      }`}
                    >
                      {tr('Emulators & PC Ports', 'Emuladores y Ports PC')} ({emulatorDetectedCount})
                    </button>
                  </div>
                </div>

                {/* Cuerpo con secciones por emulador / PC y cuadrícula de juegos detectados */}
                <div className="p-7 overflow-y-auto flex-1 min-h-[340px]">
                  {scanningGames ? (
                    <div className="h-72 flex flex-col items-center justify-center gap-3 text-center">
                      <Loader2 className="w-9 h-9 animate-spin text-sky-400" />
                      <div className="space-y-1">
                        <p className="text-sm font-extrabold liquid-text-primary">
                          {tr('Scanning game, emulator and PC port saves...', 'Escaneando saves de videojuegos, emuladores y ports de PC...')}
                        </p>
                        <p className="text-xs liquid-text-muted">
                          {tr(
                            'Searching for save files on your computer and fetching SteamGridDB covers.',
                            'Buscando partidas guardadas en tu computadora y obteniendo carátulas desde SteamGridDB.'
                          )}
                        </p>
                      </div>
                    </div>
                  ) : filteredDetectedGames.length === 0 ? (
                    <div className="h-72 flex flex-col items-center justify-center gap-3 text-center">
                      <Gamepad2 className="w-10 h-10 liquid-text-muted" />
                      <p className="text-sm font-bold liquid-text-primary">
                        {detectedGames.length === 0
                          ? tr('No game or emulator saves were automatically detected on this PC.', 'No se detectaron saves de videojuegos ni emuladores automáticamente en esta PC.')
                          : tr(
                              `No results for current filter${gameSearchQuery ? ` ("${gameSearchQuery}")` : ''}.`,
                              `No hay resultados para el filtro actual${gameSearchQuery ? ` ("${gameSearchQuery}")` : ''}.`
                            )}
                      </p>
                      <p className="text-xs liquid-text-muted max-w-md">
                        {tr('You can also add any game manually using ', 'También puedes agregar cualquier juego manualmente usando el botón ')}
                        <strong>+ {tr('New Sync', 'Nueva Sincronización')}</strong>
                        {tr(' and checking Mark as Game.', ' y activando la casilla de videojuego.')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-7">
                      {(() => {
                        const renderGameCard = (game: DetectedGameSaveItem) => {
                          const isSelected = selectedGameIds.includes(game.id)
                          const alreadySynced = metadatas.some(
                            (m) =>
                              Boolean(m.isGameSave) &&
                              m.name.toLowerCase() === game.name.toLowerCase()
                          )
                          const isEmulatorSave =
                            game.source === 'emuatlas' ||
                            game.source === 'emuvault' ||
                            Boolean(game.emulatorName)

                          return (
                            <div
                              key={game.id}
                              onClick={() => handleToggleGameSelect(game.id)}
                              className={`rounded-2xl overflow-hidden cursor-pointer border transition flex flex-col justify-between group ${
                                isSelected
                                  ? theme === 'flat-red'
                                    ? 'bg-[#1a1416] border-2 border-red-500 shadow-lg shadow-red-600/20'
                                    : 'liquid-glass-sub border-2 border-emerald-400 shadow-lg shadow-emerald-500/15'
                                  : 'liquid-glass-sub border-white/10 hover:border-white/30'
                              }`}
                            >
                              {/* Carátula de SteamGridDB */}
                              <div className="relative h-36 w-full overflow-hidden bg-gradient-to-br from-indigo-500/20 via-slate-900 to-emerald-500/20 border-b border-white/10">
                                {game.thumbUrl || game.coverUrl ? (
                                  <img
                                    src={game.thumbUrl || game.coverUrl || ''}
                                    alt={game.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  />
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-sky-400/70">
                                    <Gamepad2 className="w-8 h-8" />
                                    <span className="text-[10px] liquid-text-muted">SteamGridDB</span>
                                  </div>
                                )}

                                {/* Etiqueta de Emulador / Origen arriba a la izquierda */}
                                <div className="absolute top-2.5 left-2.5 flex items-center gap-1 max-w-[65%]">
                                  {isEmulatorSave ? (
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-950/85 text-indigo-300 border border-indigo-400/50 backdrop-blur-md truncate">
                                      {game.emulatorName || 'Emulador'}
                                      {game.systemName ? ` • ${game.systemName}` : ''}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-emerald-300 border border-emerald-400/40 backdrop-blur-md truncate">
                                      PC
                                    </span>
                                  )}
                                </div>

                                {/* Indicador de Selección arriba a la derecha */}
                                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                                  {alreadySynced && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/70 text-sky-300 border border-sky-400/40 backdrop-blur-md">
                                      {tr('Already in cloud', 'Ya en tu nube')}
                                    </span>
                                  )}
                                  <div
                                    className={`w-7 h-7 rounded-xl flex items-center justify-center border transition ${
                                      isSelected
                                        ? theme === 'flat-red'
                                          ? 'bg-red-600 border-red-400 text-white shadow'
                                          : 'bg-emerald-500 border-emerald-300 text-slate-950 shadow'
                                        : 'bg-black/60 border-white/30 text-white/70'
                                    }`}
                                  >
                                    <Check className="w-4 h-4 stroke-[3]" />
                                  </div>
                                </div>

                                {/* Nombre sobrepuesto abajo */}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent p-3 pt-7">
                                  <h4 className="text-sm font-extrabold text-white truncate drop-shadow">
                                    {game.name}
                                  </h4>
                                </div>
                              </div>

                              {/* Ruta local del save */}
                              <div className="p-3 flex items-center gap-2 text-xs">
                                <HardDrive className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                                <code
                                  className="text-[11px] liquid-text-secondary font-mono truncate"
                                  title={game.localPath}
                                >
                                  {game.localPath}
                                </code>
                              </div>
                            </div>
                          )
                        }

                        if (gameScannerSourceFilter === 'all') {
                          const sortedGames = [...filteredDetectedGames].sort((a, b) =>
                            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
                          )
                          return (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {sortedGames.map(renderGameCard)}
                            </div>
                          )
                        }

                        const groupedMap = new Map<
                          string,
                          { label: string; isPc: boolean; items: DetectedGameSaveItem[] }
                        >()
                        for (const g of filteredDetectedGames) {
                          const isEmu =
                            g.source === 'emuatlas' ||
                            g.source === 'emuvault' ||
                            Boolean(g.emulatorName)
                          const groupKey = isEmu
                            ? (g.emulatorName || tr('Emulators', 'Emuladores')).trim()
                            : '__PC_GAMES__'
                          const groupLabel = isEmu ? groupKey : tr('PC Games', 'Juegos de PC')
                          if (!groupedMap.has(groupKey)) {
                            groupedMap.set(groupKey, {
                              label: groupLabel,
                              isPc: !isEmu,
                              items: [],
                            })
                          }
                          groupedMap.get(groupKey)!.items.push(g)
                        }

                        const groups = Array.from(groupedMap.values()).sort((a, b) => {
                          if (a.isPc !== b.isPc) return a.isPc ? 1 : -1
                          return a.label.localeCompare(b.label)
                        })

                        return groups.map((group) => (
                          <section key={group.label} className="space-y-3.5">
                            {/* Encabezado limpio por emulador/categoría (igual que por servicio en el panel) */}
                            <div className="flex items-center gap-3 px-1">
                              <div className="flex items-center gap-2.5 flex-shrink-0">
                                <div className="w-7 h-7 rounded-xl liquid-glass-sub flex items-center justify-center">
                                  {group.isPc ? (
                                    <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Gamepad2 className="w-3.5 h-3.5 text-indigo-400" />
                                  )}
                                </div>
                                <h3 className="text-sm font-extrabold liquid-text-primary tracking-tight">
                                  {group.label}
                                </h3>
                              </div>

                              <div
                                className={`flex-1 h-px ${
                                  theme === 'flat-red' ? 'bg-zinc-800' : 'bg-white/15'
                                }`}
                              />

                              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full liquid-glass-sub liquid-text-secondary flex-shrink-0">
                                {group.items.length} {tr('game(s)', 'juego(s)')}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {group.items.map(renderGameCard)}
                            </div>
                          </section>
                        ))
                      })()}
                    </div>
                  )}
                </div>

                {/* Footer Paso 1 */}
                <div className="px-7 py-4 border-t border-white/15 flex items-center justify-between gap-4">
                  <span className="text-xs liquid-text-muted">
                    {tr('Select the games whose saves you want to back up and press ', 'Selecciona los videojuegos cuyos saves quieras respaldar y presiona ')}
                    <strong>{tr('Continue', 'Continuar')}</strong>.
                  </span>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsGameScannerOpen(false)}
                      className="px-4 py-2.5 rounded-2xl liquid-glass-sub liquid-text-secondary text-xs font-bold hover:opacity-90 transition"
                    >
                      {tr('Cancel', 'Cancelar')}
                    </button>

                    <button
                      type="button"
                      disabled={selectedGameIds.length === 0 || scanningGames}
                      onClick={() => setGameScannerStep('configure')}
                      className={`px-6 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition shadow-lg disabled:opacity-40 ${
                        theme === 'flat-red'
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-white'
                      }`}
                    >
                      <span>{tr('Continue', 'Continuar')} ({selectedGameIds.length})</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* ==================== PASO 2: LISTA DE JUEGOS SELECCIONADOS PARA SINCRONIZAR UNO POR UNO ==================== */
              <>
                {/* Barra de progreso en vivo cuando se está sincronizando un juego en la lista */}
                {(syncingGameId || progress) && (
                  <div className="bg-indigo-600/20 backdrop-blur-xl border-b border-indigo-400/30 px-7 py-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <Loader2 className="w-4 h-4 animate-spin text-sky-400 flex-shrink-0" />
                          <span className="font-bold liquid-text-primary truncate">
                            {progress
                              ? `${progress.syncName}: ${progress.phase}`
                              : 'Subiendo archivos de guardado a SyncSeinen_games_saves...'}
                          </span>
                        </div>
                        <span className="text-sky-400 font-mono font-bold">
                          {progress ? `${progress.current}%` : '0%'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-200"
                          style={{
                            width: `${progress ? Math.min(100, Math.max(8, progress.current)) : 12}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-7 overflow-y-auto flex-1 space-y-3 min-h-[340px]">
                  <p className="text-xs liquid-text-secondary mb-2">
                    {tr('Choose the cloud service in each row dropdown and press ', 'Elige el servicio en el menú desplegable de cada fila y presiona ')}
                    <strong>{tr('Finish & sync', 'Finalizar y sincronizar')} ({selectedGameObjects.length})</strong>{' '}
                    {tr('below to start backing up your saves in ', 'abajo para comenzar a respaldar tus partidas en ')}
                    <code className="text-sky-400 font-mono font-bold">/SyncSeinen_games_saves/&lt;{tr('Game', 'Juego')}&gt;</code>.
                  </p>

                  {selectedGameObjects.map((game) => {
                    const selectedProv =
                      gameProviderChoices[game.id] && connectedServices[gameProviderChoices[game.id]]
                        ? gameProviderChoices[game.id]
                        : activeProviders[0] || 'gdrive'
                    const isThisSyncing = syncingGameId === game.id
                    const syncedProv = syncedGameIds[game.id]

                    return (
                      <div
                        key={game.id}
                        className={`rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border transition ${
                          isThisSyncing
                            ? 'liquid-glass-sub border-sky-400/70 shadow-lg shadow-sky-500/10'
                            : syncedProv
                              ? theme === 'flat-red'
                                ? 'bg-[#18181c] border-red-500/80'
                                : 'liquid-glass-sub border-emerald-400/50'
                              : 'liquid-glass-sub border-white/10'
                        }`}
                      >
                        {/* Izquierda: Carátula + Nombre + Ruta destino */}
                        <div className="flex items-center gap-3.5 min-w-[240px] flex-1">
                          <div className="w-20 h-14 rounded-xl overflow-hidden liquid-glass flex-shrink-0 border border-white/15">
                            {game.thumbUrl || game.coverUrl ? (
                              <img
                                src={game.thumbUrl || game.coverUrl || ''}
                                alt={game.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-sky-400/70">
                                <Gamepad2 className="w-5 h-5" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-extrabold liquid-text-primary truncate">
                                {game.name}
                              </h4>
                              {(game.source === 'emuatlas' ||
                                game.source === 'emuvault' ||
                                Boolean(game.emulatorName)) && (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/40">
                                  {game.emulatorName || 'Emulador'}
                                  {game.systemName ? ` • ${game.systemName}` : ''}
                                </span>
                              )}
                              {isThisSyncing && (
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/40 flex items-center gap-1">
                                  <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                                  {tr('Syncing...', 'Sincronizando...')}
                                </span>
                              )}
                              {!isThisSyncing && syncedProv && (
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  {tr(`Synced to ${PROVIDER_META[syncedProv].label}`, `Sincronizado en ${PROVIDER_META[syncedProv].label}`)}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-sky-400 font-mono truncate mt-0.5">
                              /SyncSeinen_games_saves/{game.name}
                            </p>
                            <p className="text-[11px] liquid-text-muted font-mono truncate">
                              {game.localPath}
                            </p>
                          </div>
                        </div>

                        {/* Derecha: Solamente el menú desplegable de Servicio */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <select
                            disabled={Boolean(syncingGameId) || busyAction === 'game-sync-batch'}
                            value={selectedProv}
                            onChange={(e) => {
                              const nextProv = e.target.value as CloudProvider
                              setGameProviderChoices((prev) => ({
                                ...prev,
                                [game.id]: nextProv,
                              }))
                            }}
                            className={`rounded-xl px-3.5 py-2.5 text-xs font-bold border focus:outline-none cursor-pointer ${
                              theme === 'flat-red'
                                ? 'bg-[#18181c] border-zinc-700 text-white'
                                : 'liquid-glass text-white border-white/20 bg-slate-900/90'
                            }`}
                          >
                            {activeProviders.map((prov) => (
                              <option
                                key={prov}
                                value={prov}
                                className="bg-slate-900 text-white"
                              >
                                {PROVIDER_META[prov].label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Footer Paso 2 */}
                <div className="px-7 py-4 border-t border-white/15 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    disabled={Boolean(syncingGameId) || busyAction === 'game-sync-batch'}
                    onClick={() => setGameScannerStep('select')}
                    className="px-4 py-2.5 rounded-2xl liquid-glass-sub liquid-text-primary text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition disabled:opacity-40"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {tr('Pick more games', 'Elegir más juegos')}
                  </button>

                  <button
                    type="button"
                    disabled={
                      Boolean(syncingGameId) ||
                      busyAction === 'game-sync-batch' ||
                      selectedGameObjects.length === 0
                    }
                    onClick={handleSyncAllSelectedGames}
                    className={`px-6 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition shadow-lg disabled:opacity-40 ${
                      theme === 'flat-red'
                        ? 'bg-red-600 hover:bg-red-500 text-white'
                        : 'bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 hover:from-indigo-400 hover:to-emerald-400 text-white'
                    }`}
                  >
                    {Boolean(syncingGameId) || busyAction === 'game-sync-batch' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{tr('Syncing selected games...', 'Sincronizando juegos seleccionados...')}</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpFromLine className="w-4 h-4" />
                        <span>{tr('Finish & sync', 'Finalizar y sincronizar')} ({selectedGameObjects.length})</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
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
              {tr('Close', 'Cerrar')}
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
                {tr('Connect your cloud services', 'Conecta tus servicios en la nube')}
              </h2>
              <p className="text-sm liquid-text-secondary mt-2 leading-relaxed">
                {tr('Sign in with ', 'Inicia sesión con ')}
                <strong>Google Drive</strong>, <strong>Dropbox</strong> {tr('or', 'o')}{' '}
                <strong>OneDrive</strong>.{' '}
                {tr('Each service you sign in to will be marked as ', 'Cada servicio en el que inicies sesión se marcará como ')}
                <span className="text-emerald-400 font-semibold">{tr('Signed in', 'Sesión iniciada')}</span>{' '}
                {tr('so you can link multiple accounts before continuing to your syncs.', 'para que puedas vincular varios a la vez antes de pasar a la vista de sincronizaciones.')}
              </p>
            </div>

            {renderOnboardingServiceCards()}

            {/* Botón para ir a la vista de sincronizaciones */}
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
                <span>{tr('Go to syncs', 'Ir a la vista de sincronizaciones')}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <span className="text-xs liquid-text-muted">
                {isAuthenticated
                  ? tr(
                      `You have ${activeProviders.length} linked service(s). You can also add more later from the settings gear.`,
                      `Tienes ${activeProviders.length} servicio(s) vinculado(s). También podrás agregar más después desde el engrane de configuración.`
                    )
                  : tr(
                      'Link at least one service above to access your syncs.',
                      'Vincula al menos un servicio arriba para habilitar el acceso a tus sincronizaciones.'
                    )}
              </span>
            </div>
          </div>
        ) : (
          /* Vista de Sincronizaciones Dividida en 2: Archivos Normales y Saves de Juegos */
          <div className="space-y-8">
            {/* Barra Superior General */}
            <div className="liquid-glass rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-extrabold liquid-text-primary flex items-center gap-2.5">
                  {activeSection === 'games' ? (
                    <>
                      <Gamepad2 className="w-5 h-5 text-emerald-400" />
                      <span>{tr('Game Saves by Service', 'Saves de Videojuegos por Servicio')}</span>
                    </>
                  ) : (
                    <span>{tr('Regular Files by Service', 'Archivos Normales por Servicio')}</span>
                  )}
                  <span className="text-xs px-3 py-0.5 rounded-full liquid-glass-sub liquid-text-secondary font-semibold">
                    {activeProviders.length} {tr('active service(s)', 'servicio(s) activo(s)')} &bull; {sectionMetadatas.length} {tr('sync(s)', 'sync(s)')}
                  </span>
                </h2>
                <p className="text-xs liquid-text-muted mt-1">
                  {activeSection === 'games' ? (
                    <>
                      {tr('Automatic backup of PC, emulator and port saves in ', 'Respaldo automático de partidas de PC, emuladores y ports en ')}
                      <code className="text-sky-400 font-mono">SyncSeinen_games_saves</code>{' '}
                      {tr('with SteamGridDB covers.', 'con carátulas de SteamGridDB.')}
                    </>
                  ) : (
                    <>
                      {tr('Each service has its own Pull and Push buttons. You can add more accounts from the gear menu.', 'Cada servicio tiene sus propios botones de Pull y Push. Puedes agregar más cuentas desde el botón de engrane.')}
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* View Mode Toggle: Grid vs List */}
                <div className="flex items-center liquid-glass-sub rounded-2xl p-1">
                  <button
                    type="button"
                    onClick={() => handleChangeViewMode('grid')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                      viewMode === 'grid'
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md'
                        : 'liquid-text-muted hover:liquid-text-primary'
                    }`}
                    title={tr('Card grid view', 'Vista en cuadrícula de cartas')}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    {tr('Cards', 'Cartas')}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeViewMode('list')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition ${
                      viewMode === 'list'
                        ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-white shadow-md'
                        : 'liquid-text-muted hover:liquid-text-primary'
                    }`}
                    title={tr('List row view', 'Vista en filas')}
                  >
                    <List className="w-3.5 h-3.5" />
                    {tr('Rows', 'Filas')}
                  </button>
                </div>

                <button
                  onClick={() => refreshMetadatas()}
                  disabled={loadingSyncs || Boolean(busyAction)}
                  className="px-3.5 py-2.5 rounded-2xl liquid-glass-sub hover:opacity-90 disabled:opacity-50 liquid-text-primary text-xs font-semibold flex items-center gap-1.5 transition"
                  title={tr('Reload metadata from all connected services', 'Volver a leer metadatas de todos los servicios conectados')}
                >
                  <RefreshCw className={`w-4 h-4 ${loadingSyncs ? 'animate-spin text-sky-400' : ''}`} />
                  {tr('Refresh all', 'Actualizar todo')}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setActiveSection((prev) => (prev === 'files' ? 'games' : 'files'))
                  }
                  className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 border transition shadow-md ${
                    activeSection === 'games'
                      ? theme === 'flat-red'
                        ? 'bg-[#18181c] border-red-500 text-red-400 hover:bg-red-600 hover:text-white'
                        : 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 hover:bg-emerald-500/30'
                      : theme === 'flat-red'
                        ? 'bg-[#18181c] border-zinc-700 text-white hover:border-red-500'
                        : 'liquid-glass-sub border-sky-400/40 text-sky-300 hover:bg-white/10'
                  }`}
                  title={
                    activeSection === 'files'
                      ? tr('Go to Game Saves section', 'Ir al apartado de Saves de Videojuegos')
                      : tr('Back to Regular Files section', 'Volver al apartado de Archivos Normales')
                  }
                >
                  {activeSection === 'files' ? (
                    <>
                      <Gamepad2 className="w-4 h-4 text-emerald-400" />
                      <span>{tr('Game Saves', 'Saves de Juegos')}</span>
                    </>
                  ) : (
                    <>
                      <FolderSync className="w-4 h-4 text-sky-400" />
                      <span>{tr('Regular Files', 'Archivos Normales')}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleOpenCreateModal()}
                  disabled={Boolean(busyAction)}
                  className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 hover:from-indigo-400 hover:via-sky-400 hover:to-emerald-400 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-500/25 transition"
                >
                  <Plus className="w-4 h-4" />
                  {tr('New Sync', 'Nueva Sincronización')}
                </button>
              </div>
            </div>

            {activeSection === 'games' && sectionMetadatas.length === 0 ? (
              /* Pantalla vacía de Saves de Videojuegos: al pulsar donde deberían ir las sincronizaciones se abre el menú estilo pausa de escaneo */
              <div
                onClick={() => !busyAction && handleOpenGameScanner()}
                className={`rounded-3xl p-14 text-center cursor-pointer border-2 border-dashed transition group flex flex-col items-center justify-center gap-4 min-h-[360px] ${
                  theme === 'flat-red'
                    ? 'bg-[#121215]/90 border-red-500/50 hover:border-red-500 hover:bg-[#18181c]'
                    : 'liquid-glass border-emerald-400/40 hover:border-emerald-400/80 hover:bg-white/5'
                }`}
                title="Haz clic aquí para escanear los saves de videojuegos instalados en tu PC"
              >
                <div
                  className={`w-20 h-20 rounded-3xl flex items-center justify-center transition group-hover:scale-110 ${
                    theme === 'flat-red'
                      ? 'bg-red-600/20 border border-red-500 text-red-400'
                      : 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 shadow-lg shadow-emerald-500/15'
                  }`}
                >
                  <Gamepad2 className="w-10 h-10" />
                </div>

                <div className="max-w-lg space-y-2">
                  <h3 className="text-xl font-black liquid-text-primary">
                    {tr('Click here to scan for Game & Emulator Saves on your PC', 'Haz clic aquí para buscar Saves de Videojuegos y Emuladores en tu PC')}
                  </h3>
                  <p className="text-xs liquid-text-secondary leading-relaxed">
                    {tr(
                      'Clicking here opens automatic save detection for PC games, emulators, and ports with covers from ',
                      'Al pulsar en esta área se abrirá el menú de detección automática de partidas guardadas en videojuegos de PC, emuladores y ports/recompilaciones con carátulas de '
                    )}
                    <strong>SteamGridDB</strong>{' '}
                    {tr('so you can select and sync your saves.', 'para que selecciones y sincronices tus saves.')}
                  </p>
                </div>

                <span
                  className={`mt-1 px-5 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 shadow-lg transition ${
                    theme === 'flat-red'
                      ? 'bg-red-600 group-hover:bg-red-500 text-white'
                      : 'bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{tr('Scan Game & Emulator Saves', 'Escanear Saves de Videojuegos y Emuladores')}</span>
                </span>
              </div>
            ) : (
              <>
                {activeSection === 'games' && (
                  <div
                    onClick={() => !busyAction && handleOpenGameScanner()}
                    className={`rounded-2xl px-5 py-3.5 cursor-pointer border border-dashed flex flex-wrap items-center justify-between gap-3 transition ${
                      theme === 'flat-red'
                        ? 'bg-[#141418] border-red-500/50 hover:border-red-500'
                        : 'liquid-glass-sub border-emerald-400/40 hover:border-emerald-400'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Gamepad2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <span className="text-xs font-bold liquid-text-primary">
                        {tr(
                          'Have more games, emulators, or ports installed? Click here to scan saves automatically.',
                          '¿Tienes más videojuegos, emuladores o ports instalados? Haz clic aquí para escanear saves automáticamente.'
                        )}
                      </span>
                    </div>
                    <span className="text-xs font-extrabold text-emerald-400 underline">
                      {tr('Open save scanner', 'Abrir escáner de saves')}
                    </span>
                  </div>
                )}

                {/* Secciones Divididas por Cada Servicio Conectado */}
                {activeProviders.map((provider) => {
                  const pInfo = PROVIDER_META[provider]
                  const isSyncPendingPull = (sync: SyncMetadata): boolean => {
                    const currentDev = (config?.deviceName || '').trim()
                    const lastDev = (sync.lastPushedByDevice || sync.createdByDevice || '').trim()
                    if (!currentDev || !lastDev || currentDev === lastDev) return false
                    const localMapping = config?.localMappings[sync.id]
                    if (localMapping?.lastPulledAt && sync.lastPushedAt) {
                      const pulledMs = Date.parse(localMapping.lastPulledAt)
                      const pushedMs = Date.parse(sync.lastPushedAt)
                      if (!Number.isNaN(pulledMs) && !Number.isNaN(pushedMs) && pulledMs >= pushedMs) {
                        return false
                      }
                    }
                    return true
                  }
                  const serviceMetas = sectionMetadatas
                    .filter((m) => (m.provider || 'gdrive') === provider)
                    .sort((a, b) => {
                      const aPending = isSyncPendingPull(a) ? 1 : 0
                      const bPending = isSyncPendingPull(b) ? 1 : 0
                      return bPending - aPending
                    })
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
                            {tr(`Checking syncs in ${pInfo.label}...`, `Consultando sincronizaciones en ${pInfo.label}...`)}
                          </p>
                        </div>
                      ) : serviceMetas.length === 0 ? (
                        activeSection === 'games' ? (
                          <div
                            onClick={() => !busyAction && handleOpenGameScanner()}
                            className="liquid-glass rounded-3xl p-6 text-center cursor-pointer border border-dashed border-emerald-400/35 hover:border-emerald-400 transition"
                          >
                            <p className="text-xs liquid-text-secondary">
                              {tr('No game saves synced in ', 'No hay saves de videojuegos sincronizados en ')}
                              <strong>{pInfo.label}</strong>.{' '}
                              <span className="text-emerald-400 font-bold underline">
                                {tr('Click here to scan your installed games', 'Haz clic aquí para escanear tus juegos instalados')}
                              </span>
                              .
                            </p>
                          </div>
                        ) : (
                          <div className="liquid-glass rounded-3xl p-6 text-center">
                            <p className="text-xs liquid-text-muted">
                              {tr('No syncs registered in ', 'No hay sincronizaciones registradas en ')}
                              <strong>{pInfo.label}</strong>.{' '}
                              {tr('Use the top button ', 'Usa el botón superior ')}
                              <strong>+ {tr('New Sync', 'Nueva Sincronización')}</strong>{' '}
                              {tr('to add one.', 'para agregar una.')}
                            </p>
                          </div>
                        )
                      ) : viewMode === 'grid' ? (
                        /* VISTA EN CUADRÍCULA DE CARTAS (GRID VIEW) */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {serviceMetas.map((sync) => {
                            const localMapping = config?.localMappings[sync.id]
                            const isLinked = Boolean(localMapping?.localPath)
                            const isGame = Boolean(sync.isGameSave) || activeSection === 'games'
                            const isPendingPull = isSyncPendingPull(sync)
                            const autoMatch = !isLinked ? autoSaveMatches[sync.id] : undefined
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
                                className={`liquid-glass-card rounded-3xl overflow-hidden flex flex-col justify-between group ${
                                  isPendingPull
                                    ? theme === 'flat-red'
                                      ? 'ring-2 ring-red-500/80'
                                      : 'ring-2 ring-sky-400/70 shadow-lg shadow-sky-500/15'
                                    : ''
                                }`}
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
                                        {isGame ? (
                                          <Gamepad2 className="w-10 h-10 stroke-[1.5]" />
                                        ) : (
                                          <FolderSync className="w-10 h-10 stroke-[1.5]" />
                                        )}
                                        <span className="text-xs font-medium liquid-text-muted">
                                          {tr('No cover', 'Sin carátula')}
                                        </span>
                                      </div>
                                    )}

                                    {/* Top Floating Badges on Cover */}
                                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {isPendingPull && (
                                          <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-sky-500/90 text-white border border-sky-300/60 flex items-center gap-1 shadow">
                                            <ArrowDownToLine className="w-3 h-3" />
                                            {tr('Pending Pull', 'Pendiente de Pull')}
                                          </span>
                                        )}
                                        {isLinked ? (
                                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-emerald-300 border border-emerald-400/40 flex items-center gap-1 shadow">
                                            <Link2 className="w-3 h-3" />
                                            {tr('Linked', 'Vinculada')}
                                          </span>
                                        ) : (
                                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/55 backdrop-blur-md text-amber-300 border border-amber-400/40 shadow">
                                            {tr('Not linked on PC', 'Sin vincular en PC')}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                                        <button
                                          type="button"
                                          disabled={Boolean(busyAction)}
                                          onClick={() => handleChangeCoverForSync(sync)}
                                          className="px-2.5 py-1 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1 border border-white/20 transition"
                                          title={tr('Change cover image', 'Cambiar imagen de carátula')}
                                        >
                                          <ImagePlus className="w-3 h-3 text-sky-300" />
                                          {sync.coverImage ? tr('Change', 'Cambiar') : tr('Cover', 'Carátula')}
                                        </button>
                                        {sync.coverImage && (
                                          <button
                                            type="button"
                                            disabled={Boolean(busyAction)}
                                            onClick={() => handleRemoveCoverForSync(sync)}
                                            className="p-1 rounded-full bg-black/65 hover:bg-rose-600/80 backdrop-blur-md text-white border border-white/20 transition"
                                            title={tr('Remove cover', 'Quitar carátula')}
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
                                          {tr('Last Push', 'Último Push')}
                                        </span>
                                        <span className="text-emerald-400 font-bold flex items-center gap-1 mt-0.5 truncate">
                                          <Laptop className="w-3 h-3 flex-shrink-0" />
                                          {sync.lastPushedByDevice || sync.createdByDevice || 'N/A'}
                                        </span>
                                      </div>

                                      <div className="liquid-glass-sub rounded-2xl p-2.5">
                                        <span className="liquid-text-muted block text-[10px]">
                                          {tr('Files / Date', 'Archivos / Fecha')}
                                        </span>
                                        <span className="liquid-text-primary font-semibold block mt-0.5 truncate">
                                          {sync.lastPushedFileCount} {tr('files', 'arch.')} &bull;{' '}
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
                                            {tr('Ignore', 'Ignorar')} ({effectiveIgnored.length})
                                          </button>
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() =>
                                                window.syncApi.openLocalPath(localMapping!.localPath)
                                              }
                                              className="px-2 py-1 rounded-lg liquid-glass liquid-text-secondary text-[11px] hover:opacity-90"
                                              title={tr('Open folder', 'Abrir carpeta')}
                                            >
                                              {tr('Open', 'Abrir')}
                                            </button>
                                            <button
                                              onClick={() => handleAssignLocalFolderAndPull(sync, false)}
                                              disabled={Boolean(busyAction)}
                                              className="px-2 py-1 rounded-lg liquid-glass liquid-text-secondary text-[11px] hover:opacity-90"
                                            >
                                              {tr('Path', 'Ruta')}
                                            </button>
                                            <button
                                              onClick={() => handleUnlinkLocal(sync)}
                                              disabled={Boolean(busyAction)}
                                              className="p-1 rounded-lg liquid-glass text-rose-400 hover:opacity-90"
                                              title={tr('Unlink from this PC', 'Desvincular de esta PC')}
                                            >
                                              <Link2Off className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : autoMatch ? (
                                      <div className="liquid-glass-sub rounded-2xl p-3 space-y-2 border border-emerald-400/35">
                                        <div className="flex items-center justify-between gap-1.5">
                                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                            <Sparkles className="w-3 h-3" />
                                            {tr('Path detected on this PC:', 'Ruta detectada en esta PC:')}
                                          </span>
                                          {autoMatch.emulatorName && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                                              {autoMatch.emulatorName}
                                            </span>
                                          )}
                                        </div>
                                        <code
                                          className="block text-[10px] liquid-text-secondary font-mono truncate bg-black/25 px-2 py-1 rounded-lg"
                                          title={autoMatch.localPath}
                                        >
                                          {autoMatch.localPath}
                                        </code>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleAutoPullWithDetectedPath(sync, autoMatch)}
                                            disabled={Boolean(busyAction)}
                                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1 transition shadow"
                                          >
                                            {busyAction === `assign-${sync.id}` ? (
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                              <ArrowDownToLine className="w-3.5 h-3.5" />
                                            )}
                                            {tr('Auto sync', 'Sincronizar automático')}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleAssignLocalFolderAndPull(sync, true)}
                                            disabled={Boolean(busyAction)}
                                            title={tr('Pick path manually', 'Elegir ruta manualmente')}
                                            className="px-2 py-1.5 rounded-xl liquid-glass hover:bg-white/10 liquid-text-secondary text-[11px] font-semibold flex items-center gap-1 transition"
                                          >
                                            <FolderOpen className="w-3 h-3" />
                                            Manual
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="liquid-glass-sub rounded-2xl p-3 space-y-2 border-amber-400/30">
                                        <p className="text-[11px] liquid-text-secondary flex items-center gap-1.5">
                                          {scanningAutoPaths && isGame ? (
                                            <>
                                              <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                                              <span>{tr('Searching path on this PC...', 'Buscando ruta en esta PC...')}</span>
                                            </>
                                          ) : (
                                            <span>{tr('Enter or select the path on this PC:', 'Ingresa o selecciona la ruta en esta PC:')}</span>
                                          )}
                                        </p>
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="text"
                                            value={manualPathInputs[sync.id] || ''}
                                            onChange={(e) =>
                                              setManualPathInputs((prev) => ({
                                                ...prev,
                                                [sync.id]: e.target.value,
                                              }))
                                            }
                                            placeholder="C:\path\to\save..."
                                            className="flex-1 min-w-0 liquid-glass rounded-lg px-2 py-1 text-[11px] font-mono liquid-text-primary focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleBrowseManualPath(sync)}
                                            disabled={Boolean(busyAction)}
                                            title={tr('Select folder from your computer', 'Seleccionar carpeta desde tu computadora')}
                                            className="p-1.5 rounded-lg liquid-glass hover:bg-white/10 text-sky-400 transition"
                                          >
                                            <FolderOpen className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleLinkManualPathAndPull(sync, true)}
                                            disabled={Boolean(busyAction)}
                                            className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1 transition"
                                          >
                                            <ArrowDownToLine className="w-3.5 h-3.5" />
                                            {tr('Link & Pull', 'Vincular y Pull')}
                                          </button>
                                          {!isGame && (
                                            <button
                                              onClick={() => setEditingIgnoreSync(sync)}
                                              disabled={Boolean(busyAction)}
                                              className="p-1.5 rounded-xl liquid-glass text-amber-400"
                                              title="Ignorar archivos"
                                            >
                                              <EyeOff className="w-4 h-4" />
                                            </button>
                                          )}
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
                            const isGame = Boolean(sync.isGameSave) || activeSection === 'games'
                            const isPendingPull = isSyncPendingPull(sync)
                            const autoMatch = !isLinked ? autoSaveMatches[sync.id] : undefined
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
                                className={`liquid-glass-card rounded-3xl p-5 ${
                                  isPendingPull
                                    ? theme === 'flat-red'
                                      ? 'ring-2 ring-red-500/80'
                                      : 'ring-2 ring-sky-400/70 shadow-lg shadow-sky-500/15'
                                    : ''
                                }`}
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
                                        {isGame ? (
                                          <Gamepad2 className="w-6 h-6" />
                                        ) : (
                                          <ImagePlus className="w-6 h-6" />
                                        )}
                                        <span className="text-[10px] font-medium liquid-text-muted">
                                          {tr('Cover', 'Carátula')}
                                        </span>
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                      <span className="text-[10px] font-bold text-white px-2 py-1 rounded-lg bg-black/60">
                                        {tr('Change', 'Cambiar')}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="space-y-2 flex-1 min-w-[260px]">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                      <h3 className="text-base font-extrabold liquid-text-primary">
                                        {sync.name}
                                      </h3>
                                      {isPendingPull && (
                                        <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/50 flex items-center gap-1">
                                          <ArrowDownToLine className="w-3 h-3" />
                                          {tr('Pending Pull', 'Pendiente de Pull')}
                                        </span>
                                      )}
                                      {isLinked ? (
                                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-400/30 flex items-center gap-1">
                                          <Link2 className="w-3 h-3" />
                                          {tr('Linked on this device', 'Vinculada en este dispositivo')}
                                        </span>
                                      ) : (
                                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-400/30">
                                          {tr(`Available on ${pInfo.label} • No local path assigned`, `Disponible en ${pInfo.label} • Sin ruta local asignada`)}
                                        </span>
                                      )}
                                      {!isGame && effectiveIgnored.length > 0 && (
                                        <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-400/30 flex items-center gap-1">
                                          <EyeOff className="w-3 h-3" />
                                          {effectiveIgnored.length} {tr('ignored', 'ignorado(s)')}
                                        </span>
                                      )}
                                    </div>

                                    {/* Metadata info badges */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                                      <div className="liquid-glass-sub rounded-2xl p-2.5">
                                        <span className="liquid-text-muted block text-[11px]">
                                          {tr(`Folder in ${pInfo.label}`, `Carpeta en ${pInfo.label}`)}
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
                                          {tr('Last push device', 'Último dispositivo que subió (Push)')}
                                        </span>
                                        <span className="text-emerald-400 font-bold flex items-center gap-1.5 mt-0.5 truncate">
                                          <Laptop className="w-3.5 h-3.5 flex-shrink-0" />
                                          {sync.lastPushedByDevice || sync.createdByDevice || 'N/A'}
                                        </span>
                                      </div>

                                      <div className="liquid-glass-sub rounded-2xl p-2.5">
                                        <span className="liquid-text-muted block text-[11px]">
                                          {tr('Last upload / Files', 'Última subida / Archivos')}
                                        </span>
                                        <span className="liquid-text-primary font-semibold block mt-0.5 truncate">
                                          {formatDate(sync.lastPushedAt)} ({sync.lastPushedFileCount}{' '}
                                          {tr('files', 'arch.')})
                                        </span>
                                      </div>
                                    </div>

                                    {/* Local folder section */}
                                    {isLinked ? (
                                      <div className="mt-3 p-3 rounded-2xl liquid-glass-sub flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 text-xs min-w-0 flex-1">
                                          <HardDrive className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                          <span className="liquid-text-muted flex-shrink-0">
                                            {tr('Path on this PC:', 'Ruta en esta PC:')}
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
                                            {tr('Ignore files', 'Ignorar archivos')} ({effectiveIgnored.length})
                                          </button>
                                          <button
                                            onClick={() =>
                                              window.syncApi.openLocalPath(localMapping!.localPath)
                                            }
                                            className="px-2.5 py-1 rounded-xl liquid-glass liquid-text-secondary text-xs flex items-center gap-1 transition hover:opacity-90"
                                          >
                                            <FolderOpen className="w-3.5 h-3.5" />
                                            {tr('Open', 'Abrir')}
                                          </button>
                                          <button
                                            onClick={() => handleAssignLocalFolderAndPull(sync, false)}
                                            disabled={Boolean(busyAction)}
                                            className="px-2.5 py-1 rounded-xl liquid-glass liquid-text-secondary text-xs transition hover:opacity-90"
                                          >
                                            {tr('Change path', 'Cambiar ruta')}
                                          </button>
                                          <button
                                            onClick={() => handleUnlinkLocal(sync)}
                                            disabled={Boolean(busyAction)}
                                            className="p-1 rounded-xl liquid-glass text-rose-400 transition hover:opacity-90"
                                            title={tr('Unlink folder on this device', 'Desvincular carpeta en este dispositivo')}
                                          >
                                            <Link2Off className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ) : autoMatch ? (
                                      <div className="mt-3 p-3.5 rounded-2xl liquid-glass-sub border border-emerald-400/35 flex flex-wrap items-center justify-between gap-3">
                                        <div className="space-y-1 min-w-[220px] flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                              <Sparkles className="w-3.5 h-3.5" />
                                              {tr('Path automatically detected on this PC:', 'Ruta detectada automáticamente en esta PC:')}
                                            </span>
                                            {autoMatch.emulatorName && (
                                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/40">
                                                {autoMatch.emulatorName}
                                                {autoMatch.systemName ? ` • ${autoMatch.systemName}` : ''}
                                              </span>
                                            )}
                                          </div>
                                          <code className="block text-xs liquid-text-primary font-mono truncate">
                                            {autoMatch.localPath}
                                          </code>
                                        </div>

                                        <div className="flex items-center gap-2 flex-wrap">
                                          <button
                                            type="button"
                                            onClick={() => handleAutoPullWithDetectedPath(sync, autoMatch)}
                                            disabled={Boolean(busyAction)}
                                            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition shadow-md"
                                          >
                                            {busyAction === `assign-${sync.id}` ? (
                                              <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                              <ArrowDownToLine className="w-4 h-4" />
                                            )}
                                            {tr('Auto sync (Pull)', 'Sincronizar automático (Pull)')}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleAssignLocalFolderAndPull(sync, true)}
                                            disabled={Boolean(busyAction)}
                                            title={tr('Pick path manually', 'Elegir ruta manualmente')}
                                            className="px-2.5 py-2 rounded-xl liquid-glass hover:bg-white/10 liquid-text-secondary text-[11px] font-semibold flex items-center gap-1 transition"
                                          >
                                            <FolderOpen className="w-3.5 h-3.5" />
                                            Manual
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-3 p-3 rounded-2xl liquid-glass-sub border-amber-400/30 space-y-2.5">
                                        <p className="text-xs liquid-text-secondary flex items-center gap-2">
                                          {scanningAutoPaths && isGame ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
                                              <span>{tr('Automatically searching save path on this computer...', 'Buscando ruta de guardado automáticamente en esta computadora...')}</span>
                                            </>
                                          ) : (
                                            <span>
                                              {tr('Path not found automatically. Enter or select it from your computer to download files:', 'No se encontró la ruta automáticamente. Ingrésala o selecciónala desde tu computadora para descargar los archivos:')}
                                            </span>
                                          )}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2">
                                          <div className="flex items-center gap-1.5 flex-1 min-w-[220px]">
                                            <input
                                              type="text"
                                              value={manualPathInputs[sync.id] || ''}
                                              onChange={(e) =>
                                                setManualPathInputs((prev) => ({
                                                  ...prev,
                                                  [sync.id]: e.target.value,
                                                }))
                                              }
                                              placeholder={tr('Enter or select path on this computer...', 'Ingresa o selecciona la ruta en esta computadora...')}
                                              className="flex-1 min-w-0 liquid-glass rounded-xl px-3 py-2 text-xs font-mono liquid-text-primary focus:outline-none"
                                            />
                                            <button
                                              type="button"
                                              onClick={() => handleBrowseManualPath(sync)}
                                              disabled={Boolean(busyAction)}
                                              className="px-3 py-2 rounded-xl liquid-glass hover:bg-white/10 text-sky-400 text-xs font-semibold flex items-center gap-1.5 transition"
                                              title={tr('Select folder from your computer', 'Seleccionar carpeta desde tu computadora')}
                                            >
                                              <FolderOpen className="w-3.5 h-3.5" />
                                              {tr('Browse', 'Examinar')}
                                            </button>
                                          </div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                              onClick={() => setEditingIgnoreSync(sync)}
                                              disabled={Boolean(busyAction)}
                                              className="px-3 py-2 rounded-xl liquid-glass text-amber-400 text-xs font-semibold flex items-center gap-1.5 transition"
                                            >
                                              <EyeOff className="w-3.5 h-3.5" />
                                              {tr('Ignore', 'Ignorar')} ({effectiveIgnored.length})
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleLinkManualPathAndPull(sync, true)}
                                              disabled={Boolean(busyAction)}
                                              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition shadow-md"
                                            >
                                              <ArrowDownToLine className="w-4 h-4" />
                                              {tr('Link & Pull', 'Vincular y Hacer Pull')}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleLinkManualPathAndPull(sync, false)}
                                              disabled={Boolean(busyAction)}
                                              className="px-3 py-2 rounded-xl liquid-glass liquid-text-primary text-xs font-semibold transition"
                                            >
                                              {tr('Assign path only', 'Solo asignar ruta')}
                                            </button>
                                          </div>
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
              </>
            )}
          </div>
        )}
      </main>

      <CreateSyncModal
        isOpen={isCreateModalOpen}
        initialProvider={createModalProvider}
        defaultIsGameSave={false}
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
