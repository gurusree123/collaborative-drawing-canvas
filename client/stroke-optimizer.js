export class StrokeOptimizer {
  // Reduce points in stroke using Douglas-Peucker algorithm for better performance
  static simplifyStroke(points, tolerance = 2) {
    if (points.length < 3) return points

    const simplified = []
    let maxDistance = 0
    let maxIndex = 0

    const start = points[0]
    const end = points[points.length - 1]

    // Find point with maximum distance
    for (let i = 1; i < points.length - 1; i++) {
      const distance = this.perpendicularDistance(points[i], start, end)
      if (distance > maxDistance) {
        maxDistance = distance
        maxIndex = i
      }
    }

    // If max distance is greater than tolerance, recursively simplify
    if (maxDistance > tolerance) {
      const left = this.simplifyStroke(points.slice(0, maxIndex + 1), tolerance)
      const right = this.simplifyStroke(points.slice(maxIndex), tolerance)
      simplified.push(...left.slice(0, -1), ...right)
    } else {
      simplified.push(start, end)
    }

    return simplified
  }

  static perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x
    const dy = lineEnd.y - lineStart.y
    const distance =
      Math.abs(dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) /
      Math.sqrt(dx * dx + dy * dy)
    return distance
  }

  // Batch optimize multiple strokes
  static optimizeStrokes(strokes) {
    return strokes.map((stroke) => ({
      ...stroke,
      points: this.simplifyStroke(stroke.points),
    }))
  }
}
