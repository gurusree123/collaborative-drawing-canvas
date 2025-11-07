export class UndoRedoManager {
  constructor() {
    this.undoStack = []
    this.redoStack = []
    this.maxStackSize = 100 // Limit to prevent memory bloat
  }

  pushToUndoStack(action) {
    if (this.undoStack.length >= this.maxStackSize) {
      this.undoStack.shift() // Remove oldest action
    }
    this.undoStack.push(action)
    this.redoStack = [] // Clear redo stack
  }

  undo() {
    if (this.undoStack.length === 0) return null
    const action = this.undoStack.pop()
    this.redoStack.push(action)
    return action
  }

  redo() {
    if (this.redoStack.length === 0) return null
    const action = this.redoStack.pop()
    this.undoStack.push(action)
    return action
  }

  canUndo() {
    return this.undoStack.length > 0
  }

  canRedo() {
    return this.redoStack.length > 0
  }

  getStackSize() {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length,
    }
  }

  clear() {
    this.undoStack = []
    this.redoStack = []
  }
}
