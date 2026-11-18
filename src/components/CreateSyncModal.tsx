import React, { useEffect, useState } from 'react'
import {
  CheckCircle2,
  Cloud,
  EyeOff,
  FolderOpen,
  FolderPlus,
  Gamepad2,
  HardDrive,
  ImagePlus,
  Loader2,
  PlusCircle,
  Trash2,
  X,
} from 'lucide-react'
import { DriveFolderModal } from './DriveFolderModal'
import { IgnoreFilesModal } from './IgnoreFilesModal'
import { CoverPickerModal } from './CoverPickerModal'
import { useLang } from '../i18n'
import { CloudProvider, SyncProgressEvent } from '../types'

const PROVIDER_LABELS: Record<CloudProvider, string> = {
  gdrive: 'Google Drive',
  dropbox: 'Dropbox',
  onedrive: 'OneDrive',
}

interface CreateSyncModalProps {
  isOpen: boolean
  initialProvider?: CloudProvider
  defaultIsGameSave?: boolean
  connectedServices?: Record<CloudProvider, boolean>
  onClose: () => void
  progress: SyncProgressEvent | null
  isCreating: boolean
  onCreated: (params: {
    provider: CloudProvider
    name: string
    driveFolderPath: string
    driveFolderName: string
    localPath: string
    ignoredPaths?: string[]
    coverImage?: string | null
    isGameSave?: boolean
  }) => Promise<void>
}

export const CreateSyncModal: React.FC<CreateSyncModalProps> = ({
  isOpen,
  initialProvider = 'gdrive',
  defaultIsGameSave = false,
  connectedServices = { gdrive: true, dropbox: false, onedrive: false },
  onClose,
  progress,
  isCreating,
  onCreated,
}) => {
  const [, , tr] = useLang()
  const [provider, setProvider] = useState<CloudProvider>(initialProvider)
  const [name, setName] = useState('')
  const [driveFolder, setDriveFolder] = useState<{ path: string; name: string } | null>(null)
  const [localPath, setLocalPath] = useState('')
  const [ignoredPaths, setIgnoredPaths] = useState<string[]>([])
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [isGameSave, setIsGameSave] = useState<boolean>(defaultIsGameSave)
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false)
  const [isIgnoreModalOpen, setIsIgnoreModalOpen] = useState(false)
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false)
  const [creatingSubfolder, setCreatingSubfolder] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setProvider(initialProvider)
      setIsGameSave(defaultIsGameSave)
    }
  }, [isOpen, initialProvider, defaultIsGameSave])

  if (!isOpen) return null

  const providerLabel = PROVIDER_LABELS[provider] || 'Google Drive'
  const availableProviders = (['gdrive', 'dropbox', 'onedrive'] as CloudProvider[]).filter(
    (p) => connectedServices[p]
  )

  const localFolderName = localPath
    ? localPath.split(/[/\\]/).filter(Boolean).pop() || ''
    : ''

  const driveEndsWithLocalName = Boolean(
    localFolderName &&
      driveFolder &&
      (driveFolder.path.split('/').filter(Boolean).pop() || '').toLowerCase() ===
        localFolderName.toLowerCase()
  )

  const handlePickLocal = async () => {
    const picked = await window.syncApi.pickLocalFolder()
    if (picked) {
      setLocalPath(picked)
      setIgnoredPaths([])
      if (!name.trim()) {
        const parts = picked.split(/[/\\]/).filter(Boolean)
        if (parts.length > 0) {
          setName(parts[parts.length - 1])
        }
      }
    }
  }

  const handleCreateAutoSubfolderInDrive = async () => {
    if (!localFolderName) return
    setCreatingSubfolder(true)
    setError(null)
    try {
      const parentPath = driveFolder ? driveFolder.path : ''
      const created = await window.syncApi.createDriveFolder(localFolderName, parentPath, provider)
      setDriveFolder({
        path: created.path,
        name: created.name,
      })
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `No se pudo crear la carpeta "${localFolderName}" en ${providerLabel}`
      )
    } finally {
      setCreatingSubfolder(false)
    }
  }

  const handlePickCover = () => {
    setIsCoverPickerOpen(true)
  }

  const safeGameFolderName = (name.trim() || '')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .trim()
  const autoGameDrivePath = safeGameFolderName
    ? `SyncSeinen_games_saves/${safeGameFolderName}`
    : 'SyncSeinen_games_saves/<nombre>'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !localPath || (!isGameSave && !driveFolder)) {
      setError(
        isGameSave
          ? tr('Enter a name and select a local folder.', 'Completa el nombre y la carpeta de tu computadora.')
          : tr(
              `Enter a name, local folder, and ${providerLabel} folder.`,
              `Completa el nombre, la carpeta de tu computadora y la carpeta en ${providerLabel}.`
            )
      )
      return
    }
    const targetDrivePath = isGameSave
      ? `SyncSeinen_games_saves/${safeGameFolderName}`
      : driveFolder!.path
    const targetDriveName = isGameSave ? safeGameFolderName : driveFolder!.name

    setError(null)
    try {
      await onCreated({
        provider,
        name: name.trim(),
        driveFolderPath: targetDrivePath,
        driveFolderName: targetDriveName,
        localPath,
        ignoredPaths,
        coverImage,
        isGameSave,
      })
      setName('')
      setDriveFolder(null)
      setLocalPath('')
      setIgnoredPaths([])
      setCoverImage(null)
      setIsGameSave(defaultIsGameSave)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear la sincronización')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 backdrop-blur-md p-4">
        <div className="liquid-glass-modal rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/15">
            <div className="flex items-center gap-2.5">
              <PlusCircle className="w-5 h-5 text-sky-400" />
              <h3 className="text-lg font-bold liquid-text-primary">
                {tr(`Create New Sync (${providerLabel})`, `Crear Nueva Sincronización (${providerLabel})`)}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              title={
                isCreating
                  ? tr(
                      'Hide window (upload will continue in the background)',
                      'Ocultar ventana (la subida continuará en segundo plano con la barra normal)'
                    )
                  : tr('Close', 'Cerrar')
              }
              className="liquid-text-muted hover:liquid-text-primary p-1.5 rounded-xl hover:bg-white/10 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Barra de progreso en la parte superior del cuadro de selección de rutas */}
          {(isCreating || progress) && (
            <div className="bg-indigo-600/20 backdrop-blur-xl border-b border-indigo-400/30 px-6 py-3.5">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-400 flex-shrink-0" />
                    <span className="font-semibold liquid-text-primary truncate">
                      {progress ? `${progress.phase}` : tr('Starting file upload with rclone...', 'Iniciando subida de archivos con rclone...')}
                    </span>
                  </div>
                  <span className="text-sky-400 font-mono font-bold flex-shrink-0 ml-2">
                    {progress ? `${progress.current}%` : '0%'}
                  </span>
                </div>
                {progress?.detail && (
                  <div className="text-[11px] liquid-text-secondary font-mono truncate">
                    {progress.detail}
                  </div>
                )}
                <div className="w-full h-2 bg-black/30 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400 transition-all duration-200"
                    style={{
                      width: `${progress ? Math.min(100, Math.max(5, progress.current)) : 8}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] liquid-text-muted mt-0.5">
                  {tr(
                    'You can close this dialog with the X above and the upload will continue in the main bar.',
                    'Puedes cerrar este cuadro con la X de arriba y la subida continuará en la barra general.'
                  )}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {/* Selector de Servicio en la Nube */}
            {availableProviders.length > 1 && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider liquid-text-muted mb-1.5">
                  {tr('Target Cloud Service', 'Servicio en la Nube Destino')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['gdrive', 'dropbox', 'onedrive'] as CloudProvider[]).map((p) => {
                    const isConn = Boolean(connectedServices[p])
                    const isSelected = provider === p
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={!isConn || isCreating}
                        onClick={() => {
                          if (provider !== p) {
                            setProvider(p)
                            setDriveFolder(null)
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                          isSelected
                            ? 'bg-sky-500/25 border-sky-400 text-sky-300 shadow'
                            : isConn
                              ? 'liquid-glass-sub liquid-text-secondary hover:liquid-text-primary'
                              : 'opacity-40 cursor-not-allowed liquid-glass-sub liquid-text-muted'
                        }`}
                      >
                        <Cloud className="w-3.5 h-3.5" />
                        <span>{PROVIDER_LABELS[p]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Carátula / Cover Image Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider liquid-text-muted mb-2">
                {tr('Sync Cover Image', 'Carátula de la Sincronización')}
              </label>
              <div className="flex flex-col items-center justify-center gap-2.5">
                <div
                  onClick={() => !isCreating && handlePickCover()}
                  className="relative w-56 h-40 rounded-2xl overflow-hidden liquid-glass-sub flex items-center justify-center cursor-pointer group border border-dashed border-sky-400/40 flex-shrink-0"
                >
                  {coverImage ? (
                    <>
                      <img
                        src={coverImage}
                        alt="Carátula"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <ImagePlus className="w-8 h-8 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-sky-400/80 gap-2">
                      <ImagePlus className="w-8 h-8" />
                      <span className="text-xs font-semibold">{tr('Choose image', 'Elegir imagen')}</span>
                    </div>
                  )}
                </div>

                {coverImage && (
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => setCoverImage(null)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-medium flex items-center gap-1 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {tr('Remove', 'Quitar')}
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider liquid-text-muted mb-1.5">
                {tr('1. Sync Name', '1. Nombre de la Sincronización')}
              </label>
              <input
                type="text"
                disabled={isCreating}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={tr('e.g. Web Project, Save Games, Documents...', 'Ej. Programación Web, Partidas Guardadas, Proyectos...')}
                className="w-full liquid-glass-sub rounded-xl px-4 py-2.5 text-sm liquid-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider liquid-text-muted mb-1.5">
                {tr('2. Local Folder (This Computer)', '2. Carpeta en esta Computadora (Origen Local)')}
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={localPath}
                  placeholder={tr('Select a folder from your PC...', 'Selecciona una carpeta de tu PC...')}
                  className="flex-1 liquid-glass-sub rounded-xl px-4 py-2.5 text-sm liquid-text-primary placeholder-slate-400 font-mono"
                />
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handlePickLocal}
                  className="px-4 py-2.5 rounded-xl liquid-glass hover:opacity-90 disabled:opacity-50 liquid-text-primary text-sm font-semibold flex items-center gap-2 transition flex-shrink-0"
                >
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  {tr('Browse PC', 'Explorar PC')}
                </button>
              </div>

              {localPath && (
                <div className="mt-2.5 flex items-center justify-between liquid-glass-sub rounded-xl px-3.5 py-2">
                  <div className="text-xs liquid-text-secondary flex items-center gap-2 truncate">
                    <EyeOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span>
                      {ignoredPaths.length === 0
                        ? tr('No ignored files or paths', 'Sin archivos ni rutas ignoradas')
                        : tr(`${ignoredPaths.length} ignored path(s)/file(s)`, `${ignoredPaths.length} ruta(s)/archivo(s) ignorado(s)`)}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => setIsIgnoreModalOpen(true)}
                    className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-400 text-xs font-semibold transition flex-shrink-0"
                  >
                    {tr('Select files to ignore', 'Seleccionar qué ignorar')}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider liquid-text-muted mb-1.5">
                {tr(`3. Folder in ${providerLabel}`, `3. Carpeta en ${providerLabel}`)}
              </label>

              {isGameSave ? (
                <div className="liquid-glass-sub rounded-xl px-4 py-3 border border-emerald-400/30 flex items-center gap-3">
                  <Gamepad2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-mono text-emerald-300 truncate">
                      /{autoGameDrivePath}
                    </div>
                    <p className="text-xs liquid-text-muted mt-0.5">
                      {tr(
                        'Game saves are always stored automatically in SyncSeinen_games_saves using the sync name.',
                        'Los saves de videojuegos siempre se guardan automáticamente en SyncSeinen_games_saves con el nombre de la sincronización.'
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={driveFolder ? `/${driveFolder.path}` : ''}
                      placeholder={tr(`Select or create a folder in ${providerLabel}...`, `Selecciona o crea una carpeta en tu ${providerLabel}...`)}
                      className="flex-1 liquid-glass-sub rounded-xl px-4 py-2.5 text-sm liquid-text-primary placeholder-slate-400 font-mono"
                    />
                    <button
                      type="button"
                      disabled={isCreating || creatingSubfolder}
                      onClick={() => setIsDrivePickerOpen(true)}
                      className="px-4 py-2.5 rounded-xl liquid-glass hover:opacity-90 disabled:opacity-50 liquid-text-primary text-sm font-semibold flex items-center gap-2 transition flex-shrink-0"
                    >
                      <Cloud className="w-4 h-4 text-sky-400" />
                      {tr(`Choose in ${providerLabel}`, `Elegir en ${providerLabel}`)}
                    </button>
                  </div>

                  {localFolderName && (
                    <div className="mt-2.5 liquid-glass-sub rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border border-emerald-400/25">
                      {driveEndsWithLocalName ? (
                        <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                          <span>
                            {tr(`Auto subfolder ready in ${providerLabel}:`, `Subcarpeta automática lista en ${providerLabel}:`)}{' '}
                            <code className="font-mono font-bold text-emerald-300">
                              /{driveFolder?.path}
                            </code>
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs liquid-text-secondary flex-1 min-w-[200px]">
                            {tr('Save inside a folder named ', '¿Guardar dentro de una carpeta llamada ')}
                            <strong className="text-emerald-300">«{localFolderName}»</strong>{' '}
                            {tr('in', 'en')}{' '}
                            {driveFolder ? `/${driveFolder.path}` : `${tr('Root', 'Raíz')} (${providerLabel})`}?
                          </div>
                          <button
                            type="button"
                            disabled={isCreating || creatingSubfolder}
                            onClick={handleCreateAutoSubfolderInDrive}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition flex-shrink-0"
                          >
                            {creatingSubfolder ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FolderPlus className="w-3.5 h-3.5" />
                            )}
                            {tr('Create', 'Crear')} «/{driveFolder ? `${driveFolder.path}/${localFolderName}` : localFolderName}»
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/15">
              <label className="flex items-center gap-2 text-xs font-medium liquid-text-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={isCreating}
                  checked={isGameSave}
                  onChange={(e) => setIsGameSave(e.target.checked)}
                  className="w-4 h-4 rounded accent-emerald-500 cursor-pointer flex-shrink-0"
                />
                <span>{tr('Mark as Game', 'Marcar como Videojuego')}</span>
              </label>

              <div className="flex items-center gap-3 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl liquid-glass liquid-text-secondary text-sm font-medium transition hover:opacity-90"
                >
                  {isCreating ? tr('Minimize to top bar', 'Minimizar a barra superior') : tr('Cancel', 'Cancelar')}
                </button>
                <button
                  type="submit"
                  disabled={
                    isCreating ||
                    creatingSubfolder ||
                    !name.trim() ||
                    !localPath ||
                    (!isGameSave && !driveFolder)
                  }
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 hover:from-indigo-400 hover:via-sky-400 hover:to-emerald-400 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-sky-500/25"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {tr('Uploading with rclone...', 'Subiendo con rclone...')}
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-4 h-4" />
                      {tr('Create Sync & Push', 'Crear Sincronización y Hacer Push')}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <DriveFolderModal
        isOpen={isDrivePickerOpen}
        provider={provider}
        localFolderName={localFolderName}
        onClose={() => setIsDrivePickerOpen(false)}
        onSelect={(folder) => {
          setDriveFolder(folder)
          setIsDrivePickerOpen(false)
        }}
      />

      <IgnoreFilesModal
        isOpen={isIgnoreModalOpen}
        title={name || 'Nueva Sincronización'}
        provider={provider}
        localPath={localPath}
        driveFolderPath={isGameSave ? autoGameDrivePath : driveFolder?.path}
        initialIgnoredPaths={ignoredPaths}
        onClose={() => setIsIgnoreModalOpen(false)}
        onSave={(paths) => {
          setIgnoredPaths(paths)
        }}
      />

      <CoverPickerModal
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        onSelectCover={(dataUrl) => {
          setCoverImage(dataUrl)
        }}
      />
    </>
  )
}
