import React, { useState } from 'react'
import {
  ArrowDownToLine,
  Calendar,
  CheckCircle2,
  Loader2,
  Rocket,
  Sparkles,
  X,
} from 'lucide-react'
import { UpdateCheckResult, UpdateProgressEvent } from '../types'

interface Props {
  isOpen: boolean
  updateInfo: UpdateCheckResult
  updateProgress: UpdateProgressEvent | null
  onClose: () => void
}

export const UpdateModal: React.FC<Props> = ({
  isOpen,
  updateInfo,
  updateProgress,
  onClose,
}) => {
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleInstallUpdate = async () => {
    if (!updateInfo.downloadUrl || !updateInfo.assetName) {
      setError('No se encontró un paquete ejecutable compatible en esta release.')
      return
    }

    setInstalling(true)
    setError(null)
    try {
      await window.syncApi.downloadAndInstallUpdate({
        downloadUrl: updateInfo.downloadUrl,
        assetName: updateInfo.assetName,
      })
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al descargar o instalar la actualización.'
      )
      setInstalling(false)
    }
  }

  const formatDate = (iso: string) => {
    if (!iso) return ''
    try {
      return new Date(iso).toLocaleDateString('es-MX', {
        dateStyle: 'long',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-xl liquid-glass rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 via-sky-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 border border-white/30">
              <Rocket className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-extrabold liquid-text-primary flex items-center gap-2">
                ¡Nueva versión disponible!
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/35">
                  v{updateInfo.latestVersion}
                </span>
              </h2>
              <p className="text-xs liquid-text-muted">
                Versión actual instalada: <code className="text-sky-400 font-mono">v{updateInfo.currentVersion}</code>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={installing}
            className="liquid-text-muted hover:liquid-text-primary p-1.5 rounded-xl hover:bg-white/10 disabled:opacity-40 transition"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Download & Install Progress Bar */}
        {installing && (
          <div className="px-6 py-4 liquid-glass-sub border-b border-white/15">
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 flex-shrink-0" />
                <span className="font-bold liquid-text-primary truncate">
                  {updateProgress?.phase || 'Iniciando descarga de la nueva versión...'}
                </span>
                {updateProgress?.detail && (
                  <span className="liquid-text-muted font-mono flex-shrink-0">
                    ({updateProgress.detail})
                  </span>
                )}
              </div>
              <span className="text-emerald-400 font-mono font-bold flex-shrink-0 ml-2">
                {updateProgress ? `${updateProgress.percent}%` : '0%'}
              </span>
            </div>
            <div className="w-full h-2.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-sky-400 to-indigo-500 transition-all duration-200"
                style={{
                  width: `${updateProgress ? Math.min(100, Math.max(6, updateProgress.percent)) : 8}%`,
                }}
              />
            </div>
            <p className="text-[11px] liquid-text-muted mt-2">
              Al finalizar la descarga, SyncSeinen instalará la actualización y se reiniciará automáticamente.
            </p>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-400/40 text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          {/* Release Title & Date */}
          <div className="liquid-glass-sub rounded-2xl p-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span className="text-sm font-bold liquid-text-primary">
                {updateInfo.releaseName}
              </span>
            </div>
            {updateInfo.publishedAt && (
              <span className="text-xs liquid-text-muted flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                {formatDate(updateInfo.publishedAt)}
              </span>
            )}
          </div>

          {/* Changelog / Release Notes from GitHub */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider liquid-text-secondary">
              Novedades y cambios en esta versión (GitHub Release)
            </label>
            <div className="liquid-glass-sub rounded-2xl p-4 max-h-64 overflow-y-auto text-xs liquid-text-primary leading-relaxed whitespace-pre-wrap font-sans border border-white/10">
              {updateInfo.releaseNotes}
            </div>
          </div>

          {updateInfo.assetName && (
            <div className="flex items-center gap-2 text-xs liquid-text-muted px-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>
                Paquete detectado para tu sistema:{' '}
                <code className="text-sky-400 font-mono">{updateInfo.assetName}</code>
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/15">
          <button
            type="button"
            onClick={onClose}
            disabled={installing}
            className="px-4 py-2.5 rounded-2xl liquid-glass-sub hover:opacity-90 disabled:opacity-40 liquid-text-secondary text-xs font-bold transition"
          >
            Más tarde
          </button>
          <button
            type="button"
            onClick={handleInstallUpdate}
            disabled={installing || !updateInfo.downloadUrl}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 hover:from-emerald-400 hover:via-sky-400 hover:to-indigo-400 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition"
          >
            {installing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Descargando e instalando...
              </>
            ) : (
              <>
                <ArrowDownToLine className="w-4 h-4" />
                Aceptar e Instalar v{updateInfo.latestVersion}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

