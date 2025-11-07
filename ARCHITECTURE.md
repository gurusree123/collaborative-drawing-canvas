# Collaborative Drawing Canvas - Architecture

## System Overview

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│                        BROWSER CLIENTS                          │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────┤
│   Client 1  │   Client 2  │   Client 3  │   Client N  │  Admin  │
│  (Painter)  │  (Painter)  │  (Painter)  │  (Painter)  │ (View)  │
└──────┬──────┴──────┬──────┴──────┬──────┴──────┬──────┴────┬────┘
       │             │             │             │           │
       └─────────────┼─────────────┼─────────────┼───────────┘
                     │ WebSocket   │
                     │ (Bidirectional)
                     │
       ┌─────────────▼─────────────────────────────────────────┐
       │           WebSocket Server (Node.js)                  │
       │                                                       │
       │  ┌──────────────────────────────────────────────────┐ │
       │  │ Message Handler                                  │ │
       │  │ - Parse incoming messages                        │ │
       │  │ - Route to appropriate handler                   │ │
       │  └──────────────────────────────────────────────────┘ │
       │                                                        │
       │  ┌──────────────────────────────────────────────────┐ │
       │  │ Room Manager                                     │ │
       │  │ - Multiple isolated canvases (rooms)             │ │
       │  │ - User management per room                       │ │
       │  │ - Broadcast to room members                      │ │
       │  └──────────────────────────────────────────────────┘ │
       │                                                        │
       │  ┌──────────────────────────────────────────────────┐ │
       │  │ Sync Manager                                     │ │
       │  │ - Event batching (max 20 or 50ms)               │ │
       │  │ - Vector clock management                        │ │
       │  │ - Causal ordering                                │ │
       │  └──────────────────────────────────────────────────┘ │
       │                                                        │
       │  ┌──────────────────────────────────────────────────┐ │
       │  │ Operation Transform                              │ │
       │  │ - Conflict detection                             │ │
       │  │ - Last-Write-Wins resolution                     │ │
       │  │ - Operation history                              │ │
       │  └──────────────────────────────────────────────────┘ │
       │                                                        │
       └────────────────────────────────────────────────────────┘
\`\`\`

## Client Architecture

### Component Hierarchy

\`\`\`
main.js (App Initialization)
├── DrawingCanvas
│   ├── Canvas Element
│   ├── Context 2D
│   ├── UndoRedoManager
│   ├── RemoteCursors Map
│   └── Stroke Collection
├── WebSocketClient
│   ├── Connection Management
│   ├── Message Queue
│   ├── Event Listeners
│   └── Latency Tracking
└── UIManager
    ├── Toolbar Handler
    ├── Performance Monitor
    ├── Notifications
    └── User List Manager
\`\`\`

### DrawingCanvas Class

**Responsibilities:**
- Canvas rendering and drawing operations
- Local stroke management
- Remote stroke synchronization
- Undo/redo operations
- Cursor position tracking

**Key Methods:**

\`\`\`javascript
// Drawing
handleMouseDown(e)      // Start stroke
handleMouseMove(e)      // Continue stroke
handleMouseUp()          // End stroke
drawStroke(stroke)      // Render a stroke

// Synchronization
receiveRemoteStroke(data)   // Handle remote stroke
updateRemoteCursor(data)    // Update cursor position

// State Management
undo()                  // Local undo
redo()                  // Local redo
applyUndo(data)         // Server undo
applyRedo(data)         // Server redo
\`\`\`

**Performance Considerations:**

- Renders at 60fps max (throttled)
- Uses quadratic curves for smooth lines
- Caches remote cursors for efficient redrawing
- Limits undo/redo stack to 100 actions

### WebSocketClient Class

**Responsibilities:**
- WebSocket connection management
- Message serialization/deserialization
- Event emission and listening
- Automatic reconnection with exponential backoff
- Latency tracking

**Message Types:**

\`\`\`javascript
{
  type: 'join-room',
  payload: { roomId, userId, userName, userColor }
}

{
  type: 'draw-stroke',
  payload: { tool, color, strokeWidth, points, timestamp }
}

{
  type: 'cursor-move',
  payload: { x, y }
}

{
  type: 'undo' | 'redo' | 'clear-canvas'
}

{
  type: 'ping' | 'pong'
}
\`\`\`

**Reconnection Strategy:**

- Exponential backoff: 1s, 2s, 4s, 8s, 16s
- Max 5 reconnection attempts
- Message queue during disconnection
- Auto-flush on reconnection

## Server Architecture

### Room Management

**Structure:**

\`\`\`javascript
RoomManager
├── rooms: Map<roomId, Room>
│   ├── Room1
│   │   ├── users: Map<userId, UserData>
│   │   ├── drawingEvents: Array<Event>
│   │   ├── SyncManager
│   │   ├── OperationTransform
│   │   └── Undo/Redo Stacks
│   └── Room2
│       └── ...
\`\`\`

**Key Operations:**

1. **Join Room**
   - Create room if doesn't exist
   - Add user to room
   - Send canvas state to new user
   - Notify other users

2. **Draw Stroke**
   - Add to drawing events
   - Batch if needed
   - Transform against concurrent ops
   - Broadcast to room

3. **Undo/Redo**
   - Modify stacks
   - Remove/restore stroke
   - Broadcast to all

### Sync Manager

**Purpose**: Handle event batching and causal ordering

**Batching Strategy:**
- Batch size: 20 events
- Timeout: 50ms
- Reduces network traffic by ~80%

**Vector Clocks:**
- Track per-user event count
- Ensure causal ordering
- Prevent out-of-order processing

### Operation Transform

**Conflict Detection:**

\`\`\`javascript
if (op1.timestamp !== op2.timestamp) {
  // Potential conflict if within 100ms
  if (Math.abs(op1.timestamp - op2.timestamp) < 100) {
    // Last-Write-Wins
    return op1.timestamp > op2.timestamp ? op1 : op2
  }
}
\`\`\`

**Limitations:**
- Simple timestamp-based resolution
- For sophisticated scenarios, consider CRDTs

## WebSocket Protocol

### Connection Lifecycle

\`\`\`
Client                              Server
  │                                   │
  ├──────────── CONNECT ─────────────>│
  │                                   │
  ├──────── join-room message ───────>│
  │                                   │
  │<────── canvas-state message ──────┤
  │<──── user-joined broadcast ───────┤
  │                                   │
  │<─────── draw-stroke events ───────┤
  │  │  │  │                          │
  │  (strokes flow during drawing)    │
  │                                   │
  ├────── cursor-move events ────────>│
  │<────── cursor-move broadcast ─────┤
  │                                   │
  ├────────── undo message ──────────>│
  │<───────── undo broadcast ─────────┤
  │                                   │
  └──────────── CLOSE ───────────────>│
  (auto-reconnect attempt)            │
\`\`\`

### Event Flow for Drawing

1. **User Input**: Mouse/touch event on canvas
2. **Local Processing**: Create stroke object
3. **Local Rendering**: Draw on canvas immediately
4. **Network Send**: Send to server via WebSocket
5. **Server Receives**: Parse and add to event log
6. **Batching**: Batch with other events
7. **Vector Clock**: Assign causality
8. **Broadcast**: Send to other users
9. **Remote Rendering**: Other clients draw stroke
10. **Display**: Show remote cursor and stroke

### Latency Tracking

\`\`\`javascript
// Client sends ping every 5 seconds
Client: { type: 'ping' }
Server: Receives ping

Server: { type: 'pong' }
Client: Calculates latency = now - lastPingTime
        Updates UI with latency
\`\`\`

## Undo/Redo Strategy

### Global Undo/Redo

**Problem**: When User A undoes, what happens to User B's overlapping stroke?

**Solution**: Per-user undo/redo stacks

\`\`\`javascript
// Server maintains
userUndoStacks: Map<userId, Array<stroke>>
userRedoStacks: Map<userId, Array<stroke>>

// Client maintains
undoRedoManager: {
  undoStack: Array<action>,
  redoStack: Array<action>
}
\`\`\`

**Workflow**:

1. User A draws stroke 1
2. User B draws stroke 2
3. User A presses Undo
4. Only stroke 1 is removed
5. Stroke 2 remains visible
6. Other users see both strokes until their own undo

### Stack Management

- Max 100 actions per user
- LIFO (Last-In-First-Out)
- Cleared when new action after undo

## Performance Considerations

### Rendering Optimization

**Canvas Redraw**:
- Full redraw every frame (safe, not cached)
- Could use offscreen canvas for better performance
- Throttled to 60fps

**Stroke Simplification**:
- Douglas-Peucker algorithm
- Reduces points by ~60%
- Configurable tolerance (2px default)

### Network Optimization

**Event Batching**:
\`\`\`
Without batching: 100 strokes = 100 messages
With batching: 100 strokes = 5 messages (20 per batch)
Network reduction: 95%
\`\`\`

**Message Size**:
- Average stroke: ~2KB (100 points × 20 bytes)
- Batch of 20: ~40KB
- Compressed: ~10KB (75% reduction)

### Memory Optimization

**Stroke Storage**:
- Max 10,000 strokes per room
- Each stroke: ~2KB
- Total memory: ~20MB per active room
- Cleanup: Remove old strokes after 1 hour

## Scaling Architecture

### For 1,000 Concurrent Users

\`\`\`
┌─────────────────────────────────────────┐
│         Load Balancer (HAProxy)         │
│     (Sticky sessions for WebSocket)     │
└──────────┬──────────────┬───────────────┘
           │              │
     ┌─────▼──┐      ┌────▼──┐
     │ WS-1   │      │ WS-2  │
     │ Server │      │Server │
     └──┬──┬──┘      └──┬──┬─┘
        │ └──────────┬──┘ │
        │            │    │
    ┌───▼────────────▼────▼──┐
    │    Redis Event Stream   │
    │  (for event replication)│
    └────────┬────────────────┘
             │
    ┌────────▼──────────┐
    │   PostgreSQL DB   │
    │ (canvas state)    │
    └───────────────────┘
\`\`\`

**Key Changes**:
1. Replace in-memory events with Redis streams
2. Use database for canvas snapshots
3. Implement horizontal scaling with sticky sessions
4. Add message compression
5. Implement CRDT for better conflict resolution

## Troubleshooting

### Issue: Strokes not syncing

**Causes**:
- WebSocket disconnection
- Server message processing error
- Client rendering failure

**Debug**:
\`\`\`javascript
// Server
console.log("[v0] Event added to room:", roomId, event)
// Client
console.log("[v0] Stroke received:", data)
\`\`\`

### Issue: High latency

**Causes**:
- Network congestion
- Server overload
- Large batch processing

**Monitor**:
- Check latency display (UI)
- Verify batch sizes
- Profile server CPU/memory

### Issue: Canvas state mismatch

**Causes**:
- Out-of-order event processing
- Missing undo/redo sync
- Timestamp conflicts

**Solution**:
- Request full canvas state from server
- Implement periodic checksums
- Add event sequence numbers

## References

- Operational Transform: https://en.wikipedia.org/wiki/Operational_transformation
- CRDTs: https://crdt.tech/
- WebSocket Protocol: https://tools.ietf.org/html/rfc6455
- Vector Clocks: https://en.wikipedia.org/wiki/Vector_clock
