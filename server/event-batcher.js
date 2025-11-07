export class EventBatcher {
  constructor(flushCallback, batchSize = 20, timeoutMs = 50) {
    this.flushCallback = flushCallback
    this.batchSize = batchSize
    this.timeoutMs = timeoutMs
    this.pendingEvents = []
    this.timeoutId = null
  }

  addEvent(event) {
    this.pendingEvents.push(event)

    if (this.pendingEvents.length >= this.batchSize) {
      this.flush()
    } else if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => this.flush(), this.timeoutMs)
    }
  }

  flush() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    if (this.pendingEvents.length > 0) {
      const batch = this.pendingEvents.splice(0)
      this.flushCallback(batch)
    }
  }
}
