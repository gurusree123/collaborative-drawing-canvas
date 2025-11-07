export class DrawingTools {
  static drawLine(ctx, fromPoint, toPoint, color, width) {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(fromPoint.x, fromPoint.y)
    ctx.lineTo(toPoint.x, toPoint.y)
    ctx.stroke()
  }

  static drawRectangle(ctx, startPoint, endPoint, color, width, fill = false) {
    ctx.strokeStyle = color
    ctx.lineWidth = width

    const width_val = endPoint.x - startPoint.x
    const height_val = endPoint.y - startPoint.y

    if (fill) {
      ctx.fillStyle = color
      ctx.fillRect(startPoint.x, startPoint.y, width_val, height_val)
    }
    ctx.strokeRect(startPoint.x, startPoint.y, width_val, height_val)
  }

  static drawCircle(ctx, centerPoint, radius, color, width, fill = false) {
    ctx.strokeStyle = color
    ctx.lineWidth = width

    if (fill) {
      ctx.fillStyle = color
    }

    ctx.beginPath()
    ctx.arc(centerPoint.x, centerPoint.y, radius, 0, Math.PI * 2)

    if (fill) {
      ctx.fill()
    }
    ctx.stroke()
  }

  static drawText(ctx, text, position, color, fontSize = 16) {
    ctx.fillStyle = color
    ctx.font = `${fontSize}px sans-serif`
    ctx.fillText(text, position.x, position.y)
  }
}
