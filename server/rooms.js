import { SyncManager } from "./sync-manager.js"
import { OperationTransform } from "./operation-transform.js"

export class RoomManager {
  constructor() {
    this.rooms = new Map()
  }

  joinRoom(roomId, userId, userData) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Room(roomId))
    }
    const room = this.rooms.get(roomId)
    room.addUser(userId, userData)
    return room
  }

  removeUserFromRoom(roomId, userId) {
    const room = this.rooms.get(roomId)
    if (room) {
      room.removeUser(userId)
      if (room.getUserCount() === 0) {
        this.rooms.delete(roomId)
      }
    }
  }

  getRoom(roomId) {
    return this.rooms.get(roomId)
  }
}

export class Room {
  constructor(roomId) {
    this.roomId = roomId
    this.users = new Map()
    this.syncManager = new SyncManager()
    this.opTransform = new OperationTransform()
    this.drawingEvents = []
    this.userUndoStacks = new Map() // Per-user undo stacks
    this.userRedoStacks = new Map() // Per-user redo stacks
    this.globalUndoStack = []
    this.globalRedoStack = []
    this.canvasState = {
      layers: [[]],
      currentLayerIndex: 0,
    }
  }

  addUser(userId, userData) {
    this.users.set(userId, { ...userData, joinedAt: Date.now() })
    // Initialize undo/redo stacks for each user
    this.userUndoStacks.set(userId, [])
    this.userRedoStacks.set(userId, [])
  }

  removeUser(userId) {
    this.users.delete(userId)
    this.userUndoStacks.delete(userId)
    this.userRedoStacks.delete(userId)
  }

  getUsers() {
    return Array.from(this.users.entries()).map(([id, data]) => ({
      id,
      ...data,
      ws: undefined, // Don't send WebSocket objects
    }))
  }

  getUserCount() {
    return this.users.size
  }

  addDrawingEvent(event) {
    const shouldBatch = this.syncManager.addEvent(event, event.userId)
    this.opTransform.addOperation(event)
    this.drawingEvents.push(event)

    // Add to global undo stack
    this.globalUndoStack.push(event)
    this.globalRedoStack = []

    // Add to user-specific undo stack
    if (this.userUndoStacks.has(event.userId)) {
      this.userUndoStacks.get(event.userId).push(event)
      this.userRedoStacks.get(event.userId).length = 0
    }

    return shouldBatch
  }

  getCanvasState() {
    return {
      events: this.drawingEvents,
      syncState: {
        eventCount: this.drawingEvents.length,
        lastUpdate: Date.now(),
      },
    }
  }

  undo(userId) {
    // First try user-specific undo
    if (this.userUndoStacks.has(userId)) {
      const userStack = this.userUndoStacks.get(userId)
      if (userStack.length > 0) {
        const event = userStack.pop()
        this.userRedoStacks.get(userId).push(event)
        // Remove from canvas
        const idx = this.drawingEvents.indexOf(event)
        if (idx > -1) {
          this.drawingEvents.splice(idx, 1)
        }
        this.globalUndoStack.push({ type: "undo", event, userId, timestamp: Date.now() })
        return { event, operation: "undo" }
      }
    }
    return null
  }

  redo(userId) {
    if (this.userRedoStacks.has(userId)) {
      const redoStack = this.userRedoStacks.get(userId)
      if (redoStack.length > 0) {
        const event = redoStack.pop()
        this.userUndoStacks.get(userId).push(event)
        // Restore to canvas
        this.drawingEvents.push(event)
        this.globalRedoStack.push({ type: "redo", event, userId, timestamp: Date.now() })
        return { event, operation: "redo" }
      }
    }
    return null
  }

  clearCanvas() {
    this.drawingEvents = []
    this.globalUndoStack = []
    this.globalRedoStack = []
    // Clear all user stacks
    for (const stack of this.userUndoStacks.values()) {
      stack.length = 0
    }
    for (const stack of this.userRedoStacks.values()) {
      stack.length = 0
    }
  }

  broadcast(message, excludeUserId = null) {
    this.users.forEach((userData) => {
      if (excludeUserId === null || userData.ws.userId !== excludeUserId) {
        if (userData.ws && userData.ws.readyState === 1) {
          userData.ws.send(JSON.stringify(message))
        }
      }
    })
  }
}

