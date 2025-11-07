export class WebSocketClient {
  constructor(url) {
    this.url = url
    this.ws = null
    this.listeners = {}
    this.messageQueue = []
    this.isConnected = false
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000
    this.latency = 0
    this.lastPingTime = 0
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.isConnected = true
          this.reconnectAttempts = 0
          document.getElementById("connection-status").textContent = "Connected"
          document.getElementById("connection-status").className = "status connected"
          this.flushMessageQueue()
          this.startLatencyTracking()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === "pong") {
              this.latency = Date.now() - this.lastPingTime
            }
            this.handleMessage(message)
          } catch (err) {
            console.error("[v0] Failed to parse WebSocket message:", err)
          }
        }

        this.ws.onerror = (err) => {
          console.error("[v0] WebSocket error:", err)
          reject(err)
        }

        this.ws.onclose = () => {
          this.isConnected = false
          this.stopLatencyTracking()
          document.getElementById("connection-status").textContent = "Disconnected"
          document.getElementById("connection-status").className = "status"
          this.attemptReconnect()
        }
      } catch (err) {
        reject(err)
      }
    })
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)
      console.log(`[v0] Reconnecting in ${delay}ms...`)
      setTimeout(() => this.connect().catch(() => {}), delay)
    }
  }

  startLatencyTracking() {
    this.latencyInterval = setInterval(() => {
      if (this.isConnected) {
        this.lastPingTime = Date.now()
        this.send({ type: "ping" })
      }
    }, 5000) // Ping every 5 seconds
  }

  stopLatencyTracking() {
    if (this.latencyInterval) {
      clearInterval(this.latencyInterval)
    }
  }

  getLatency() {
    return this.latency
  }

  handleMessage(message) {
    const { type, payload } = message
    this.emit(type, message)
  }

  send(message) {
    if (this.isConnected) {
      this.ws.send(JSON.stringify(message))
    } else {
      this.messageQueue.push(message)
    }
  }

  flushMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()
      this.send(message)
    }
  }

  joinRoom(roomId, userId, userName, userColor) {
    this.send({
      type: "join-room",
      payload: { roomId, userId, userName, userColor },
    })
  }

  sendStroke(stroke) {
    this.send({
      type: "draw-stroke",
      payload: stroke,
    })
  }

  sendCursorMove(cursor) {
    this.send({
      type: "cursor-move",
      payload: cursor,
    })
  }

  sendUndo() {
    this.send({ type: "undo" })
  }

  sendRedo() {
    this.send({ type: "redo" })
  }

  sendClearCanvas() {
    this.send({ type: "clear-canvas" })
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((callback) => callback(data))
    }
  }
}
