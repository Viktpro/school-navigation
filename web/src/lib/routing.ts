import type {
  GraphEdge,
  GraphNode,
  Point,
  RouteResult,
  RouteStep,
  SchoolMapData,
} from '@/types/map'

function buildAdj(edges: GraphEdge[]) {
  const adj = new Map<string, { to: string; w: number; via?: string }[]>()
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, [])
    if (!adj.has(e.to)) adj.set(e.to, [])
    adj.get(e.from)!.push({ to: e.to, w: e.w, via: e.via })
    adj.get(e.to)!.push({ to: e.from, w: e.w, via: e.via })
  }
  return adj
}

export function findRoute(
  data: SchoolMapData,
  fromId: string,
  toId: string,
): RouteResult | null {
  if (fromId === toId) {
    const room = data.rooms.find((r) => r.id === fromId)
    if (!room) return null
    return {
      pathNodeIds: [fromId],
      steps: [
        {
          floor: room.floor,
          points: [room.door],
          hint: 'Вы уже на месте',
        },
      ],
      distanceM: 0,
      etaMin: 0,
      floors: [room.floor],
    }
  }

  const nodes = new Map(data.nodes.map((n) => [n.id, n]))
  if (!nodes.has(fromId) || !nodes.has(toId)) return null

  const adj = buildAdj(data.edges)
  const dist = new Map<string, number>()
  const prev = new Map<string, { id: string; via?: string }>()
  const pq: { id: string; d: number }[] = [{ id: fromId, d: 0 }]
  dist.set(fromId, 0)

  while (pq.length) {
    pq.sort((a, b) => a.d - b.d)
    const cur = pq.shift()!
    if (cur.d !== dist.get(cur.id)) continue
    if (cur.id === toId) break
    for (const edge of adj.get(cur.id) ?? []) {
      const nd = cur.d + edge.w
      if (nd < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, nd)
        prev.set(edge.to, { id: cur.id, via: edge.via })
        pq.push({ id: edge.to, d: nd })
      }
    }
  }

  if (!dist.has(toId)) return null

  const path: string[] = []
  const vias: (string | undefined)[] = []
  let cur: string | undefined = toId
  while (cur) {
    path.push(cur)
    const p = prev.get(cur)
    if (!p) break
    vias.push(p.via)
    cur = p.id
  }
  path.reverse()
  vias.reverse()

  const steps = buildSteps(path, vias, nodes, data)
  const distanceM = Math.round((dist.get(toId) ?? 0) * data.metersPerUnit)
  const etaMin = Math.max(1, Math.round(distanceM / 75))

  return {
    pathNodeIds: path,
    steps,
    distanceM,
    etaMin,
    floors: [...new Set(steps.map((s) => s.floor))],
  }
}

function buildSteps(
  path: string[],
  vias: (string | undefined)[],
  nodes: Map<string, GraphNode>,
  data: SchoolMapData,
): RouteStep[] {
  const steps: RouteStep[] = []
  let currentFloor = nodes.get(path[0])!.floor
  let points: Point[] = [[nodes.get(path[0])!.x, nodes.get(path[0])!.y]]
  let hintParts: string[] = []

  const roomName = (id: string) =>
    data.rooms.find((r) => r.id === id)?.name ?? id

  for (let i = 1; i < path.length; i++) {
    const node = nodes.get(path[i])!
    const via = vias[i - 1]
    if (node.floor !== currentFloor) {
      steps.push({
        floor: currentFloor,
        points,
        hint: hintParts.join(' · ') || `По этажу ${currentFloor}`,
        via,
      })
      const connector = via?.includes('elevator')
        ? 'лифтом'
        : 'по лестнице'
      const fromFloor = currentFloor
      currentFloor = node.floor
      points = [[node.x, node.y]]
      hintParts = [
        `Переход ${connector} с ${floorLabel(fromFloor)} на ${floorLabel(currentFloor)}`,
      ]
      continue
    }
    points.push([node.x, node.y])
    if (node.kind === 'room') {
      hintParts.push(`к «${roomName(node.id)}»`)
    }
  }

  steps.push({
    floor: currentFloor,
    points,
    hint: hintParts.join(' · ') || `По этажу ${currentFloor}`,
  })

  // Enrich first/last hints
  if (steps.length) {
    const start = roomName(path[0])
    const end = roomName(path[path.length - 1])
    steps[0].hint = `От «${start}»` + (steps[0].hint ? ` · ${steps[0].hint}` : '')
    const last = steps[steps.length - 1]
    last.hint = (last.hint ? `${last.hint} · ` : '') + `до «${end}»`
  }

  return steps
}

function floorLabel(f: number) {
  return f === 0 ? 'подвала' : `${f} этажа`
}

export function searchRooms(data: SchoolMapData, query: string) {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (!q) return data.rooms.filter((r) => r.kind !== 'stairs')

  return data.rooms
    .filter((r) => {
      const hay = [r.name, r.label, ...r.aliases, ...r.chips]
        .join(' ')
        .toLowerCase()
      return hay.includes(q) || q.split(' ').every((p) => hay.includes(p))
    })
    .sort((a, b) => {
      const as = a.name.toLowerCase().startsWith(q) ? 0 : 1
      const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1
      return as - bs || a.floor - b.floor || a.name.localeCompare(b.name, 'ru')
    })
}

export function roomsForChip(data: SchoolMapData, chipLabel: string) {
  return data.rooms.filter((r) => r.chips.includes(chipLabel))
}
