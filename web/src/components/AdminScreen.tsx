import QRCode from 'qrcode'
import { useMemo, useState } from 'react'
import { SchoolCrest } from '@/components/SchoolCrest'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { SchoolMapData } from '@/types/map'

const PASSWORD = 'МБОУСОШ1'

export function AdminScreen({
  data,
  hiddenIds,
  onToggleHidden,
  onBack,
}: {
  data: SchoolMapData
  hiddenIds: Set<string>
  onToggleHidden: (id: string) => void
  onBack: () => void
}) {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem('school-admin') === '1',
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [roomId, setRoomId] = useState(data.defaultFromId)
  const popular = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem('school-nav-popular') || '{}') as Record<string, number>
      return Object.entries(raw)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    } catch {
      return [] as [string, number][]
    }
  }, [authed])
  const stats = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('school-nav-stats') || '{}') as {
        routes?: number
        scans?: number
      }
    } catch {
      return {}
    }
  }, [authed])

  const login = () => {
    if (password === PASSWORD) {
      sessionStorage.setItem('school-admin', '1')
      setAuthed(true)
      setError('')
    } else setError('Неверный пароль')
  }

  const downloadQr = async () => {
    const room = data.rooms.find((r) => r.id === roomId)
    if (!room) return
    const url = `${window.location.origin}${window.location.pathname}?from=${room.id}`
    const qr = await QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: '#10244f', light: '#fffaf2' },
    })
    const canvas = document.createElement('canvas')
    canvas.width = 480
    canvas.height = 640
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fffaf2'
    ctx.fillRect(0, 0, 480, 640)
    ctx.fillStyle = '#10244f'
    ctx.fillRect(0, 0, 480, 92)
    ctx.fillStyle = '#f4c56d'
    ctx.font = '700 28px Manrope, sans-serif'
    ctx.fillText('МБОУ СОШ №1', 28, 42)
    ctx.font = '500 16px Manrope, sans-serif'
    ctx.fillStyle = '#fffaf2'
    ctx.fillText('Большой Камень', 28, 70)
    const img = new Image()
    img.src = qr
    await img.decode()
    ctx.drawImage(img, 80, 140, 320, 320)
    ctx.fillStyle = '#10244f'
    ctx.font = '700 22px Manrope, sans-serif'
    ctx.fillText(room.name, 28, 510)
    ctx.font = '500 16px Manrope, sans-serif'
    ctx.fillText(room.floor === 0 ? 'Подвал' : `${room.floor} этаж`, 28, 540)
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `qr-${room.id}.png`
    a.click()
  }

  if (!authed) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-6">
        <SchoolCrest size={120} />
        <h1 className="font-display text-3xl">Админ-панель</h1>
        <p className="text-sm text-muted-foreground">МБОУ СОШ №1 · Большой Камень</p>
        <Input
          type="password"
          value={password}
          placeholder="Пароль"
          className="max-w-xs rounded-2xl"
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={login}>Войти</Button>
        <button type="button" className="text-sm text-muted-foreground" onClick={onBack}>
          На главную
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-3">
        <SchoolCrest size={56} />
        <div>
          <h1 className="font-display text-2xl">Управление школой</h1>
          <p className="text-xs text-muted-foreground">
            Маршрутов: {stats.routes ?? 0} · QR-входов: {stats.scans ?? 0}
          </p>
        </div>
        <Button className="ml-auto" variant="ghost" onClick={onBack}>
          На главную
        </Button>
      </div>
      <section className="glass-panel rounded-3xl p-4">
        <h2 className="text-sm font-semibold">Чаще всего строят</h2>
        <div className="mt-3 space-y-2">
          {popular.length === 0 && (
            <p className="text-xs text-muted-foreground">Пока нет построенных маршрутов</p>
          )}
          {popular.map(([pair, count]) => {
            const max = popular[0]?.[1] || 1
            const [from, to] = pair.split('→')
            const name = (id: string) => data.rooms.find((r) => r.id === id)?.name ?? id
            return (
              <div key={pair}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>
                    {name(from)} → {name(to)}
                  </span>
                  <span>{count}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </section>
      <section className="glass-panel rounded-3xl p-4">
        <h2 className="text-sm font-semibold">QR для двери кабинета</h2>
        <select
          className="mt-2 w-full rounded-2xl border bg-background/70 px-3 py-2 text-sm"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        >
          {data.rooms
            .filter((r) => r.kind !== 'stairs')
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.floor === 0 ? 'П' : r.floor} · {r.name}
              </option>
            ))}
        </select>
        <Button className="mt-3" onClick={() => void downloadQr()}>
          Скачать брендированный QR
        </Button>
      </section>
      <section className="glass-panel max-h-[50vh] overflow-auto rounded-3xl p-4">
        <h2 className="mb-2 text-sm font-semibold">Скрытие технических зон</h2>
        {data.rooms
          .filter((r) => r.technical || r.kind === 'zone')
          .map((r) => (
            <label key={r.id} className="flex items-center justify-between py-1.5 text-sm">
              <span>
                {r.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {r.floor === 0 ? 'подвал' : `${r.floor} эт.`}
                </span>
              </span>
              <input
                type="checkbox"
                checked={hiddenIds.has(r.id)}
                onChange={() => onToggleHidden(r.id)}
              />
            </label>
          ))}
      </section>
    </div>
  )
}
