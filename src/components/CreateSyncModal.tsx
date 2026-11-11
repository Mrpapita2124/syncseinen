import React, { useState } from 'react'
import { Cloud, FolderOpen, HardDrive, Loader2, PlusCircle, X } from 'lucide-react'
import { DriveFolderModal } from './DriveFolderModal'
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
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handlePickLocal = async () => {
    const picked = await window.syncApi.pickLocalFolder()
    if (picked) {
      setLocalPath(picked)
      if (!name.trim()) {
        const parts = picked.split(/[/\\]/).filter(Boolean)
        if (parts.length > 0) {
          setName(parts[parts.length - 1])
        }
      }
    }
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
      })
      setName('')
      setDriveFolder(null)
      setLocalPath('')
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear la sincronización')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
        <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <PlusCircle className="w-5 h-5 text-indigo-400" />
              <h3 className="text-lg font-semibold text-white">Crear Nueva Sincronización</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              title={
                isCreating
                  ? 'Ocultar ventana (la subida continuará en segundo plano con la barra normal)'
                  : 'Cerrar'
              }
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Barra de progreso en la parte superior del cuadro de selección de rutas */}
          {(isCreating || progress) && (
            <div className="bg-indigo-950/90 border-b border-indigo-800/80 px-6 py-3.5">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400 flex-shrink-0" />
                    <span className="font-semibold text-white truncate">
                      {progress ? `${progress.phase}` : 'Iniciando subida de archivos con rclone...'}
                    </span>
                  </div>
                  <span className="text-indigo-300 font-mono flex-shrink-0 ml-2">
                    {progress ? `${progress.current}%` : '0%'}
                  </span>
                </div>
                {progress?.detail && (
                  <div className="text-[11px] text-indigo-300/80 font-mono truncate">
                    {progress.detail}
                  </div>
                )}
                <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all duration-200"
                    style={{
                      width: `${progress ? Math.min(100, Math.max(5, progress.current)) : 8}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-indigo-300/70 mt-0.5">
                  Puedes cerrar este cuadro con la <strong>X</strong> de arriba y la subida continuará en la barra general.
                </p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                1. Nombre de la Sincronización
              </label>
              <input
                type="text"
                disabled={isCreating}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Partidas Guardadas, Proyectos, Configuraciones..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                2. Carpeta en esta Computadora (Origen Local)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={localPath}
                  placeholder="Selecciona una carpeta de tu PC..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 font-mono"
                />
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={handlePickLocal}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-medium flex items-center gap-2 transition flex-shrink-0"
                >
                  <HardDrive className="w-4 h-4 text-emerald-400" />
                  Explorar PC
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                3. Carpeta en Google Drive (Destino donde rclone guardará los archivos)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={driveFolder ? `/${driveFolder.path}` : ''}
                  placeholder="Selecciona o crea una carpeta en tu Google Drive..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 font-mono"
                />
                <button
                  type="button"
                  disabled={isCreating}
                  onClick={() => setIsDrivePickerOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-medium flex items-center gap-2 transition flex-shrink-0"
                >
                  <Cloud className="w-4 h-4 text-sky-400" />
                  Elegir en Drive
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Los archivos se sincronizarán vía <strong>rclone</strong> dentro de la carpeta elegida. Además, en la carpeta dedicada <code className="text-sky-300 bg-slate-950 px-1.5 py-0.5 rounded">_SyncSeinen_Metadata</code> se guardará únicamente el archivo JSON de metadata para que otros dispositivos vean la sincronización disponible.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition"
              >
                {isCreating ? 'Minimizar a barra superior' : 'Cancelar'}
              </button>
              <button
                type="submit"
                disabled={isCreating || !name.trim() || !driveFolder || !localPath}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2 transition shadow-lg shadow-indigo-600/20"
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
        onClose={() => setIsDrivePickerOpen(false)}
        onSelect={(folder) => {
          setDriveFolder(folder)
          setIsDrivePickerOpen(false)
        }}
      />
    </>
  )
}
