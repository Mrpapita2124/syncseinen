import React, { useEffect, useState } from 'react'
import {
  Folder,
  FolderPlus,
  ChevronRight,
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import { DriveFolderItem } from '../types'

interface DriveFolderModalProps {
  isOpen: boolean
  localFolderName?: string
  onClose: () => void
  onSelect: (folder: { path: string; name: string }) => void
}

export const DriveFolderModal: React.FC<DriveFolderModalProps> = ({
  isOpen,
  localFolderName,
  onClose,
  onSelect,
}) => {
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ path: string; name: string }>>([
    { path: '', name: 'Mi unidad (Google Drive)' },
  ])
  const [folders, setFolders] = useState<DriveFolderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [autoAppendLocalName, setAutoAppendLocalName] = useState(Boolean(localFolderName))
  const [error, setError] = useState<string | null>(null)

  const currentFolder = breadcrumbs[breadcrumbs.length - 1]
  const cleanLocalName = (localFolderName || '').trim()

  useEffect(() => {
    if (cleanLocalName) {
      setAutoAppendLocalName(true)
    }
  }, [cleanLocalName])

  const fetchFolders = async (parentPath: string) => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.syncApi.listDriveFolders(parentPath)
      setFolders(list)
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar carpetas de Google Drive vía rclone'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchFolders(currentFolder.path)
    }
  }, [isOpen, currentFolder.path])

  if (!isOpen) return null

  const handleEnterFolder = (folder: DriveFolderItem) => {
    setBreadcrumbs((prev) => [...prev, { path: folder.path, name: folder.name }])
  }

  const handleGoBack = () => {
    if (breadcrumbs.length > 1) {
      setBreadcrumbs((prev) => prev.slice(0, prev.length - 1))
    }
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim()) return
    setCreating(true)
    setError(null)
    try {
      const created = await window.syncApi.createDriveFolder(
        newFolderName.trim(),
        currentFolder.path
      )
      setNewFolderName('')
      await fetchFolders(currentFolder.path)
      setBreadcrumbs((prev) => [...prev, { path: created.path, name: created.name }])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la carpeta en Google Drive')
    } finally {
      setCreating(false)
    }
  }

  /**
   * Selecciona una carpeta destino en Google Drive.
   * Si la opción automática está activa (o se pide explícitamente forceAutoSubfolder),
   * crea la subcarpeta con el nombre de la carpeta local de la PC dentro de la ruta elegida
   * y añade esa nueva subcarpeta a la ruta de Google Drive.
   */
  const handleSelectWithOptionalSubfolder = async (
    baseFolder: { path: string; name: string },
    forceAutoSubfolder?: boolean
  ) => {
    const shouldCreateSubfolder =
      (forceAutoSubfolder ?? autoAppendLocalName) && Boolean(cleanLocalName)

    if (!shouldCreateSubfolder) {
      onSelect(baseFolder)
      return
    }

    // Evitar duplicar si la carpeta seleccionada ya se llama exactamente igual que la carpeta local
    const baseSegments = baseFolder.path.split('/').filter(Boolean)
    const lastSegment = baseSegments[baseSegments.length - 1] || ''
    if (lastSegment.toLowerCase() === cleanLocalName.toLowerCase()) {
      onSelect(baseFolder)
      return
    }

    setCreating(true)
    setError(null)
    try {
      const created = await window.syncApi.createDriveFolder(cleanLocalName, baseFolder.path)
      onSelect({
        path: created.path,
        name: created.name,
      })
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `No se pudo crear automáticamente la carpeta "${cleanLocalName}" en Google Drive`
      )
    } finally {
      setCreating(false)
    }
  }

  const previewAutoPath = (basePath: string) => {
    if (!cleanLocalName) return `/${basePath}`
    const cleanBase = basePath.replace(/^\/+|\/+$/g, '')
    if (!cleanBase) return `/${cleanLocalName}`
    const segments = cleanBase.split('/').filter(Boolean)
    if ((segments[segments.length - 1] || '').toLowerCase() === cleanLocalName.toLowerCase()) {
      return `/${cleanBase}`
    }
    return `/${cleanBase}/${cleanLocalName}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-md p-4">
      <div className="liquid-glass-modal rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[88vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/15">
          <div className="flex items-center gap-2.5">
            <Folder className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-bold liquid-text-primary">
              Seleccionar Carpeta en Google Drive
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={creating}
            className="liquid-text-muted hover:liquid-text-primary p-1.5 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Opción para crear automáticamente una subcarpeta con el nombre de la carpeta de la PC */}
        {cleanLocalName && (
          <div className="px-6 py-3 bg-emerald-500/10 border-b border-emerald-400/25 flex flex-col gap-2">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoAppendLocalName}
                onChange={(e) => setAutoAppendLocalName(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded accent-emerald-400 cursor-pointer"
              />
              <div className="text-xs leading-relaxed">
                <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  Crear automáticamente carpeta «{cleanLocalName}» en la ruta seleccionada
                </span>
                <span className="liquid-text-secondary block mt-0.5">
                  {autoAppendLocalName ? (
                    <>
                      Se creará la subcarpeta y la ruta final en Drive será:{' '}
                      <code className="text-emerald-300 font-mono font-bold">
                        {previewAutoPath(currentFolder.path)}
                      </code>
                    </>
                  ) : (
                    <>
                      Desactivado: los archivos se guardarán directamente en la carpeta que elijas.
                    </>
                  )}
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Breadcrumb */}
        <div className="px-6 py-3 liquid-glass-sub border-x-0 border-t-0 flex items-center gap-2 overflow-x-auto text-sm">
          {breadcrumbs.length > 1 && (
            <button
              onClick={handleGoBack}
              disabled={creating}
              className="p-1.5 rounded-xl liquid-glass hover:opacity-90 liquid-text-primary mr-1 flex-shrink-0"
              title="Subir un nivel"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path || 'root'}>
              {idx > 0 && <ChevronRight className="w-4 h-4 liquid-text-muted flex-shrink-0" />}
              <button
                onClick={() => setBreadcrumbs(breadcrumbs.slice(0, idx + 1))}
                disabled={creating}
                className={`truncate max-w-[180px] hover:underline ${
                  idx === breadcrumbs.length - 1
                    ? 'text-sky-400 font-semibold'
                    : 'liquid-text-muted'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Create new custom folder bar */}
        <form
          onSubmit={handleCreateFolder}
          className="px-6 py-3 border-b border-white/10 flex gap-2"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="O escribe otro nombre para crear una carpeta aquí..."
            className="flex-1 liquid-glass-sub rounded-xl px-3.5 py-2 text-sm liquid-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          />
          <button
            type="submit"
            disabled={creating || !newFolderName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 disabled:opacity-50 text-sky-400 text-sm font-semibold transition"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FolderPlus className="w-4 h-4" />
            )}
            Crear
          </button>
        </form>

        {error && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Folders list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[240px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 liquid-text-muted gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span className="text-sm">Consultando carpetas en Google Drive con rclone...</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-12 liquid-text-muted text-sm">
              No hay subcarpetas dentro de{' '}
              <strong className="liquid-text-primary">{currentFolder.name}</strong>.
              <p className="text-xs mt-1">
                Puedes usar esta ruta actual abajo o crear una carpeta nueva arriba.
              </p>
            </div>
          ) : (
            folders.map((folder) => {
              const targetPreview =
                autoAppendLocalName && cleanLocalName
                  ? previewAutoPath(folder.path)
                  : `/${folder.path}`

              return (
                <div
                  key={folder.path}
                  className="flex items-center justify-between p-3 rounded-2xl liquid-glass-sub hover:border-sky-400/40 transition group gap-2"
                >
                  <button
                    onClick={() => handleEnterFolder(folder)}
                    disabled={creating}
                    className="flex items-center gap-3 flex-1 text-left min-w-0"
                  >
                    <Folder className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div className="truncate">
                      <span className="text-sm font-semibold liquid-text-primary block truncate">
                        {folder.name}
                      </span>
                      <span className="text-[11px] liquid-text-muted font-mono block truncate">
                        Destino: {targetPreview}
                      </span>
                    </div>
                  </button>
                  <button
                    disabled={creating}
                    onClick={() =>
                      handleSelectWithOptionalSubfolder({
                        path: folder.path,
                        name: folder.name,
                      })
                    }
                    className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-400/30 text-xs font-semibold transition flex items-center gap-1 flex-shrink-0"
                    title={`Guardar en ${targetPreview}`}
                  >
                    {creating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {autoAppendLocalName && cleanLocalName
                      ? `Elegir (+ /${cleanLocalName})`
                      : 'Elegir esta'}
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Footer: select current folder or create local-named subfolder in current path */}
        <div className="px-6 py-4 liquid-glass-sub border-x-0 border-b-0 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs liquid-text-muted truncate max-w-[260px]">
            Ruta final:{' '}
            <strong className="text-sky-300 font-mono">
              {autoAppendLocalName && cleanLocalName
                ? previewAutoPath(currentFolder.path)
                : `/${currentFolder.path}`}
            </strong>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onClose}
              disabled={creating}
              className="px-4 py-2 rounded-xl liquid-glass liquid-text-secondary text-xs font-semibold transition hover:opacity-90"
            >
              Cancelar
            </button>

            {currentFolder.path || (autoAppendLocalName && cleanLocalName) ? (
              <button
                disabled={creating}
                onClick={() =>
                  handleSelectWithOptionalSubfolder({
                    path: currentFolder.path,
                    name: currentFolder.name,
                  })
                }
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 hover:from-emerald-400 hover:via-sky-400 hover:to-indigo-400 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-500/25 transition"
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                {autoAppendLocalName && cleanLocalName
                  ? `Crear y usar "${previewAutoPath(currentFolder.path)}"`
                  : `Usar "/${currentFolder.path}"`}
              </button>
            ) : (
              <span className="text-xs liquid-text-muted italic">
                Elige o crea una carpeta
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
