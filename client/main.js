import { DrawingCanvas } from "./canvas.js"
import { WebSocketClient } from "./websocket.js"
import { UIManager } from "./ui-manager.js"

// Initialize app
async function initApp() {
  const canvas = document.getElementById("canvas")
  const container = document.querySelector(".canvas-wrapper")

  // Set canvas size
  const resizeCanvas = () => {
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
  }
  resizeCanvas()
  window.addEventListener("resize", resizeCanvas)

  // Initialize components
  const drawingCanvas = new DrawingCanvas(canvas)
  const wsClient = new WebSocketClient("ws://localhost:8080")
  const uiManager = new UIManager(drawingCanvas, wsClient)

  // Connect and join room
  const roomId = new URLSearchParams(window.location.search).get("room") || "default"
  const userId = `user-${Math.random().toString(36).substr(2, 9)}`
  const userName = `User ${Math.floor(Math.random() * 1000)}`
  const userColor = `hsl(${Math.random() * 360}, 70%, 50%)`

  await wsClient.connect()
  wsClient.joinRoom(roomId, userId, userName, userColor)

  // Update UI
  document.getElementById("room-id").textContent = roomId
  document.getElementById("user-id").textContent = userId

  // Connect WebSocket to drawing canvas
  wsClient.on("draw-stroke", (data) => {
    if (data.userId !== userId) {
      drawingCanvas.receiveRemoteStroke(data)
    }
  })

  wsClient.on("undo", (data) => {
    drawingCanvas.applyUndo(data)
  })

  wsClient.on("redo", (data) => {
    drawingCanvas.applyRedo(data)
  })

  wsClient.on("clear-canvas", () => {
    drawingCanvas.clear()
  })

  wsClient.on("cursor-move", (data) => {
    drawingCanvas.updateRemoteCursor(data)
  })

  wsClient.on("canvas-state", (data) => {
    drawingCanvas.loadCanvasState(data)
  })

  wsClient.on("user-joined", (data) => {
    uiManager.addUser(data)
  })

  wsClient.on("user-disconnected", (data) => {
    uiManager.removeUser(data.userId)
  })

  // Handle local drawing
  drawingCanvas.on("stroke-end", (stroke) => {
    wsClient.sendStroke(stroke)
  })

  drawingCanvas.on("cursor-move", (cursor) => {
    wsClient.sendCursorMove(cursor)
  })
}

initApp().catch((err) => {
  console.error("[v0] Failed to initialize:", err)
  document.getElementById("notification").textContent = "Failed to initialize"
  document.getElementById("notification").className = "notification show error"
})
