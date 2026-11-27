import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDownUp,
  Clock3,
  MapPinned,
  Navigation,
  Ruler,
  Search,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { roomsForChip, searchRooms } from '@/lib/routing'
import { cn } from '@/lib/utils'
import type { Room, RouteResult, SchoolMapData } from '@/types/map'

interface NavPanelProps {
  data: SchoolMapData
  fromId: string | null
  toId: string | null
  selectedId: string | null
  route: RouteResult | null
  activeStep: number
  onFromChange: (id: string | null) => void
  onToChange: (id: string | null) => void
  onSelectRoom: (room: Room) => void
  onSwap: () => void
  onClearRoute: () => void
  onStepJump: (index: number) => void
  onFloorHint: (floor: number) => void
  compact?: boolean
}

export function NavPanel({
  data,
  fromId,
  toId,
  selectedId,
  route,
  activeStep,
  onFromChange,
  onToChange,
  onSelectRoom,
  onSwap,
  onClearRoute,
  onStepJump,
  onFloorHint,
  compact,
}: NavPanelProps) {
  const [query, setQuery] = useState('')
  const [picking, setPicking] = useState<'from' | 'to' | null>(null)

  const results = useMemo(() => {
    const list = searchRooms(data, query).filter((r) => r.kind !== 'stairs')
    return list.slice(0, 40)
  }, [data, query])

  const roomById = useMemo(
    () => new Map(data.rooms.map((r) => [r.id, r])),
    [data.rooms],
  )

  const handlePick = (room: Room) => {
    if (picking === 'from') {
      onFromChange(room.id)
      setPicking(null)
      setQuery('')
      onFloorHint(room.floor)
      return
    }
    if (picking === 'to') {
      onToChange(room.id)
      setPicking(null)
      setQuery('')
      onFloorHint(room.floor)
      return
    }
    onSelectRoom(room)
    onFloorHint(room.floor)
  }

  const chipClick = (label: string) => {
    const matches = roomsForChip(data, label)
    if (!matches.length) return
    const preferred =
      matches.find((m) => m.floor === 1) ??
      matches.find((m) => m.floor === 2) ??
      matches[0]
    if (picking === 'from') {
      onFromChange(preferred.id)
      setPicking(null)
    } else {
      onToChange(preferred.id)
      setPicking(null)
    }
    onFloorHint(preferred.floor)
    onSelectRoom(preferred)
  }

  return (
    <div className={cn('flex h-full flex-col gap-3', compact && 'gap-2')}>
      <div>
        <p className="font-display text-2xl tracking-tight text-foreground">
          {data.school.brand}
        </p>
        <p className="text-sm text-muted-foreground">
          {data.school.name} · {data.school.city}
        </p>
      </div>

      <div className="space-y-2">
        <EndpointField
          label="Откуда"
          active={picking === 'from'}
          value={fromId ? roomById.get(fromId)?.name ?? null : null}
          onFocus={() => setPicking('from')}
          onClear={() => onFromChange(null)}
        />
        <div className="flex justify-center">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={onSwap}
            aria-label="Поменять местами"
          >
            <ArrowDownUp className="size-4" />
          </Button>
        </div>
        <EndpointField
          label="Куда"
          active={picking === 'to'}
          value={toId ? roomById.get(toId)?.name ?? null : null}
          onFocus={() => setPicking('to')}
          onClear={() => onToChange(null)}
        />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            picking === 'from'
              ? 'Поиск точки А…'
              : picking === 'to'
                ? 'Поиск точки Б…'
                : 'Кабинет или зона…'
          }
          className="h-11 rounded-2xl border-border/70 bg-background/60 pl-9"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {data.quickChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => chipClick(chip.label)}
            className="rounded-full border border-border/70 bg-secondary/60 px-3 py-1.5 text-xs font-medium transition hover:bg-accent/40"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {route ? (
          <motion.div
            key="route"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-2xl border border-border/60 bg-secondary/40 p-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Navigation className="size-4 text-primary" />
                Маршрут
              </div>
              <Button size="sm" variant="ghost" onClick={onClearRoute}>
                Сбросить
              </Button>
            </div>
            <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Ruler className="size-3.5" />
                {route.distanceM} м
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3.5" />~{route.etaMin} мин
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPinned className="size-3.5" />
                этажи:{' '}
                {route.floors
                  .map((f) => (f === 0 ? 'П' : String(f)))
                  .join(' → ')}
              </span>
            </div>
            <div className="space-y-2">
              {route.steps.map((step, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onStepJump(i)}
                  className={cn(
                    'w-full rounded-xl border px-3 py-2 text-left text-xs transition',
                    i === activeStep
                      ? 'border-primary/40 bg-primary/10'
                      : 'border-transparent bg-background/50 hover:bg-background/80',
                  )}
                >
                  <div className="mb-0.5 flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-md">
                      {step.floor === 0 ? 'Подвал' : `${step.floor} эт.`}
                    </Badge>
                    <span className="text-muted-foreground">шаг {i + 1}</span>
                  </div>
                  <p className="leading-snug text-foreground">{step.hint}</p>
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Separator />

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 pr-2 pb-4">
          {results.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => handlePick(room)}
              className={cn(
                'flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition',
                selectedId === room.id || fromId === room.id || toId === room.id
                  ? 'bg-primary/10'
                  : 'hover:bg-secondary/70',
              )}
            >
              <div>
                <p className="text-sm font-medium">{room.name}</p>
                <p className="text-xs text-muted-foreground">
                  {room.floor === 0 ? 'Подвал' : `${room.floor} этаж`}
                  {room.kind === 'toilet'
                    ? ' · туалет'
                    : room.kind === 'elevator'
                      ? ' · лифт'
                      : ''}
                </p>
              </div>
              <div className="flex gap-1">
                <Button
                  size="xs"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFromChange(room.id)
                    onFloorHint(room.floor)
                  }}
                >
                  А
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onToChange(room.id)
                    onFloorHint(room.floor)
                  }}
                >
                  Б
                </Button>
              </div>
            </button>
          ))}
          {!results.length && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Ничего не найдено
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

function EndpointField({
  label,
  value,
  active,
  onFocus,
  onClear,
}: {
  label: string
  value: string | null
  active: boolean
  onFocus: () => void
  onClear: () => void
}) {
  return (
    <button
      type="button"
      onClick={onFocus}
      className={cn(
        'flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left transition',
        active
          ? 'border-primary/50 bg-primary/10'
          : 'border-border/70 bg-background/50 hover:bg-background/80',
      )}
    >
      <div>
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        <p className="text-sm font-medium">{value ?? 'Выберите точку'}</p>
      </div>
      {value && (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            onClear()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation()
              onClear()
            }
          }}
          className="rounded-full p-1 hover:bg-secondary"
        >
          <X className="size-3.5" />
        </span>
      )}
    </button>
  )
}
