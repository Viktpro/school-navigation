export type RoomKind =
  | 'classroom'
  | 'zone'
  | 'stairs'
  | 'elevator'
  | 'toilet'
  | 'corridor'

export type Point = [number, number]

export interface Room {
  id: string
  name: string
  label: string
  floor: number
  kind: RoomKind
  aliases: string[]
  chips: string[]
  polygon: Point[]
  center: Point
  door: Point
  hidden?: boolean
  technical?: boolean
  exit?: boolean
}

export interface FloorMeta {
  id: number
  name: string
  short: string
}

export interface GraphNode {
  id: string
  floor: number
  x: number
  y: number
  kind: string
  roomId?: string
}

export interface GraphEdge {
  from: string
  to: string
  w: number
  via?: string
}

export interface QuickChip {
  id: string
  label: string
  match: string[]
}

export interface SchoolMapData {
  school: {
    name: string
    city: string
    brand: string
  }
  viewBox: [number, number, number, number]
  metersPerUnit: number
  defaultFromId: string
  floors: FloorMeta[]
  outline: Point[]
  corridors: Record<string, Point[][]>
  walls?: Record<string, number[][]>
  rooms: Room[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  quickChips: QuickChip[]
}

export interface RouteStep {
  floor: number
  points: Point[]
  hint: string
  via?: string
}

export interface RouteResult {
  pathNodeIds: string[]
  steps: RouteStep[]
  distanceM: number
  etaMin: number
  floors: number[]
}
