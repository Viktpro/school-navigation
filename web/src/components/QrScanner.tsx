import { Html5Qrcode } from 'html5-qrcode'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

export function parsePointToken(text: string): string | null {
  const raw = text.trim()
  try {
    const url = new URL(raw, window.location.origin)
    return url.searchParams.get('from') || url.searchParams.get('point')
  } catch {
    return /^f\d+-/i.test(raw) ? raw : null
  }
}

export function QrScanner({
  onPoint,
  onClose,
}: {
  onPoint: (id: string) => void
  onClose: () => void
}) {
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onPointRef = useRef(onPoint)
  onPointRef.current = onPoint

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader')
    scannerRef.current = scanner
    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 220, height: 220 } },
        (decoded) => {
          const id = parsePointToken(decoded)
          if (!id) {
            setError('QR не содержит точку школы')
            return
          }
          onPointRef.current(id)
        },
        () => {},
      )
      .catch(() => {
        setError('Камера недоступна — загрузите фото QR')
      })
    return () => {
      scanner.stop().catch(() => {})
      scanner.clear()
    }
  }, [])

  const onFile = async (file: File) => {
    const scanner = scannerRef.current ?? new Html5Qrcode('qr-reader')
    try {
      const text = await scanner.scanFile(file, true)
      const id = parsePointToken(text)
      if (!id) setError('На фото нет точки школы')
      else onPoint(id)
    } catch {
      setError('Не удалось прочитать QR')
    }
  }

  return (
    <div className="glass-panel absolute inset-x-4 top-24 z-40 rounded-3xl p-4 md:inset-x-auto md:right-[420px] md:w-[360px]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Я сейчас здесь</p>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Закрыть
        </Button>
      </div>
      <div className="relative overflow-hidden rounded-2xl">
        <div id="qr-reader" className="min-h-56 overflow-hidden rounded-2xl bg-black/40" />
        <div className="scan-frame pointer-events-none absolute inset-8 rounded-2xl border-2 border-amber-300/90" />
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      <label className="mt-3 flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-border px-3 py-2 text-xs">
        Загрузить фото QR
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void onFile(file)
          }}
        />
      </label>
    </div>
  )
}
