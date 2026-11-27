import { motion } from 'motion/react'
import { AlertTriangle, Moon, QrCode, Search, Sun } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AdminScreen } from '@/components/AdminScreen'
import { FloorMap } from '@/components/FloorMap'
import { FloorSwitcher } from '@/components/FloorSwitcher'
import { HomeScreen } from '@/components/HomeScreen'
import { NavPanel } from '@/components/NavPanel'
import { QrScanner } from '@/components/QrScanner'
import { SchoolCrest } from '@/components/SchoolCrest'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'
import { findRoute, nearestExit } from '@/lib/routing'
import type { Room, SchoolMapData } from '@/types/map'
import mapData from '@/data/school-map.json'

const data = mapData as unknown as SchoolMapData

type View = 'home' | 'map' | 'admin'

function loadOverrides(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem('school-nav-visibility') || '{}')
  } catch {
    return {}
  }
}

function bumpStat(key: 'routes' | 'scans') {
  const stats = JSON.parse(localStorage.getItem('school-nav-stats') || '{}')
  stats[key] = (stats[key] ?? 0) + 1
  localStorage.setItem('school-nav-stats', JSON.stringify(stats))
}

export default function App() {
  const { theme, toggle } = useTheme()
  const params = new URLSearchParams(window.location.search)
  const rawFrom = params.get('from') || params.get('point')
  const linkedFrom = rawFrom
    ? (data.legacyPoints?.[rawFrom] ?? rawFrom)
    : null
  const [view, setView] = useState<View>(linkedFrom ? 'map' : 'home')
  const [floor, setFloor] = useState(1)
  const [fromId, setFromId] = useState<string | null>(
    linkedFrom && data.rooms.some((r) => r.id === linkedFrom)
      ? linkedFrom
      : data.defaultFromId,
  )
  const [toId, setToId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(linkedFrom)
  const [activeStep, setActiveStep] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [iso, setIso] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [evac, setEvac] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, boolean>>(loadOverrides)

  const hiddenIds = useMemo(() => {
    const set = new Set<string>()
    for (const room of data.rooms) {
      const forced = overrides[room.id]
      if (forced === true || (forced !== false && room.technical)) set.add(room.id)
    }
    return set
  }, [overrides])

  const route = useMemo(() => {
    if (evac && fromId) return nearestExit(data, fromId)?.route ?? null
    if (!fromId || !toId) return null
    return findRoute(data, fromId, toId)
  }, [fromId, toId, evac])

  useEffect(() => {
    if (linkedFrom) bumpStat('scans')
  }, [linkedFrom])

  useEffect(() => {
    setActiveStep(0)
    if (route?.steps[0]) setFloor(route.steps[0].floor)
    if (route && !evac && fromId && toId) {
      bumpStat('routes')
      const key = `${fromId}→${toId}`
      const popular = JSON.parse(localStorage.getItem('school-nav-popular') || '{}')
      popular[key] = (popular[key] ?? 0) + 1
      localStorage.setItem('school-nav-popular', JSON.stringify(popular))
    }
  }, [route, evac, toId, fromId])

  const routeStep = route?.steps[activeStep] ?? null
  const focusId = selectedId || toId || fromId

  const onSelectRoom = (room: Room) => {
    setSelectedId(room.id)
    setFloor(room.floor)
    if (evac) return
    if (!fromId || fromId === room.id) {
      setFromId(room.id)
      return
    }
    setToId(room.id)
  }

  const panelProps = {
    data,
    includeTechnical: false,
    hiddenIds,
    fromId,
    toId: evac ? nearestExit(data, fromId || data.defaultFromId)?.id ?? null : toId,
    selectedId,
    route,
    activeStep,
    onFromChange: (id: string | null) => {
      setFromId(id)
      if (id) setFloor(data.rooms.find((r) => r.id === id)?.floor ?? floor)
    },
    onToChange: (id: string | null) => {
      setEvac(false)
      setToId(id)
      if (id) setFloor(data.rooms.find((r) => r.id === id)?.floor ?? floor)
    },
    onSelectRoom,
    onSwap: () => {
      setFromId(toId)
      setToId(fromId)
    },
    onClearRoute: () => {
      setToId(null)
      setEvac(false)
      setActiveStep(0)
    },
    onStepJump: (index: number) => {
      if (!route) return
      setActiveStep(index)
      setFloor(route.steps[index].floor)
    },
    onFloorHint: (next: number) => setFloor(next),
  }

  if (view === 'home') {
    return (
      <TooltipProvider>
        <div className="h-full">
          <HomeScreen
            onOpenMap={() => setView('map')}
            onOpenQr={() => {
              setView('map')
              setScanOpen(true)
            }}
            onOpenAdmin={() => setView('admin')}
            theme={theme}
            onToggleTheme={toggle}
          />
        </div>
      </TooltipProvider>
    )
  }

  if (view === 'admin') {
    return (
      <TooltipProvider>
        <AdminScreen
          data={data}
          hiddenIds={hiddenIds}
          onToggleHidden={(id) => {
            setOverrides((prev) => {
              const currentlyHidden = hiddenIds.has(id)
              const next = { ...prev, [id]: !currentlyHidden }
              localStorage.setItem('school-nav-visibility', JSON.stringify(next))
              return next
            })
          }}
          onBack={() => setView('home')}
        />
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <div className={evac ? 'evac-mode relative h-full w-full overflow-hidden' : 'relative h-full w-full overflow-hidden'}>
        <FloorMap
          data={data}
          floor={floor}
          iso={iso}
          selectedId={selectedId}
          fromId={fromId}
          toId={panelProps.toId}
          focusId={focusId}
          routeStep={routeStep}
          evac={evac}
          onSelect={onSelectRoom}
          className="md:pr-[400px]"
        />

        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel absolute top-3 left-3 z-20 flex items-center gap-2 rounded-2xl px-2 py-1.5 md:top-5 md:left-5"
        >
          <button type="button" onClick={() => setView('home')} aria-label="На главную">
            <SchoolCrest size={42} />
          </button>
          <div className="pr-1">
            <p className="font-display text-base leading-none">СОШ №1</p>
            <p className="text-[11px] text-muted-foreground">Карта · раздел приложения</p>
          </div>
          <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label="Тема">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </motion.header>

        <div className="absolute top-20 left-3 z-20 flex flex-col gap-2 md:top-24 md:left-5">
          <FloorSwitcher
            floors={data.floors}
            current={floor}
            routeFloors={route?.floors}
            onChange={(next) => {
              setFloor(next)
              setSelectedId(null)
            }}
          />
          <div className="glass-panel flex flex-col gap-1 rounded-2xl p-1">
            <Button
              size="sm"
              variant={iso ? 'ghost' : 'default'}
              onClick={() => setIso(false)}
            >
              2D
            </Button>
            <Button
              size="sm"
              variant={iso ? 'default' : 'ghost'}
              onClick={() => setIso(true)}
            >
              2.5D
            </Button>
          </div>
        </div>

        <div className="absolute top-3 right-3 z-20 flex gap-2 md:top-5 md:right-[420px]">
          <Button size="sm" variant="secondary" onClick={() => setScanOpen((v) => !v)}>
            <QrCode className="size-4" /> QR
          </Button>
          <Button
            size="sm"
            variant={evac ? 'destructive' : 'secondary'}
            onClick={() => {
              setEvac((v) => !v)
              setView('map')
            }}
          >
            <AlertTriangle className="size-4" /> Эвакуация
          </Button>
        </div>

        {scanOpen && (
          <QrScanner
            onPoint={(id) => {
              const resolved = data.legacyPoints?.[id] ?? id
              const room = data.rooms.find((r) => r.id === resolved)
              if (!room) return
              setFromId(room.id)
              setSelectedId(room.id)
              setFloor(room.floor)
              setScanOpen(false)
              bumpStat('scans')
              const url = new URL(window.location.href)
              url.searchParams.set('from', room.id)
              window.history.replaceState({}, '', url)
            }}
            onClose={() => setScanOpen(false)}
          />
        )}

        {evac && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-red-700/50 to-transparent p-4 text-center text-sm font-semibold text-white">
            Режим эвакуации · путь к ближайшему выходу
          </div>
        )}

        <motion.aside
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-panel absolute top-5 right-5 bottom-5 z-20 hidden w-[380px] rounded-3xl p-4 md:flex md:flex-col"
        >
          <NavPanel {...panelProps} />
        </motion.aside>

        <div className="absolute inset-x-0 bottom-0 z-20 md:hidden">
          <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="glass-panel flex w-full items-center gap-3 rounded-3xl px-4 py-3 text-left"
            >
              <Search className="size-5 text-primary" />
              <span className="text-sm font-semibold">Поиск и маршрут</span>
            </button>
          </div>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="h-[78vh] rounded-t-3xl p-4">
            <SheetHeader className="sr-only">
              <SheetTitle>Навигация</SheetTitle>
            </SheetHeader>
            <NavPanel {...panelProps} compact />
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
