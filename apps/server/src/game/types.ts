import type Emittery from "emittery"
import type { WebSocket } from "ws"
import type { MessageSchema } from "@kado/schemas/server/message"

import type { MapDiscriminatedUnion, UnwrapField } from "../types/utility"

export type User = {
  id: string
  username: string
  score: number
  host: boolean
  master: boolean
  voted: boolean
  disconnected: boolean
  _whiteCards: string[]
  _socket: WebSocket
}

export type Session = {
  id: string
  state: "waiting" | "voting" | "choosing" | "end"
  users: User[]
  redCard: string | null
  votes: { card: string; userId: string; visible: boolean }[]
  _availableWhiteCards: string[]
  _availableRedCards: string[]
  _masterIndex: number
  _countdownTimer: NodeJS.Timeout | null
}

export type WithWebsocket<T> = {
  [K in keyof T]: T[K] extends undefined
    ? { socket: WebSocket }
    : T[K] & { socket: WebSocket }
}
export type Events = WithWebsocket<
  UnwrapField<MapDiscriminatedUnion<MessageSchema, "type">, "details">
>
export type Emitter = Emittery<Events>