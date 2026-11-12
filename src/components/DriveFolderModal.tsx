import React, { useEffect, useState } from 'react'
import { Folder, FolderPlus, ChevronRight, ArrowLeft, Check, Loader2, X } from 'lucide-react'
import { DriveFolderItem } from '../types'

interface DriveFolderModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (folder: { path: string; name: string }) => void
}

export const DriveFolderModal: React.FC<DriveFolderModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ path: string; name: string }>>([
    { path: '', name: 'Mi unidad (Google Drive)' },
  ])
  const [folders, setFolders] = useState<DriveFolderItem[]>([])
  const [loading, setLoading] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentFolder = breadcrumbs[breadcrumbs.length - 1]

  const fetchFolders = async (parentPath: string) => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.syncApi.listDriveFolders(parentPath)
      setFolders(list)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al cargar carpetas de Google Drive vía rclone')
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
      const created = await window.syncApi.createDriveFolder(newFolderName.trim(), currentFolder.path)
      setNewFolderName('')
      await fetchFolders(currentFolder.path)
      setBreadcrumbs((prev) => [...prev, { path: created.path, name: created.name }])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo crear la carpeta en Google Drive')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-md p-4">
      <div className="liquid-glass-modal rounded-3xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/15">
          <div className="flex items-center gap-2.5">
            <Folder className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-bold liquid-text-primary">Seleccionar Carpeta en Google Drive</h3>
          </div>
          <button
            onClick={onClose}
            className="liquid-text-muted hover:liquid-text-primary p-1.5 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="px-6 py-3 liquid-glass-sub border-x-0 border-t-0 flex items-center gap-2 overflow-x-auto text-sm">
          {breadcrumbs.length > 1 && (
            <button
              onClick={handleGoBack}
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
                className={`truncate max-w-[180px] hover:underline ${
                  idx === breadcrumbs.length - 1 ? 'text-sky-400 font-semibold' : 'liquid-text-muted'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Create new folder bar */}
        <form onSubmit={handleCreateFolder} className="px-6 py-3 border-b border-white/10 flex gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Crear nueva carpeta aquí en Google Drive..."
            className="flex-1 liquid-glass-sub rounded-xl px-3.5 py-2 text-sm liquid-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
          />
          <button
            type="submit"
            disabled={creating || !newFolderName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 disabled:opacity-50 text-sky-400 text-sm font-semibold transition"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
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
              No hay subcarpetas dentro de <strong className="liquid-text-primary">{currentFolder.name}</strong>.
              <p className="text-xs mt-1">Puedes elegir esta carpeta actual o crear una nueva arriba.</p>
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.path}
                className="flex items-center justify-between p-3 rounded-2xl liquid-glass-sub hover:border-sky-400/40 transition group"
              >
                <button
                  onClick={() => handleEnterFolder(folder)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <Folder className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div className="truncate">
                    <span className="text-sm font-semibold liquid-text-primary block truncate">
                      {folder.name}
                    </span>
                    <span className="text-[11px] liquid-text-muted font-mono block truncate">
                      /{folder.path}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => onSelect({ path: folder.path, name: folder.name })}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-400/30 text-xs font-semibold transition flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Elegir esta
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer: select current folder */}
        <div className="px-6 py-4 liquid-glass-sub border-x-0 border-b-0 flex items-center justify-between">
          <div className="text-xs liquid-text-muted truncate max-w-[260px]">
            Ruta actual: <strong className="liquid-text-primary">/{currentFolder.path}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl liquid-glass liquid-text-secondary text-sm font-medium transition hover:opacity-90"
            >
              Cancelar
            </button>
            {currentFolder.path ? (
              <button
                onClick={() => onSelect({ path: currentFolder.path, name: currentFolder.name })}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-sky-500/25 transition"
              >
                <Check className="w-4 h-4" />
                Usar &ldquo;{currentFolder.name}&rdquo;
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
