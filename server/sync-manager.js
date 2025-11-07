export class SyncManager {
  constructor() {
    this.pendingEvents = []
    this.eventLog = []
    this.batchSize = 10
    this.batchTimeoutMs = 100
    this.lastBatchTime = Date.now()
    this.vectorClocks = new Map() // Track causality with vector clocks
  }

  addEvent(event, userId) {
    // Add vector clock for causal ordering
    if (!this.vectorClocks.has(userId)) {
      this.vectorClocks.set(userId, 0)
    }
    this.vectorClocks.set(userId, this.vectorClocks.get(userId) + 1)

    const eventWithMeta = {
      ...event,
      userId,
      vectorClock: new Map(this.vectorClocks),
      sequence: this.eventLog.length,
    }

    this.eventLog.push(eventWithMeta)
    this.pendingEvents.push(eventWithMeta)

    return this.shouldFlushBatch()
  }

  shouldFlushBatch() {
    const now = Date.now()
    const timeSinceLastBatch = now - this.lastBatchTime

    return this.pendingEvents.length >= this.batchSize || timeSinceLastBatch >= this.batchTimeoutMs
  }

  flushBatch() {
    const batch = this.pendingEvents.splice(0, this.batchSize)
    this.lastBatchTime = Date.now()
    return batch
  }

  // Operational Transform - handle concurrent edits
  transformOperation(op, concurrentOps) {
    // Simple transformation: preserve insertion order by timestamp
    let transformedOp = { ...op }

    for (const concurrent of concurrentOps) {
      if (concurrent.timestamp > op.timestamp) {
        // Concurrent operation is newer, adjust our operation
        transformedOp = this.applyTransform(transformedOp, concurrent)
      }
    }

    return transformedOp
  }

  applyTransform(operation, concurrent) {
    // For drawing, we use Last-Write-Wins with timestamps
    // More sophisticated implementations could use OT or CRDT
    return operation
  }

  getEventsSince(sequence) {
    return this.eventLog.slice(sequence)
  }

  getEventLog() {
    return this.eventLog
  }
}
