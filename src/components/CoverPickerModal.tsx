import React, { useEffect, useRef, useState } from 'react'
import {
  Check,
  Globe,
  HardDrive,
  ImagePlus,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import { OnlineImageItem } from '../types'

interface CoverPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectCover: (dataUrl: string) => void | Promise<void>
}

export const CoverPickerModal: React.FC<CoverPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectCover,
}) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OnlineImageItem[]>([])
  const [selectedItem, setSelectedItem] = useState<OnlineImageItem | null>(null)
  const [searching, setSearching] = useState(false)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const lastSearchedRef = useRef<string>('')

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setSelectedItem(null)
      setQuery('')
      setResults([])
      setHasSearched(false)
      lastSearchedRef.current = ''
    }
  }, [isOpen])

  const runSearch = async (searchText: string) => {
    const clean = searchText.trim()
    if (!clean) {
      setResults([])
      setHasSearched(false)
      return
    }
    lastSearchedRef.current = clean
    setSearching(true)
    setError(null)
    setSelectedItem(null)
    setHasSearched(true)
    try {
      const list = await window.syncApi.searchCoverImagesOnline(clean)
      setResults(list)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al buscar imágenes en internet con DuckDuckGo.'
      )
    } finally {
      setSearching(false)
    }
  }

  // Búsqueda automática al escribir texto (con debounce de 450ms)
  useEffect(() => {
    if (!isOpen) return
    const clean = query.trim()
    if (!clean) {
      setResults([])
      setHasSearched(false)
      lastSearchedRef.current = ''
      return
    }
    if (clean === lastSearchedRef.current) return

    const timer = setTimeout(() => {
      runSearch(clean)
    }, 450)

    return () => clearTimeout(timer)
  }, [query, isOpen])

  if (!isOpen) return null

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await runSearch(query)
  }

  const handlePickLocalFile = async () => {
    setError(null)
    try {
      const dataUrl = await window.syncApi.pickCoverImage()
      if (dataUrl) {
        setApplying(true)
        await onSelectCover(dataUrl)
        onClose()
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar la imagen local.'
      )
    } finally {
      setApplying(false)
    }
  }

  const handleAcceptOnlineImage = async () => {
    if (!selectedItem) return
    setApplying(true)
    setError(null)
    try {
      const dataUrl = await window.syncApi.downloadCoverImageOnline({
        imageUrl: selectedItem.image,
        thumbnailUrl: selectedItem.thumbnail,
      })
      await onSelectCover(dataUrl)
      onClose()
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo descargar la imagen seleccionada. Prueba con otra imagen.'
      )
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="liquid-glass-modal rounded-3xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/15">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-500 to-emerald-400 flex items-center justify-center shadow-md border border-white/25">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold liquid-text-primary">
                Buscador de Imágenes Online
              </h3>
              <p className="text-[11px] liquid-text-muted">
                Escribe para buscar en DuckDuckGo Images o elige una foto desde tu PC
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="liquid-text-muted hover:liquid-text-primary p-1.5 rounded-xl hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input Bar */}
        <form
          onSubmit={handleSearchSubmit}
          className="px-6 py-3.5 border-b border-white/10 flex gap-2.5 liquid-glass-sub"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-sky-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              disabled={applying}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ingresa texto para buscar imágenes (ej. Hollow Knight, Programación Web...)"
              className="w-full liquid-glass rounded-xl pl-10 pr-4 py-2.5 text-sm liquid-text-primary placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
            />
          </div>
          <button
            type="submit"
            disabled={searching || applying || !query.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-sky-500/20 transition flex-shrink-0"
          >
            {searching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            Buscar
          </button>
        </form>

        {error && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* Images Result Grid */}
        <div className="flex-1 overflow-y-auto p-5 min-h-[290px]">
          {searching ? (
            <div className="h-64 flex flex-col items-center justify-center liquid-text-muted gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-sky-400" />
              <span className="text-sm font-medium">
                Buscando imágenes en internet...
              </span>
            </div>
          ) : results.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center liquid-text-muted gap-2 px-4">
              <div className="w-12 h-12 rounded-2xl liquid-glass-sub flex items-center justify-center text-sky-400/70 mb-1">
                <ImagePlus className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold liquid-text-primary">
                {hasSearched
                  ? 'No se encontraron imágenes para esa búsqueda'
                  : 'Ingresa un texto arriba para ver las imágenes resultantes'}
              </p>
              <p className="text-xs liquid-text-muted max-w-md">
                Haz clic en la imagen que te guste y pulsa{' '}
                <strong className="text-emerald-300">Aceptar</strong> abajo a la derecha, o usa{' '}
                <strong className="text-sky-300">Subir foto local</strong> para elegirla desde tu computadora.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {results.map((item) => {
                const isSelected = selectedItem?.id === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={applying}
                    onClick={() => setSelectedItem(item)}
                    className={`group relative h-32 rounded-2xl overflow-hidden border text-left transition-all ${
                      isSelected
                        ? 'border-emerald-400 ring-2 ring-emerald-400/70 scale-[1.02] shadow-lg shadow-emerald-500/20'
                        : 'border-white/15 hover:border-sky-400/50 opacity-90 hover:opacity-100'
                    }`}
                    title={item.title}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300 bg-slate-900/60"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 pt-5">
                      <span className="text-[10px] text-white/90 font-medium block truncate">
                        {item.title}
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md border border-white/40">
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer: Left status + Right buttons ("Subir foto local" to the left of "Aceptar") */}
        <div className="px-6 py-4 liquid-glass-sub border-x-0 border-b-0 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs liquid-text-muted truncate max-w-[230px]">
            {selectedItem ? (
              <span className="text-emerald-300 font-semibold">
                ✓ Imagen seleccionada lista para aplicar
              </span>
            ) : (
              <span>Selecciona una imagen o sube una de tu PC</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            {/* Botón de subir foto local a la izquierda del botón de Aceptar */}
            <button
              type="button"
              disabled={applying}
              onClick={handlePickLocalFile}
              className="px-4 py-2.5 rounded-2xl liquid-glass hover:bg-white/10 disabled:opacity-50 text-sky-300 text-xs font-bold flex items-center gap-2 border border-sky-400/35 transition"
              title="Extraer imagen directamente de tu computadora"
            >
              <HardDrive className="w-4 h-4 text-sky-400" />
              Subir foto local
            </button>

            {/* Botón de Aceptar abajo a la derecha */}
            <button
              type="button"
              disabled={!selectedItem || applying}
              onClick={handleAcceptOnlineImage}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500 hover:from-emerald-400 hover:via-sky-400 hover:to-indigo-400 disabled:opacity-40 text-white text-xs font-extrabold flex items-center gap-2 shadow-lg shadow-emerald-500/25 transition"
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Aplicando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Aceptar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
