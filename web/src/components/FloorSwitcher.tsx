import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { FloorMeta } from '@/types/map'

interface FloorSwitcherProps {
  floors: FloorMeta[]
  current: number
  routeFloors?: number[]
  onChange: (floor: number) => void
}

export function FloorSwitcher({
  floors,
  current,
  routeFloors = [],
  onChange,
}: FloorSwitcherProps) {
  return (
    <div className="glass-panel flex flex-col gap-1 rounded-2xl p-1.5">
      {[...floors].reverse().map((floor) => {
        const active = floor.id === current
        const onRoute = routeFloors.includes(floor.id)
        return (
          <button
            key={floor.id}
            type="button"
            onClick={() => onChange(floor.id)}
            className={cn(
              'relative flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold transition',
              active
                ? 'text-primary-foreground'
                : 'text-foreground/80 hover:bg-secondary/70',
            )}
            aria-label={floor.name}
            title={floor.name}
          >
            {active && (
              <motion.span
                layoutId="floor-pill"
                className="absolute inset-0 rounded-xl bg-primary shadow-sm"
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              />
            )}
            <span className="relative z-10">{floor.short}</span>
            {onRoute && !active && (
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-[var(--map-route)]" />
            )}
          </button>
        )
      })}
    </div>
  )
}
