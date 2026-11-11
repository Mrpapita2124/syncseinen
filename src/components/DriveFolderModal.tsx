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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Folder className="w-5 h-5 text-sky-400" />
            <h3 className="text-lg font-semibold text-white">Seleccionar Carpeta en Google Drive</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center gap-2 overflow-x-auto text-sm">
          {breadcrumbs.length > 1 && (
            <button
              onClick={handleGoBack}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 mr-1 flex-shrink-0"
              title="Subir un nivel"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path || 'root'}>
              {idx > 0 && <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />}
              <button
                onClick={() => setBreadcrumbs(breadcrumbs.slice(0, idx + 1))}
                className={`truncate max-w-[180px] hover:underline ${
                  idx === breadcrumbs.length - 1 ? 'text-sky-400 font-medium' : 'text-slate-400'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Create new folder bar */}
        <form onSubmit={handleCreateFolder} className="px-6 py-3 border-b border-slate-800 flex gap-2">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Crear nueva carpeta aquí en Google Drive..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={creating || !newFolderName.trim()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sky-400 text-sm font-medium transition"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderPlus className="w-4 h-4" />}
            Crear
          </button>
        </form>

        {error && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
            {error}
          </div>
        )}

        {/* Folders list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1.5 min-h-[240px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
              <span className="text-sm">Consultando carpetas en Google Drive con rclone...</span>
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No hay subcarpetas dentro de <strong className="text-slate-300">{currentFolder.name}</strong>.
              <p className="text-xs mt-1">Puedes elegir esta carpeta actual o crear una nueva arriba.</p>
            </div>
          ) : (
            folders.map((folder) => (
              <div
                key={folder.path}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 hover:bg-slate-800/70 border border-slate-800/80 transition group"
              >
                <button
                  onClick={() => handleEnterFolder(folder)}
                  className="flex items-center gap-3 flex-1 text-left"
                >
                  <Folder className="w-5 h-5 text-amber-400 flex-shrink-0" />
                  <div className="truncate">
                    <span className="text-sm font-medium text-slate-200 group-hover:text-white block truncate">
                      {folder.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono block truncate">
                      /{folder.path}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => onSelect({ path: folder.path, name: folder.name })}
                  className="px-3 py-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white text-xs font-medium transition flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Elegir esta
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer: select current folder */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400 truncate max-w-[260px]">
            Ruta actual: <strong className="text-slate-200">/{currentFolder.path}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition"
            >
              Cancelar
            </button>
            {currentFolder.path ? (
              <button
                onClick={() => onSelect({ path: currentFolder.path, name: currentFolder.name })}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium flex items-center gap-1.5 transition"
              >
                <Check className="w-4 h-4" />
                Usar &ldquo;{currentFolder.name}&rdquo;
              </button>
            ) : (
              <span className="text-xs text-slate-500 italic">
                Elige o crea una carpeta
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
