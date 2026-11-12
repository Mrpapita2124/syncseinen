import React, { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Cloud,
  EyeOff,
  File,
  Folder,
  FolderOpen,
  HardDrive,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { FolderEntryItem } from '../types'

interface IgnoreFilesModalProps {
  isOpen: boolean
  title: string
  localPath?: string
  driveFolderPath?: string
  initialIgnoredPaths: string[]
  onClose: () => void
  onSave: (ignoredPaths: string[]) => Promise<void> | void
}

export const IgnoreFilesModal: React.FC<IgnoreFilesModalProps> = ({
  isOpen,
  title,
  localPath,
  driveFolderPath,
  initialIgnoredPaths,
  onClose,
  onSave,
}) => {
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ relPath: string; name: string }>>([
    { relPath: '', name: 'Raíz de la sincronización' },
  ])
  const [entries, setEntries] = useState<FolderEntryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIgnored, setSelectedIgnored] = useState<string[]>([])
  const [customPattern, setCustomPattern] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  const [sourceMode, setSourceMode] = useState<'local' | 'remote'>(localPath ? 'local' : 'remote')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentCrumb = breadcrumbs[breadcrumbs.length - 1]

  useEffect(() => {
    if (isOpen) {
      setSelectedIgnored(Array.from(new Set(initialIgnoredPaths || [])))
      setBreadcrumbs([{ relPath: '', name: 'Raíz de la sincronización' }])
      setSearchFilter('')
      setCustomPattern('')
      setSourceMode(localPath ? 'local' : 'remote')
    }
  }, [isOpen, initialIgnoredPaths, localPath])

  useEffect(() => {
    if (!isOpen) return
    const loadEntries = async () => {
      setLoading(true)
      setError(null)
      try {
        if (sourceMode === 'local' && localPath) {
          const items = await window.syncApi.listLocalFolderContents(localPath, currentCrumb.relPath)
          setEntries(items)
        } else if (driveFolderPath !== undefined) {
          const items = await window.syncApi.listRemoteSyncFolderContents(
            driveFolderPath,
            currentCrumb.relPath
          )
          setEntries(items)
        } else {
          setEntries([])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error al leer el contenido de la ruta')
      } finally {
        setLoading(false)
      }
    }
    loadEntries()
  }, [isOpen, currentCrumb.relPath, sourceMode, localPath, driveFolderPath])

  if (!isOpen) return null

  const isExactIgnored = (relPath: string) => selectedIgnored.includes(relPath)

  const getParentIgnored = (relPath: string): string | null => {
    for (const pattern of selectedIgnored) {
      if (relPath !== pattern && relPath.startsWith(`${pattern}/`)) {
        return pattern
      }
    }
    return null
  }

  const toggleIgnorePath = (relPath: string) => {
    setSelectedIgnored((prev) => {
      if (prev.includes(relPath)) {
        return prev.filter((p) => p !== relPath)
      }
      const withoutRedundantChildren = prev.filter((p) => !p.startsWith(`${relPath}/`))
      return [...withoutRedundantChildren, relPath]
    })
  }

  const handleEnterFolder = (entry: FolderEntryItem) => {
    setBreadcrumbs((prev) => [...prev, { relPath: entry.relPath, name: entry.name }])
    setSearchFilter('')
  }

  const handleGoBack = () => {
    if (breadcrumbs.length > 1) {
      setBreadcrumbs((prev) => prev.slice(0, prev.length - 1))
      setSearchFilter('')
    }
  }

  const handleAddCustomPattern = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = customPattern.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (!clean) return
    if (!selectedIgnored.includes(clean)) {
      setSelectedIgnored((prev) => [...prev, clean])
    }
    setCustomPattern('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(selectedIgnored)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los archivos ignorados')
    } finally {
      setSaving(false)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (bytes === undefined || bytes === null) return ''
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const filteredEntries = entries.filter((item) =>
    item.name.toLowerCase().includes(searchFilter.trim().toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-md p-4">
      <div className="liquid-glass-modal rounded-3xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/15">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-400">
              <EyeOff className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold liquid-text-primary">
                Ignorar Archivos y Carpetas — {title}
              </h3>
              <p className="text-xs liquid-text-muted">
                Selecciona rutas o archivos para que no se suban en Push ni se borren/sobrescriban en Pull
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="liquid-text-muted hover:liquid-text-primary p-1.5 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source selector + Breadcrumbs */}
        <div className="px-6 py-3 liquid-glass-sub border-x-0 border-t-0 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs flex-1 min-w-[220px]">
            {breadcrumbs.length > 1 && (
              <button
                type="button"
                onClick={handleGoBack}
                className="p-1.5 rounded-xl liquid-glass liquid-text-primary mr-1 flex-shrink-0"
                title="Subir un nivel"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            )}
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={crumb.relPath || 'root'}>
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 liquid-text-muted flex-shrink-0" />}
                <button
                  type="button"
                  onClick={() => setBreadcrumbs(breadcrumbs.slice(0, idx + 1))}
                  className={`truncate max-w-[160px] hover:underline ${
                    idx === breadcrumbs.length - 1
                      ? 'text-amber-400 font-semibold'
                      : 'liquid-text-muted'
                  }`}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>

          {localPath && driveFolderPath !== undefined && (
            <div className="flex items-center gap-1 liquid-glass rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setSourceMode('local')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition ${
                  sourceMode === 'local'
                    ? 'bg-indigo-500 text-white font-semibold shadow'
                    : 'liquid-text-muted hover:liquid-text-primary'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                Carpeta Local
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('remote')}
                className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition ${
                  sourceMode === 'remote'
                    ? 'bg-sky-500 text-white font-semibold shadow'
                    : 'liquid-text-muted hover:liquid-text-primary'
                }`}
              >
                <Cloud className="w-3.5 h-3.5" />
                Google Drive
              </button>
            </div>
          )}
        </div>

        {/* Search & Custom Pattern Bar */}
        <div className="px-6 py-3 border-b border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="relative">
            <Search className="w-4 h-4 liquid-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar en esta carpeta..."
              className="w-full liquid-glass-sub rounded-xl pl-9 pr-3 py-1.5 text-xs liquid-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>

          <form onSubmit={handleAddCustomPattern} className="flex gap-1.5">
            <input
              type="text"
              value={customPattern}
              onChange={(e) => setCustomPattern(e.target.value)}
              placeholder="Agregar ruta o comodín (ej. *.log, cache/temp)..."
              className="flex-1 liquid-glass-sub rounded-xl px-3 py-1.5 text-xs liquid-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 font-mono"
            />
            <button
              type="submit"
              disabled={!customPattern.trim()}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 disabled:opacity-40 text-amber-400 text-xs font-semibold flex items-center gap-1 transition flex-shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir
            </button>
          </form>
        </div>

        {error && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* File & Folder Explorer List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[240px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 liquid-text-muted gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
              <span className="text-xs">Cargando archivos y subcarpetas...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-12 liquid-text-muted text-xs">
              No se encontraron archivos ni subcarpetas en esta ruta.
            </div>
          ) : (
            filteredEntries.map((entry) => {
              const exactIgnored = isExactIgnored(entry.relPath)
              const parentIgnored = getParentIgnored(entry.relPath)
              const effectivelyIgnored = exactIgnored || Boolean(parentIgnored)

              return (
                <div
                  key={entry.relPath}
                  className={`flex items-center justify-between p-2.5 rounded-2xl transition ${
                    effectivelyIgnored
                      ? 'bg-amber-500/15 border border-amber-400/45'
                      : 'liquid-glass-sub hover:border-sky-400/35'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      disabled={Boolean(parentIgnored)}
                      onClick={() => toggleIgnorePath(entry.relPath)}
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition flex-shrink-0 ${
                        effectivelyIgnored
                          ? 'bg-amber-500 border-amber-400 text-slate-950'
                          : 'liquid-glass border-slate-400/50 hover:border-amber-400'
                      }`}
                      title={
                        parentIgnored
                          ? `Ignorado porque la carpeta superior "${parentIgnored}" está ignorada`
                          : exactIgnored
                            ? 'Quitar de ignorados'
                            : 'Marcar para ignorar'
                      }
                    >
                      {effectivelyIgnored && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    {entry.isDir ? (
                      <button
                        type="button"
                        onClick={() => handleEnterFolder(entry)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 text-left group"
                      >
                        <Folder className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <div className="truncate">
                          <span className="text-xs font-semibold liquid-text-primary group-hover:text-amber-400 truncate block">
                            {entry.name}/
                          </span>
                          <span className="text-[10px] liquid-text-muted font-mono truncate block">
                            {entry.relPath}
                          </span>
                        </div>
                      </button>
                    ) : (
                      <div
                        onClick={() => !parentIgnored && toggleIgnorePath(entry.relPath)}
                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                      >
                        <File className="w-4 h-4 text-sky-400 flex-shrink-0" />
                        <div className="truncate">
                          <span className="text-xs font-medium liquid-text-primary truncate block">
                            {entry.name}
                          </span>
                          <span className="text-[10px] liquid-text-muted font-mono truncate block">
                            {entry.relPath}{' '}
                            {entry.size !== undefined ? `• ${formatFileSize(entry.size)}` : ''}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                    {parentIgnored ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400/30 font-medium">
                        Ignorado por /{parentIgnored}
                      </span>
                    ) : exactIgnored ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-400/40">
                        Ignorado
                      </span>
                    ) : null}

                    {entry.isDir && (
                      <button
                        type="button"
                        onClick={() => handleEnterFolder(entry)}
                        className="px-2.5 py-1 rounded-xl liquid-glass liquid-text-primary text-xs font-medium flex items-center gap-1 transition hover:opacity-90"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                        Abrir ruta
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Selected Ignored Paths Summary */}
        <div className="px-6 py-3 liquid-glass-sub border-x-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold liquid-text-primary">
              Rutas y archivos ignorados ({selectedIgnored.length}):
            </span>
            {selectedIgnored.length > 0 && (
              <button
                type="button"
                onClick={() => setSelectedIgnored([])}
                className="text-[11px] text-rose-400 hover:underline flex items-center gap-1 font-medium"
              >
                <Trash2 className="w-3 h-3" />
                Limpiar todos
              </button>
            )}
          </div>

          {selectedIgnored.length === 0 ? (
            <p className="text-xs liquid-text-muted italic">
              Ningún archivo o carpeta ignorado. Se sincronizará todo el contenido.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto py-1">
              {selectedIgnored.map((item) => (
                <span
                  key={item}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 border border-amber-400/35 text-amber-400 text-xs font-mono font-medium"
                >
                  /{item}
                  <button
                    type="button"
                    onClick={() => toggleIgnorePath(item)}
                    className="hover:opacity-75"
                    title="Quitar de ignorados"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-[11px] liquid-text-muted leading-relaxed">
            Al hacer <strong>Push</strong> no se subirán estos archivos, y al hacer <strong>Pull</strong> se ignorará su existencia (no se borrarán ni modificarán en tu computadora).
          </p>
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl liquid-glass liquid-text-secondary text-xs font-medium transition hover:opacity-90"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-amber-500/25"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4 stroke-[2.5]" />
              )}
              Guardar Ignorados ({selectedIgnored.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
