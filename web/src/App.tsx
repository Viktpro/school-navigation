import { motion } from 'motion/react'
import { Moon, Search, Sun } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { FloorMap } from '@/components/FloorMap'
import { FloorSwitcher } from '@/components/FloorSwitcher'
import { NavPanel } from '@/components/NavPanel'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/useTheme'
import { findRoute } from '@/lib/routing'
import type { Room, SchoolMapData } from '@/types/map'
import mapData from '@/data/school-map.json'

const data = mapData as unknown as SchoolMapData

export default function App() {
  const { theme, toggle } = useTheme()
  const [floor, setFloor] = useState(1)
  const [fromId, setFromId] = useState<string | null>(data.defaultFromId)
  const [toId, setToId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)

  const route = useMemo(() => {
    if (!fromId || !toId) return null
    return findRoute(data, fromId, toId)
  }, [fromId, toId])

  useEffect(() => {
    setActiveStep(0)
    if (route?.steps[0]) setFloor(route.steps[0].floor)
  }, [route])

  const routeStep = route?.steps[activeStep] ?? null
  const highlighted = useMemo(() => {
    const ids = new Set<string>()
    if (fromId) ids.add(fromId)
    if (toId) ids.add(toId)
    if (selectedId) ids.add(selectedId)
    return ids
  }, [fromId, toId, selectedId])

  const onSelectRoom = (room: Room) => {
    setSelectedId(room.id)
    if (!fromId) {
      setFromId(room.id)
      return
    }
    if (!toId || fromId === room.id) {
      setToId(room.id)
      return
    }
    setToId(room.id)
  }

  const panelProps = {
    data,
    fromId,
    toId,
    selectedId,
    route,
    activeStep,
    onFromChange: setFromId,
    onToChange: setToId,
    onSelectRoom,
    onSwap: () => {
      setFromId(toId)
      setToId(fromId)
    },
    onClearRoute: () => {
      setToId(null)
      setActiveStep(0)
    },
    onStepJump: (index: number) => {
      if (!route) return
      setActiveStep(index)
      setFloor(route.steps[index].floor)
    },
    onFloorHint: setFloor,
  }

  return (
    <TooltipProvider>
      <div className="relative h-full w-full overflow-hidden">
        <FloorMap
          data={data}
          floor={floor}
          selectedId={selectedId}
          fromId={fromId}
          toId={toId}
          routeStep={routeStep}
          highlightedIds={highlighted}
          onSelect={onSelectRoom}
          className="md:pr-[400px]"
        />

        {/* Brand + theme */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel absolute top-3 left-3 z-20 flex items-center gap-3 rounded-2xl px-3 py-2 md:top-5 md:left-5"
        >
          <div>
            <p className="font-display text-lg leading-none md:text-xl">
              {data.school.brand}
            </p>
            <p className="text-[11px] text-muted-foreground md:text-xs">
              Indoor · {data.school.name}
            </p>
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            onClick={toggle}
            aria-label="Тема"
          >
            {theme === 'dark' ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
          </Button>
        </motion.header>

        {/* Floor switcher */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-24 left-3 z-20 md:top-28 md:left-5"
        >
          <FloorSwitcher
            floors={data.floors}
            current={floor}
            routeFloors={route?.floors}
            onChange={setFloor}
          />
        </motion.div>

        {/* Desktop floating panel */}
        <motion.aside
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-panel absolute top-5 right-5 bottom-5 z-20 hidden w-[380px] rounded-3xl p-4 md:flex md:flex-col"
        >
          <NavPanel {...panelProps} />
        </motion.aside>

        {/* Mobile search FAB / bottom sheet trigger */}
        <div className="absolute inset-x-0 bottom-0 z-20 md:hidden">
          <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="glass-panel flex w-full items-center gap-3 rounded-3xl px-4 py-3.5 text-left"
            >
              <span className="flex size-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Search className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">
                  Поиск и маршрут
                </span>
                <span className="block text-xs text-muted-foreground">
                  {toId
                    ? `Куда: ${data.rooms.find((r) => r.id === toId)?.name}`
                    : 'Кабинет, столовая, гардероб…'}
                </span>
              </span>
            </button>
          </div>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[85vh] rounded-t-3xl border-border/60 bg-popover/95 p-4 backdrop-blur-xl md:hidden"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Навигация</SheetTitle>
            </SheetHeader>
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border" />
            <div className="h-[70vh]">
              <NavPanel {...panelProps} compact />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </TooltipProvider>
  )
}
