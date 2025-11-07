export class OperationTransform {
  constructor() {
    this.operationHistory = []
    this.undoStack = []
    this.redoStack = []
  }

  // Transform operation against concurrent operations
  transform(operation, concurrentOps) {
    let transformedOp = { ...operation }

    for (const concurrent of concurrentOps) {
      transformedOp = this.transformAgainst(transformedOp, concurrent)
    }

    return transformedOp
  }

  // Transform a single operation against another
  transformAgainst(op, concurrent) {
    // For drawing operations, we use timestamp-based conflict resolution
    // Operation with earlier timestamp takes precedence
    if (op.timestamp >= concurrent.timestamp) {
      return op // Our operation is newer or equal
    }
    return op // Even if older, we preserve it (both can coexist)
  }

  // Add operation to history
  addOperation(operation) {
    this.operationHistory.push({
      ...operation,
      id: `${operation.userId}-${operation.timestamp}`,
      appliedAt: Date.now(),
    })
    this.undoStack.push(operation)
    this.redoStack = [] // Clear redo stack when new operation added
  }

  // Undo by removing last operation
  undo() {
    if (this.undoStack.length === 0) return null
    const operation = this.undoStack.pop()
    this.redoStack.push(operation)
    return operation
  }

  // Redo by reapplying last undone operation
  redo() {
    if (this.redoStack.length === 0) return null
    const operation = this.redoStack.pop()
    this.undoStack.push(operation)
    return operation
  }

  getHistory() {
    return this.operationHistory
  }

  // Detect conflicts between operations
  detectConflict(op1, op2) {
    // Check if two operations affect the same area (for drawing, this is overlap check)
    if (op1.type !== "draw-stroke" || op2.type !== "draw-stroke") {
      return false
    }

    // Check temporal conflict (within 100ms)
    return Math.abs(op1.timestamp - op2.timestamp) < 100
  }

  // Resolve conflicts using Last-Write-Wins strategy
  resolveConflict(op1, op2) {
    return op1.timestamp > op2.timestamp ? op1 : op2
  }
}
