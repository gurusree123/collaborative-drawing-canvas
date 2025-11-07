import { UndoRedoManager } from "./undo-redo-manager.js"

export class DrawingCanvas {
  constructor(canvasElement) {
    this.canvas = canvasElement
    this.ctx = this.canvas.getContext("2d")
    this.isDrawing = false
    this.currentTool = "brush"
    this.currentColor = "#000000"
    this.currentStrokeWidth = 3
    this.strokes = []
    this.currentStroke = null
    this.undoRedoManager = new UndoRedoManager()
    this.listeners = {}
    this.remoteCursors = new Map()
    this.requestAnimationFrameId = null
    this.offscreenCanvas = document.createElement("canvas")
    this.offscreenCtx = this.offscreenCanvas.getContext("2d")
    this.offscreenCanvas.width = this.canvas.width
    this.offscreenCanvas.height = this.canvas.height
    this.lastRenderTime = 0
    this.renderThrottleMs = 16 // ~60fps

    this.setupEventListeners()
    this.render()
  }

  setupEventListeners() {
    this.canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e))
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e))
    this.canvas.addEventListener("mouseup", () => this.handleMouseUp())
    this.canvas.addEventListener("mouseleave", () => this.handleMouseLeave())

    // Touch support
    this.canvas.addEventListener("touchstart", (e) => this.handleTouchStart(e))
    this.canvas.addEventListener("touchmove", (e) => this.handleTouchMove(e))
    this.canvas.addEventListener("touchend", () => this.handleMouseUp())

    // Keyboard shortcuts for undo/redo
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault()
        if (e.shiftKey) {
          this.redo()
        } else {
          this.undo()
        }
      }
    })
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect()
    return {
      x: (e.clientX || e.touches?.[0]?.clientX) - rect.left,
      y: (e.clientY || e.touches?.[0]?.clientY) - rect.top,
    }
  }

  handleMouseDown(e) {
    const pos = this.getMousePos(e)
    this.isDrawing = true
    this.currentStroke = {
      tool: this.currentTool,
      color: this.currentColor,
      strokeWidth: this.currentStrokeWidth,
      points: [pos],
      timestamp: Date.now(),
    }

    this.emit("cursor-move", { x: pos.x, y: pos.y })
  }

  handleMouseMove(e) {
    const pos = this.getMousePos(e)

    if (this.isDrawing && this.currentStroke) {
      this.currentStroke.points.push(pos)
      this.render()
    }

    this.emit("cursor-move", { x: pos.x, y: pos.y })
  }

  handleMouseUp() {
    if (this.isDrawing && this.currentStroke) {
      this.isDrawing = false
      this.strokes.push(this.currentStroke)
      this.undoRedoManager.pushToUndoStack(this.currentStroke)
      this.emit("stroke-end", this.currentStroke)
      this.currentStroke = null
    }
  }

  handleMouseLeave() {
    if (this.isDrawing) {
      this.handleMouseUp()
    }
  }

  handleTouchStart(e) {
    e.preventDefault()
    this.handleMouseDown(e)
  }

  handleTouchMove(e) {
    e.preventDefault()
    this.handleMouseMove(e)
  }

  setTool(tool) {
    this.currentTool = tool
  }

  setColor(color) {
    this.currentColor = color
  }

  setStrokeWidth(width) {
    this.currentStrokeWidth = width
  }

  drawStroke(stroke) {
    const { tool, color, strokeWidth, points } = stroke

    this.ctx.strokeStyle = color
    this.ctx.lineWidth = strokeWidth
    this.ctx.lineCap = "round"
    this.ctx.lineJoin = "round"

    if (tool === "eraser") {
      this.ctx.globalCompositeOperation = "destination-out"
      this.ctx.strokeStyle = "rgba(0,0,0,1)"
    } else {
      this.ctx.globalCompositeOperation = "source-over"
    }

    if (points.length > 0) {
      this.ctx.beginPath()

      if (points.length === 1) {
        this.ctx.moveTo(points[0].x, points[0].y)
        this.ctx.lineTo(points[0].x + 0.1, points[0].y)
      } else {
        this.ctx.moveTo(points[0].x, points[0].y)

        for (let i = 1; i < points.length; i++) {
          const xc = (points[i].x + points[i - 1].x) / 2
          const yc = (points[i].y + points[i - 1].y) / 2
          this.ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc)
        }

        this.ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
      }

      this.ctx.stroke()
    }

    this.ctx.globalCompositeOperation = "source-over"
  }

  receiveRemoteStroke(data) {
    const stroke = data.payload
    this.strokes.push(stroke)
    this.render()
  }

  render() {
    const now = Date.now()
    if (now - this.lastRenderTime < this.renderThrottleMs) {
      return
    }
    this.lastRenderTime = now

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.fillStyle = "#ffffff"
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    for (const stroke of this.strokes) {
      this.drawStroke(stroke)
    }

    if (this.currentStroke) {
      this.drawStroke(this.currentStroke)
    }

    this.drawRemoteCursors()
  }

  drawRemoteCursors() {
    for (const [userId, cursor] of this.remoteCursors) {
      const { x, y, color, name } = cursor

      this.ctx.fillStyle = color
      this.ctx.beginPath()
      this.ctx.arc(x, y, 6, 0, Math.PI * 2)
      this.ctx.fill()

      this.ctx.fillStyle = color
      this.ctx.font = "12px sans-serif"
      this.ctx.fillText(name, x + 10, y - 5)
    }
  }

  updateRemoteCursor(data) {
    const { userId, payload } = data
    if (!this.remoteCursors.has(userId)) {
      this.remoteCursors.set(userId, {})
    }
    const cursor = this.remoteCursors.get(userId)
    cursor.x = payload.x
    cursor.y = payload.y
  }

  undo() {
    const action = this.undoRedoManager.undo()
    if (action) {
      const index = this.strokes.indexOf(action)
      if (index > -1) {
        this.strokes.splice(index, 1)
      }
      this.render()
      this.emit("undo-executed")
      return action
    }
    return null
  }

  redo() {
    const action = this.undoRedoManager.redo()
    if (action) {
      this.strokes.push(action)
      this.render()
      this.emit("redo-executed")
      return action
    }
    return null
  }

  applyUndo(data) {
    const { event } = data.payload
    const index = this.strokes.findIndex((s) => s.timestamp === event.timestamp)
    if (index > -1) {
      this.strokes.splice(index, 1)
      this.render()
    }
  }

  applyRedo(data) {
    const { event } = data.payload
    this.strokes.push(event.payload)
    this.render()
  }

  clear() {
    this.strokes = []
    this.undoRedoManager.clear()
    this.render()
  }

  loadCanvasState(data) {
    const { events } = data.payload.canvasState
    this.strokes = events.filter((e) => e.type === "draw-stroke").map((e) => e.payload)
    this.render()
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
