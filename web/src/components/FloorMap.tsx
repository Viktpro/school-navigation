import { motion } from 'motion/react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import type { Point, Room, RouteStep, SchoolMapData } from '@/types/map'
import { cn } from '@/lib/utils'

interface FloorMapProps {
  data: SchoolMapData
  floor: number
  selectedId: string | null
  fromId: string | null
  toId: string | null
  routeStep: RouteStep | null
  highlightedIds: Set<string>
  onSelect: (room: Room) => void
  className?: string
}

function polyPoints(poly: Point[]) {
  return poly.map((p) => p.join(',')).join(' ')
}

export function FloorMap({
  data,
  floor,
  selectedId,
  fromId,
  toId,
  routeStep,
  highlightedIds,
  onSelect,
  className,
}: FloorMapProps) {
  const [vb, vy, vw, vh] = data.viewBox
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; k: number } | null>(null)
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  )

  const rooms = useMemo(
    () =>
      data.rooms.filter(
        (r) =>
          r.floor === floor &&
          !r.id.endsWith('-cloak-girls') &&
          !r.id.endsWith('-cloak-boys'),
      ),
    [data.rooms, floor],
  )
  const corridors = data.corridors[String(floor)] ?? []

  const recenter = useCallback(() => {
    setTransform({ x: 0, y: 0, k: 1 })
  }, [])

  useEffect(() => {
    recenter()
  }, [floor, recenter])

  const zoomBy = (factor: number, cx?: number, cy?: number) => {
    setTransform((t) => {
      const nk = Math.min(4, Math.max(0.55, t.k * factor))
      if (cx == null || cy == null || !containerRef.current) {
        return { ...t, k: nk }
      }
      const rect = containerRef.current.getBoundingClientRect()
      const px = cx - rect.left - rect.width / 2
      const py = cy - rect.top - rect.height / 2
      const ratio = nk / t.k
      return {
        k: nk,
        x: px - (px - t.x) * ratio,
        y: py - (py - t.y) * ratio,
      }
    })
  }

  const onWheel = (e: ReactWheelEvent) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    zoomBy(factor, e.clientX, e.clientY)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1) {
      drag.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.x,
        ty: transform.y,
      }
    } else if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      pinch.current = { dist, k: transform.k }
      drag.current = null
    }
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2 && pinch.current) {
      const pts = [...pointers.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const factor = dist / pinch.current.dist
      const nk = Math.min(4, Math.max(0.55, pinch.current.k * factor))
      setTransform((t) => ({ ...t, k: nk }))
      return
    }
    if (drag.current && pointers.current.size === 1) {
      setTransform((t) => ({
        ...t,
        x: drag.current!.tx + (e.clientX - drag.current!.x),
        y: drag.current!.ty + (e.clientY - drag.current!.y),
      }))
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  const routePath =
    routeStep && routeStep.floor === floor && routeStep.points.length > 1
      ? routeStep.points.map((p) => p.join(',')).join(' ')
      : null

  const startPt =
    fromId && rooms.find((r) => r.id === fromId)?.center
  const endPt = toId && rooms.find((r) => r.id === toId)?.center

  return (
    <div className={cn('relative h-full w-full overflow-hidden', className)}>
      <div
        ref={containerRef}
        className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <svg
          viewBox={`${vb} ${vy} ${vw} ${vh}`}
          className="h-full w-full"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
            transformOrigin: 'center center',
          }}
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.06"
                strokeWidth="1"
              />
            </pattern>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <rect
            x={0}
            y={0}
            width={vw}
            height={vh}
            fill="var(--map-floor)"
          />
          <rect x={0} y={0} width={vw} height={vh} fill="url(#grid)" />

          <polygon
            points={polyPoints(data.outline)}
            fill="var(--map-corridor)"
            stroke="var(--map-wall)"
            strokeWidth="3"
            opacity="0.9"
          />

          {corridors.map((c, i) => (
            <polygon
              key={i}
              points={polyPoints(c)}
              fill="var(--map-corridor)"
              opacity="0.85"
            />
          ))}

          {rooms.map((room) => {
            const active =
              room.id === selectedId ||
              room.id === fromId ||
              room.id === toId ||
              highlightedIds.has(room.id)
            const special =
              room.kind === 'zone' ||
              room.kind === 'toilet' ||
              room.chips.length > 0
            const isStairs =
              room.kind === 'stairs' || room.kind === 'elevator'
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
                  initial={false}
                  animate={{
                    fill: active
                      ? 'var(--map-room-active)'
                      : isStairs
                        ? 'var(--map-stairs)'
                        : special
                          ? 'var(--map-special)'
                          : 'var(--map-room)',
                  }}
                  stroke="var(--map-wall)"
                  strokeWidth={active ? 2.5 : 1.2}
                  className="transition-[filter] duration-200"
                  style={{
                    filter: active ? 'url(#softGlow)' : undefined,
                  }}
                  whileHover={{ opacity: 0.92 }}
                />
                <text
                  x={room.center[0]}
                  y={room.center[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  fill="var(--foreground)"
                  fontSize={
                    room.kind === 'classroom'
                      ? 11
                      : room.name.length > 14
                        ? 10
                        : 12
                  }
                  fontWeight={600}
                  opacity={0.85}
                >
                  {shortLabel(room)}
                </text>
              </g>
            )
          })}

          {routePath && (
            <motion.polyline
              key={`${floor}-${routePath}`}
              points={routePath}
              fill="none"
              stroke="var(--map-route)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0.4 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.9, ease: 'easeInOut' }}
              filter="url(#softGlow)"
            />
          )}

          {startPt && fromId && rooms.some((r) => r.id === fromId) && (
            <PulseMarker x={startPt[0]} y={startPt[1]} color="#16a34a" label="A" />
          )}
          {endPt && toId && rooms.some((r) => r.id === toId) && (
            <PulseMarker x={endPt[0]} y={endPt[1]} color="#dc2626" label="B" />
          )}
        </svg>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-background/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background/40 to-transparent md:h-16" />

      <div className="absolute bottom-24 right-3 z-10 flex flex-col gap-2 md:bottom-6 md:right-6">
        <MapFab label="+" onClick={() => zoomBy(1.2)} />
        <MapFab label="−" onClick={() => zoomBy(1 / 1.2)} />
        <MapFab label="⌖" onClick={recenter} title="Центрировать" />
      </div>
    </div>
  )
}

function shortLabel(room: Room) {
  if (room.kind === 'stairs') return 'Лс'
  if (room.kind === 'elevator') return 'Лифт'
  if (room.kind === 'toilet') return 'WC'
  const m = room.name.match(/[А-ЯA-Z]\d{3}|\d{3}/)
  if (m && room.kind === 'classroom') return m[0]
  if (room.name.length > 16) return room.name.slice(0, 14) + '…'
  return room.name
}

function PulseMarker({
  x,
  y,
  color,
  label,
}: {
  x: number
  y: number
  color: string
  label: string
}) {
  return (
    <g>
      <motion.circle
        cx={x}
        cy={y}
        r={14}
        fill={color}
        opacity={0.25}
        animate={{ r: [12, 22, 12], opacity: [0.35, 0.05, 0.35] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      />
      <circle cx={x} cy={y} r={9} fill={color} stroke="#fff" strokeWidth={2} />
      <text
        x={x}
        y={y + 1}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontSize="10"
        fontWeight="700"
      >
        {label}
      </text>
    </g>
  )
}

function MapFab({
  label,
  onClick,
  title,
}: {
  label: string
  onClick: () => void
  title?: string
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      className="glass-panel flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-semibold text-foreground transition hover:scale-105 active:scale-95"
    >
      {label}
    </button>
  )
}
