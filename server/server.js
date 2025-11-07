import express from "express"
import { WebSocketServer } from "ws"
import { createServer } from "http"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { RoomManager } from "./rooms.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ server })

// Serve static files from client directory
app.use(express.static(join(__dirname, "../client")))

const roomManager = new RoomManager()

wss.on("connection", (ws) => {
  const userId = null
  const roomId = null

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data)
      handleMessage(ws, message, roomManager)
    } catch (err) {
      console.error("[v0] Failed to parse message:", err)
    }
  })

  ws.on("close", () => {
    if (roomId && userId) {
      roomManager.removeUserFromRoom(roomId, userId)
      const room = roomManager.getRoom(roomId)
      if (room) {
        // Notify other users that someone disconnected
        room.broadcast(
          {
            type: "user-disconnected",
            userId,
          },
          null,
        )
      }
    }
  })

  ws.on("error", (err) => {
    console.error("[v0] WebSocket error:", err)
  })

  // Store WebSocket reference for sending messages
  ws.userId = userId
  ws.roomId = roomId
})

function handleMessage(ws, message, roomManager) {
  const { type, roomId: msgRoomId, userId: msgUserId, payload } = message

  if (type === "join-room") {
    const { roomId, userId, userName, userColor } = payload
    ws.userId = userId
    ws.roomId = roomId

    const room = roomManager.joinRoom(roomId, userId, {
      userName,
      userColor,
      ws,
    })

    // Send current canvas state to new user
    ws.send(
      JSON.stringify({
        type: "canvas-state",
        payload: {
          canvasState: room.getCanvasState(),
          users: room.getUsers(),
        },
      }),
    )

    // Notify other users about new user
    room.broadcast(
      {
        type: "user-joined",
        payload: {
          userId,
          userName,
          userColor,
        },
      },
      userId,
    )
  } else if (type === "ping") {
    ws.send(JSON.stringify({ type: "pong" }))
  } else if (ws.roomId && ws.userId) {
    const room = roomManager.getRoom(ws.roomId)
    if (room) {
      if (type === "draw-stroke") {
        room.addDrawingEvent({
          type: "draw-stroke",
          userId: ws.userId,
          timestamp: Date.now(),
          payload,
        })
        room.broadcast(
          {
            type: "draw-stroke",
            userId: ws.userId,
            payload,
          },
          ws.userId,
        )
      } else if (type === "cursor-move") {
        room.broadcast(
          {
            type: "cursor-move",
            userId: ws.userId,
            payload,
          },
          ws.userId,
        )
      } else if (type === "undo") {
        const undoResult = room.undo(ws.userId)
        if (undoResult) {
          room.broadcast({
            type: "undo",
            userId: ws.userId,
            payload: undoResult,
          })
        }
      } else if (type === "redo") {
        const redoResult = room.redo(ws.userId)
        if (redoResult) {
          room.broadcast({
            type: "redo",
            userId: ws.userId,
            payload: redoResult,
          })
        }
      } else if (type === "clear-canvas") {
        room.clearCanvas()
        room.broadcast({
          type: "clear-canvas",
        })
      }
    }
  }
}

const PORT = process.env.PORT || 8080
server.listen(PORT, () => {
  console.log(`[v0] Server running on http://localhost:${PORT}`)
})
