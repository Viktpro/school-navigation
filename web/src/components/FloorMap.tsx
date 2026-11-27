import { motion } from 'motion/react'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { Point, Room, RouteStep, SchoolMapData } from '@/types/map'
import { cn } from '@/lib/utils'

interface Cam {
  x: number
  y: number
  w: number
  h: number
}

const WORLD = { x: 0, y: 0, w: 1200, h: 900 }

interface FloorMapProps {
  data: SchoolMapData
  floor: number
  iso: boolean
  selectedId: string | null
  fromId: string | null
  toId: string | null
  focusId: string | null
  routeStep: RouteStep | null
  evac?: boolean
  onSelect: (room: Room) => void
  className?: string
}

function polyPoints(poly: Point[]) {
  return poly.map((p) => p.join(',')).join(' ')
}

function clampCam(cam: Cam): Cam {
  const w = Math.min(WORLD.w, Math.max(220, cam.w))
  const h = w * (WORLD.h / WORLD.w)
  return {
    w,
    h,
    x: Math.min(WORLD.w - w, Math.max(0, cam.x)),
    y: Math.min(WORLD.h - h, Math.max(0, cam.y)),
  }
}

function camAround(pt: Point, zoom = 460): Cam {
  const w = zoom
  const h = w * (WORLD.h / WORLD.w)
  return clampCam({ x: pt[0] - w / 2, y: pt[1] - h / 2, w, h })
}

export function FloorMap({
  data,
  floor,
  iso,
  selectedId,
  fromId,
  toId,
  focusId,
  routeStep,
  evac,
  onSelect,
  className,
}: FloorMapProps) {
  const host = useRef<HTMLDivElement>(null)
  const camRef = useRef<Cam>(WORLD)
  const targetRef = useRef<Cam>(WORLD)
  const [cam, setCam] = useState<Cam>(WORLD)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const drag = useRef<{ x: number; y: number; cam: Cam } | null>(null)

  const rooms = useMemo(
    () => data.rooms.filter((r) => r.floor === floor && !r.technical),
    [data.rooms, floor],
  )
  const walls = data.walls?.[String(floor)] ?? []
  const focus =
    data.rooms.find((r) => r.id === focusId && r.floor === floor) ?? null

  useEffect(() => {
    const dest = focus ? camAround(focus.center, 480) : WORLD
    targetRef.current = dest
  }, [focus, floor])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const c = camRef.current
      const t = targetRef.current
      const n = clampCam({
        x: c.x + (t.x - c.x) * 0.14,
        y: c.y + (t.y - c.y) * 0.14,
        w: c.w + (t.w - c.w) * 0.14,
        h: c.h + (t.h - c.h) * 0.14,
      })
      camRef.current = n
      setCam(n)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const toWorld = (clientX: number, clientY: number) => {
    const rect = host.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const c = camRef.current
    return {
      x: c.x + ((clientX - rect.left) / rect.width) * c.w,
      y: c.y + ((clientY - rect.top) / rect.height) * c.h,
    }
  }

  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault()
    const c = camRef.current
    const factor = e.deltaY > 0 ? 1.12 : 0.88
    const cursor = toWorld(e.clientX, e.clientY)
    const w = c.w * factor
    const h = w * (WORLD.h / WORLD.w)
    const nx = cursor.x - ((cursor.x - c.x) / c.w) * w
    const ny = cursor.y - ((cursor.y - c.y) / c.h) * h
    const next = clampCam({ x: nx, y: ny, w, h })
    camRef.current = next
    targetRef.current = next
    setCam(next)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    drag.current = { x: e.clientX, y: e.clientY, cam: { ...camRef.current } }
  }
  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag.current || !pointers.current.has(e.pointerId)) return
    const rect = host.current?.getBoundingClientRect()
    if (!rect) return
    const dx = ((e.clientX - drag.current.x) / rect.width) * drag.current.cam.w
    const dy = ((e.clientY - drag.current.y) / rect.height) * drag.current.cam.h
    const next = clampCam({
      ...drag.current.cam,
      x: drag.current.cam.x - dx,
      y: drag.current.cam.y - dy,
    })
    camRef.current = next
    targetRef.current = next
    setCam(next)
  }
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size === 0) drag.current = null
  }

  const recenter = () => {
    targetRef.current = WORLD
  }
  const zoomBy = (factor: number) => {
    const c = camRef.current
    const w = c.w * factor
    const next = clampCam({
      x: c.x + (c.w - w) / 2,
      y: c.y + (c.h - w * (WORLD.h / WORLD.w)) / 2,
      w,
      h: w * (WORLD.h / WORLD.w),
    })
    targetRef.current = next
  }

  const routeD =
    routeStep && routeStep.floor === floor && routeStep.points.length > 1
      ? routeStep.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`)
          .join(' ')
      : null

  const dim = Boolean(selectedId || toId)

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ perspective: '1600px' }}
      >
        <motion.div
          className="h-full w-full"
          animate={{
            rotateX: iso ? 50 : 0,
            rotateZ: iso ? -8 : 0,
            scale: iso ? 0.86 : 1,
            y: iso ? 24 : 0,
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div
            ref={host}
            className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
            onWheel={onWheel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <svg viewBox={`${cam.x} ${cam.y} ${cam.w} ${cam.h}`} className="h-full w-full">
              <defs>
                <filter id="roomGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="6" result="b" />
                  <feMerge>
                    <feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="floorWash" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(0.45 0.12 262 / 0.18)" />
                  <stop offset="100%" stopColor="oklch(0.78 0.12 85 / 0.12)" />
                </linearGradient>
              </defs>
              <rect x={0} y={0} width={1200} height={900} fill="var(--map-floor)" />
              <rect x={0} y={0} width={1200} height={900} fill="url(#floorWash)" />
              {iso && (
                <polygon
                  points={polyPoints(data.outline)}
                  transform="translate(10 16)"
                  fill="oklch(0.25 0.05 262 / 0.28)"
                />
              )}
              <polygon
                points={polyPoints(data.outline)}
                fill="var(--map-corridor)"
                stroke="var(--map-wall)"
                strokeWidth={iso ? 4 : 2.4}
              />
              {walls.map((w, i) => (
                <line
                  key={i}
                  x1={w[0]}
                  y1={w[1]}
                  x2={w[2]}
                  y2={w[3]}
                  stroke="var(--map-wall)"
                  strokeWidth={iso ? 2.4 : 1.3}
                  strokeLinecap="round"
                  opacity={0.8}
                />
              ))}
              {rooms.map((room) => {
                const active =
                  room.id === selectedId || room.id === fromId || room.id === toId
                const faded = dim && !active
                return (
                  <g
                    key={room.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelect(room)
                    }}
                  >
                    <motion.polygon
                      points={polyPoints(room.polygon)}
                      animate={{
                        opacity: faded ? 0.28 : 1,
                        fill: active
                          ? evac
                            ? 'oklch(0.78 0.16 155)'
                            : 'var(--map-room-active)'
                          : room.kind === 'stairs' || room.kind === 'elevator'
                            ? 'var(--map-stairs)'
                            : room.chips.length || room.kind === 'zone'
                              ? 'var(--map-special)'
                              : 'var(--map-room)',
                      }}
                      stroke={active ? 'oklch(0.78 0.14 85)' : 'var(--map-wall)'}
                      strokeWidth={active ? 3 : 1.1}
                      filter={active ? 'url(#roomGlow)' : undefined}
                    />
                    {!faded && (
                      <text
                        x={room.center[0]}
                        y={room.center[1]}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--foreground)"
                        fontSize={room.kind === 'classroom' ? 12 : 11}
                        fontWeight={700}
                        className="pointer-events-none select-none"
                      >
                        {shortLabel(room)}
                      </text>
                    )}
                    {active && (
                      <g>
                        <motion.circle
                          cx={room.center[0]}
                          cy={room.center[1] - 28}
                          r={4}
                          fill="oklch(0.78 0.14 85)"
                          animate={{ y: [0, -6, 0] }}
                          transition={{ repeat: Infinity, duration: 1.6 }}
                        />
                        <motion.g
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <rect
                            x={room.center[0] - 54}
                            y={room.center[1] - 52}
                            width={108}
                            height={22}
                            rx={11}
                            fill="oklch(0.22 0.06 262 / 0.9)"
                          />
                          <text
                            x={room.center[0]}
                            y={room.center[1] - 37}
                            textAnchor="middle"
                            fill="oklch(0.96 0.02 95)"
                            fontSize="10"
                            fontWeight={700}
                          >
                            {room.name.length > 16
                              ? room.name.slice(0, 15) + '…'
                              : room.name}
                          </text>
                        </motion.g>
                      </g>
                    )}
                  </g>
                )
              })}
              {routeD && <LivingRoute d={routeD} evac={evac} />}
              {fromId && rooms.some((r) => r.id === fromId) && (
                <HereBeacon
                  x={rooms.find((r) => r.id === fromId)!.center[0]}
                  y={rooms.find((r) => r.id === fromId)!.center[1]}
                />
              )}
            </svg>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-24 left-20 z-10 flex flex-col gap-2 md:bottom-6 md:left-24">
        <Fab label="+" onClick={() => zoomBy(0.82)} />
        <Fab label="−" onClick={() => zoomBy(1.18)} />
        <Fab label="⌖" onClick={recenter} />
      </div>
    </div>
  )
}

function LivingRoute({ d, evac }: { d: string; evac?: boolean }) {
  const ref = useRef<SVGPathElement>(null)
  const [orb, setOrb] = useState({ x: 0, y: 0 })
  useEffect(() => {
    const path = ref.current
    if (!path) return
    const len = path.getTotalLength()
    let raf = 0
    const start = performance.now()
    const loop = (t: number) => {
      const p = ((t - start) / 1600) % 1
      const pt = path.getPointAtLength(len * p)
      setOrb({ x: pt.x, y: pt.y })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [d])
  const color = evac ? 'oklch(0.78 0.17 155)' : 'oklch(0.62 0.2 25)'
  return (
    <g>
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: 'easeInOut' }}
        opacity={0.95}
      />
      <path
        ref={ref}
        d={d}
        fill="none"
        stroke="oklch(0.9 0.12 85)"
        strokeWidth={3}
        strokeDasharray="10 16"
        strokeLinecap="round"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-52"
          dur="0.9s"
          repeatCount="indefinite"
        />
      </path>
      <circle cx={orb.x} cy={orb.y} r={7} fill="oklch(0.9 0.14 85)" />
      <polygon
        points={`${orb.x},${orb.y - 11} ${orb.x + 6},${orb.y - 2} ${orb.x - 6},${orb.y - 2}`}
        fill="white"
      />
    </g>
  )
}

function HereBeacon({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <motion.circle
        cx={x}
        cy={y}
        fill="oklch(0.62 0.16 155 / 0.35)"
        animate={{ r: [10, 26, 10] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
      <circle cx={x} cy={y} r={7} fill="oklch(0.62 0.16 155)" stroke="white" strokeWidth={2} />
    </g>
  )
}

function shortLabel(room: Room) {
  if (room.kind === 'stairs') return 'Лс'
  if (room.kind === 'elevator') return 'Лифт'
  if (room.kind === 'toilet') return 'WC'
  const m = room.name.match(/[А-ЯA-Z]\d{3}|\d{3}/)
  if (m && room.kind === 'classroom') return m[0]
  if (room.name.length > 14) return room.name.slice(0, 12) + '…'
  return room.name
}

function Fab({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 420, damping: 18 }}
      className="glass-panel flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold"
    >
      {label}
    </motion.button>
  )
}
