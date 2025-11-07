import { PerformanceMonitor } from "./performance-monitor.js"

export class UIManager {
  constructor(drawingCanvas, wsClient) {
    this.drawingCanvas = drawingCanvas
    this.wsClient = wsClient
    this.users = new Map()
    this.perfMonitor = new PerformanceMonitor()

    this.setupToolbar()
    this.setupKeyboardShortcuts()
    this.setupPerformanceMonitoring()
    this.setupNotifications()
  }

  setupToolbar() {
    // Tool selection
    const brushBtn = document.getElementById("brush-tool")
    const eraserBtn = document.getElementById("eraser-tool")

    brushBtn.addEventListener("click", () => {
      this.setActiveTool(brushBtn, "brush")
      this.drawingCanvas.setTool("brush")
      this.showNotification("Switched to Brush", 1500)
    })

    eraserBtn.addEventListener("click", () => {
      this.setActiveTool(eraserBtn, "eraser")
      this.drawingCanvas.setTool("eraser")
      this.showNotification("Switched to Eraser", 1500)
    })

    // Color picker
    const colorPicker = document.getElementById("color-picker")
    colorPicker.addEventListener("change", (e) => {
      this.drawingCanvas.setColor(e.target.value)
      this.showNotification(`Color changed`, 1500)
    })

    // Stroke width
    const strokeWidth = document.getElementById("stroke-width")
    const strokeValue = document.getElementById("stroke-value")
    strokeWidth.addEventListener("input", (e) => {
      const width = e.target.value
      this.drawingCanvas.setStrokeWidth(width)
      strokeValue.textContent = `${width}px`
    })

    // Undo/Redo buttons
    const undoBtn = document.getElementById("undo-btn")
    const redoBtn = document.getElementById("redo-btn")

    undoBtn.addEventListener("click", () => {
      this.wsClient.sendUndo()
      this.drawingCanvas.undo()
      this.showNotification("Undo", 1000)
    })

    redoBtn.addEventListener("click", () => {
      this.wsClient.sendRedo()
      this.drawingCanvas.redo()
      this.showNotification("Redo", 1000)
    })

    // Clear canvas
    const clearBtn = document.getElementById("clear-btn")
    clearBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear the canvas?")) {
        this.wsClient.sendClearCanvas()
        this.drawingCanvas.clear()
        this.showNotification("Canvas cleared", 1500)
      }
    })

    const copyLinkBtn = document.getElementById("copy-link-btn")
    copyLinkBtn.addEventListener("click", () => {
      this.copyRoomLink()
    })
  }

  setupKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "b" || e.key === "B") {
        this.drawingCanvas.setTool("brush")
        document.getElementById("brush-tool").click()
      } else if (e.key === "e" || e.key === "E") {
        this.drawingCanvas.setTool("eraser")
        document.getElementById("eraser-tool").click()
      }
    })
  }

  setupPerformanceMonitoring() {
    setInterval(() => {
      this.perfMonitor.update(this.drawingCanvas.strokes.length)
      const metrics = this.perfMonitor.getMetrics()
      document.getElementById("fps-display").textContent = `FPS: ${metrics.fps}`
      document.getElementById("strokes-display").textContent = `Strokes: ${metrics.strokeCount}`

      const latency = this.wsClient.getLatency()
      document.getElementById("latency").textContent = latency || "--"
    }, 500)
  }

  setupNotifications() {
    // Can be extended with more notification types
  }

  showNotification(message, duration = 2000) {
    const notification = document.getElementById("notification")
    notification.textContent = message
    notification.className = "notification show"
    setTimeout(() => {
      notification.className = "notification"
    }, duration)
  }

  showErrorNotification(message, duration = 3000) {
    const notification = document.getElementById("notification")
    notification.textContent = message
    notification.className = "notification show error"
    setTimeout(() => {
      notification.className = "notification"
    }, duration)
  }

  setActiveTool(button, tool) {
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    button.classList.add("active")
  }

  addUser(data) {
    const { userId, userName, userColor } = data
    if (!this.users.has(userId)) {
      this.users.set(userId, { userName, userColor })
      this.updateUsersList()
      console.log(`[v0] User joined: ${userName}`)
      this.showNotification(`${userName} joined the room`)
    }
  }

  removeUser(userId) {
    const user = this.users.get(userId)
    if (user) {
      this.showNotification(`${user.userName} left the room`)
    }
    this.users.delete(userId)
    this.updateUsersList()
  }

  updateUsersList() {
    const usersList = document.getElementById("users-list")
    const userCount = document.getElementById("user-count")
    usersList.innerHTML = ""
    userCount.textContent = this.users.size

    this.users.forEach((user, userId) => {
      const userEl = document.createElement("div")
      userEl.className = "user-item"
      userEl.innerHTML = `
        <div class="user-color" style="background: ${user.userColor}"></div>
        <div class="user-name">${user.userName}</div>
        <div class="user-status">online</div>
      `
      usersList.appendChild(userEl)
    })
  }

  copyRoomLink() {
    const roomId = document.getElementById("room-id").textContent
    const url = `${window.location.origin}?room=${roomId}`

    navigator.clipboard
      .writeText(url)
      .then(() => {
        this.showNotification("Room link copied!")
      })
      .catch(() => {
        this.showErrorNotification("Failed to copy link")
      })
  }
}
