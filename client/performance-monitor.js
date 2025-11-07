export class PerformanceMonitor {
  constructor() {
    this.frameCount = 0
    this.lastTime = Date.now()
    this.fps = 60
    this.metrics = {
      avgFrameTime: 0,
      memoryUsage: 0,
      strokeCount: 0,
    }
  }

  update(strokeCount) {
    this.frameCount++
    const now = Date.now()
    const elapsed = now - this.lastTime

    if (elapsed >= 1000) {
      this.fps = this.frameCount
      this.frameCount = 0
      this.lastTime = now
    }

    this.metrics.strokeCount = strokeCount

    if (performance.memory) {
      this.metrics.memoryUsage = Math.round(performance.memory.usedJSHeapSize / 1048576)
    }

    return this.metrics
  }

  getMetrics() {
    return {
      fps: this.fps,
      ...this.metrics,
    }
  }

  displayMetrics(containerElement) {
    const metrics = this.getMetrics()
    containerElement.innerHTML = `
      <div style="font-size: 12px; color: #64748b; font-family: monospace;">
        FPS: ${metrics.fps}<br>
        Strokes: ${metrics.strokeCount}<br>
        Memory: ${metrics.memoryUsage}MB
      </div>
    `
  }
}
