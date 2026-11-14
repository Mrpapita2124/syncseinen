import React, { useState } from 'react'
import {
  CheckCircle2,
  Cloud,
  EyeOff,
  FolderOpen,
  FolderPlus,
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
import { SyncProgressEvent } from '../types'

interface CreateSyncModalProps {
  isOpen: boolean
  onClose: () => void
  progress: SyncProgressEvent | null
  isCreating: boolean
  onCreated: (params: {
    name: string
    driveFolderPath: string
    driveFolderName: string
    localPath: string
    ignoredPaths?: string[]
    coverImage?: string | null
  }) => Promise<void>
}

export const CreateSyncModal: React.FC<CreateSyncModalProps> = ({
  isOpen,
  onClose,
  progress,
  isCreating,
  onCreated,
}) => {
  const [name, setName] = useState('')
  const [driveFolder, setDriveFolder] = useState<{ path: string; name: string } | null>(null)
  const [localPath, setLocalPath] = useState('')
  const [ignoredPaths, setIgnoredPaths] = useState<string[]>([])
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false)
  const [isIgnoreModalOpen, setIsIgnoreModalOpen] = useState(false)
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false)
  const [creatingSubfolder, setCreatingSubfolder] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

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
      const created = await window.syncApi.createDriveFolder(localFolderName, parentPath)
      setDriveFolder({
        path: created.path,
        name: created.name,
      })
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `No se pudo crear la carpeta "${localFolderName}" en Google Drive`
      )
    } finally {
      setCreatingSubfolder(false)
    }
  }

  const handlePickCover = () => {
    setIsCoverPickerOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !driveFolder || !localPath) {
      setError('Completa el nombre, la carpeta de tu computadora y la carpeta en Google Drive.')
      return
    }
    setError(null)
    try {
      await onCreated({
        name: name.trim(),
        driveFolderPath: driveFolder.path,
        driveFolderName: driveFolder.name,
        localPath,
        ignoredPaths,
        coverImage,
      })
      setName('')
      setDriveFolder(null)
      setLocalPath('')
      setIgnoredPaths([])
      setCoverImage(null)
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
              <h3 className="text-lg font-bold liquid-text-primary">Crear Nueva Sincronización</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              title={
                isCreating
                  ? 'Ocultar ventana (la subida continuará en segundo plano con la barra normal)'
                  : 'Cerrar'
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
                      {progress ? `${progress.phase}` : 'Iniciando subida de archivos con rclone...'}
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
                  Puedes cerrar este cuadro con la <strong>X</strong> de arriba y la subida continuará en la barra general.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
            {/* Carátula / Cover Image Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider liquid-text-muted mb-2">
                Carátula de la Sincronización (Opcional • Se guarda en la metadata)
              </label>
              <div className="flex items-center gap-4">
                <div
                  onClick={() => !isCreating && handlePickCover()}
                  className="relative w-28 h-20 rounded-2xl overflow-hidden liquid-glass-sub flex items-center justify-center cursor-pointer group border border-dashed border-sky-400/40 flex-shrink-0"
                >
                  {coverImage ? (
                    <>
                      <img
                        src={coverImage}
                        alt="Carátula"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <ImagePlus className="w-5 h-5 text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-sky-400/80 gap-1">
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[10px] font-medium">Elegir imagen</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1.5">
                  <p className="text-xs liquid-text-secondary leading-relaxed">
                    Escoge una imagen representativa (juego, proyecto, carpeta). Se adjunta directamente a la metadata en Google Drive para que se vea en todos tus dispositivos.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isCreating}
                      onClick={handlePickCover}
                      className="px-3 py-1.5 rounded-xl liquid-glass text-xs font-semibold text-sky-400 hover:opacity-90 flex items-center gap-1.5 transition"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      {coverImage ? 'Cambiar carátula' : 'Subir carátula'}
                    </button>
                    {coverImage && (
                      <button
                        type="button"
                        disabled={isCreating}
                        onClick={() => setCoverImage(null)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-xs font-medium flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider liquid-text-muted mb-1.5">
                1. Nombre de la Sincronización
              </label>
              <input
                type="text"
                disabled={isCreating}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Programación Web, Partidas Guardadas, Proyectos..."
                className="w-full liquid-glass-sub rounded-xl px-4 py-2.5 text-sm liquid-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider liquid-text-muted mb-1.5">
                2. Carpeta en esta Computadora (Origen Local)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={localPath}
                  placeholder="Selecciona una carpeta de tu PC..."
                  className="flex-1 liquid-glass-sub rounded-xl px-4 py-2.5 text-sm liquid-text-primary placeholder-slate-400 font-mono"
                />
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handlePickLocal}
                  className="px-4 py-2.5 rounded-xl liquid-glass hover:opacity-90 disabled:opacity-50 liquid-text-primary text-sm font-semibold flex items-center gap-2 transition flex-shrink-0"
                >
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  Explorar PC
                </button>
              </div>

              {localPath && (
                <div className="mt-2.5 flex items-center justify-between liquid-glass-sub rounded-xl px-3.5 py-2">
                  <div className="text-xs liquid-text-secondary flex items-center gap-2 truncate">
                    <EyeOff className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span>
                      {ignoredPaths.length === 0
                        ? 'Sin archivos ni rutas ignoradas'
                        : `${ignoredPaths.length} ruta(s)/archivo(s) ignorado(s)`}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={isCreating}
                    onClick={() => setIsIgnoreModalOpen(true)}
                    className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-400 text-xs font-semibold transition flex-shrink-0"
                  >
                    Seleccionar qué ignorar
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider liquid-text-muted mb-1.5">
                3. Carpeta en Google Drive (Destino donde rclone guardará los archivos)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={driveFolder ? `/${driveFolder.path}` : ''}
                  placeholder="Selecciona o crea una carpeta en tu Google Drive..."
                  className="flex-1 liquid-glass-sub rounded-xl px-4 py-2.5 text-sm liquid-text-primary placeholder-slate-400 font-mono"
                />
                <button
                  type="button"
                  disabled={isCreating || creatingSubfolder}
                  onClick={() => setIsDrivePickerOpen(true)}
                  className="px-4 py-2.5 rounded-xl liquid-glass hover:opacity-90 disabled:opacity-50 liquid-text-primary text-sm font-semibold flex items-center gap-2 transition flex-shrink-0"
                >
                  <Cloud className="w-4 h-4 text-sky-400" />
                  Elegir en Drive
                </button>
              </div>

              {/* Opción rápida para crear y añadir automáticamente una subcarpeta con el nombre de la carpeta de la PC */}
              {localFolderName && (
                <div className="mt-2.5 liquid-glass-sub rounded-xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 border border-emerald-400/25">
                  {driveEndsWithLocalName ? (
                    <div className="flex items-center gap-2 text-xs text-emerald-300 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>
                        Subcarpeta automática lista en Drive:{' '}
                        <code className="font-mono font-bold text-emerald-300">
                          /{driveFolder?.path}
                        </code>
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs liquid-text-secondary flex-1 min-w-[200px]">
                        ¿Guardar dentro de una carpeta llamada{' '}
                        <strong className="text-emerald-300">«{localFolderName}»</strong> en{' '}
                        {driveFolder ? `/${driveFolder.path}` : 'Mi unidad'}?
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
                        Crear «/{driveFolder ? `${driveFolder.path}/${localFolderName}` : localFolderName}»
                      </button>
                    </>
                  )}
                </div>
              )}

              <p className="text-xs liquid-text-muted mt-2 leading-relaxed">
                Los archivos se sincronizarán vía <strong>rclone</strong> en la carpeta elegida, mientras que en <code className="text-sky-400 font-mono">_SyncSeinen_Metadata</code> se guardará la metadata y la carátula.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/15">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl liquid-glass liquid-text-secondary text-sm font-medium transition hover:opacity-90"
              >
                {isCreating ? 'Minimizar a barra superior' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={isCreating || creatingSubfolder || !name.trim() || !driveFolder || !localPath}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500 hover:from-indigo-400 hover:via-sky-400 hover:to-emerald-400 disabled:opacity-50 text-white text-sm font-bold flex items-center gap-2 transition shadow-lg shadow-sky-500/25"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subiendo con rclone...
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-4 h-4" />
                    Crear Sincronización y Hacer Push
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <DriveFolderModal
        isOpen={isDrivePickerOpen}
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
        localPath={localPath}
        driveFolderPath={driveFolder?.path}
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
