Real-Time Collaborative Drawing Canvas

Production-ready multi-user drawing application with real-time synchronization, global undo/redo, and conflict resolution.

Table of contents

Overview

Features

Tech Stack

Quickstart (local)

Usage

Project structure

Architecture & sync strategy

Undo / Redo semantics

Performance optimizations

Known limitations

Scaling considerations

Deployment

Development notes & testing

Contributing

License

Overview

A collaborative canvas that lets multiple users draw simultaneously with low latency. Designed to demonstrate robust synchronization (operation transforms + vector clocks), global undo/redo, and production deployment readiness.

Features

Real-time drawing sync (live strokes as users draw)

Brush, eraser, color picker, adjustable stroke width

Global undo/redo with conflict resolution

Cursor/active-user indicators and per-user colors

Rooms: multiple isolated canvases with shareable links

Touch support (mobile) and keyboard shortcuts (B/E/Undo/Redo)

Automatic reconnection with exponential backoff

Latency monitoring, FPS counter, stroke count display

Tech stack

Frontend: Vanilla TypeScript/JavaScript + HTML5 Canvas

Backend: Node.js + Express + ws (WebSockets)

Synchronization: Operational Transform + Vector Clocks

Optional: Docker for containerized deployment

Quickstart (local)
Prerequisites

Node.js 14+ (recommended 18+)

npm (bundled with Node)

(Optional) Docker

Install & run

From the project root (where package.json lives):

# install dependencies
npm ci

# start server
npm start


The app will be available at: http://localhost:8080
Health check: http://localhost:8080/health → returns ok.

Usage
Single-user

Open http://localhost:8080

Select a tool and draw.

Multi-user (same machine)

Open the URL in two browser tabs (or one normal + one incognito)

Draw in one tab — changes appear instantly in the other.

Multi-user (different devices)

Find machine IP (e.g., 192.168.x.y) and run server.

On other device (same LAN): http://192.168.x.y:8080/

Use "Share Room Link" to invite remote users.

Project structure
collaborative-canvas/
├── client/
│   ├── index.html
│   ├── style.css
│   ├── main.js                # app initialization
│   ├── canvas.js              # drawing engine & rendering
│   ├── websocket.js           # client websocket logic
│   └── ...                    # ui/undo/tools/metrics
├── server/
│   ├── server.js              # express + ws server
│   ├── rooms.js               # room & user management
│   ├── sync-manager.js        # batching & causality
│   ├── operation-transform.js # conflict resolution
│   └── event-batcher.js       # batching utility
├── package.json
├── Dockerfile
├── README.md
└── ARCHITECTURE.md

Architecture & sync strategy (concise)

Client captures pointer events and renders locally for immediate feedback.

Client emits compressed stroke packets to server via WebSocket.

Server batches events, orders them using vector clocks, applies Operational Transform when needed, and broadcasts to room members.

Clients apply remote ops and maintain identical canvas state.

Key decisions

Event batching (max 50ms or N points) to reduce network overhead.

Vector clocks to ensure causal ordering.

Lightweight message format (minimized point arrays) and deduplication via timestamps/IDs.

Undo / Redo semantics

Clients keep local action stacks for instant undo/redo UI.

Server maintains global history reference for synchronization across clients.

Undo removes the user's own last action; transforms are applied server-side to preserve consistency when multiple users interact with overlapping regions.

History cap: 100 actions (configurable) to prevent memory blowup.

Performance optimizations

Stroke simplification using Douglas–Peucker to reduce points.

RequestAnimationFrame-based rendering at 60fps throttle.

Dirty-rect redraw (partial canvas redraws when possible).

Event batching to reduce packets and CPU overhead.

Ping/pong latency measurement every 5 seconds.

Known limitations

No persistent storage: canvas resets on server restart.

Single canvas per room (no multi-layer support).

No authentication (room links are unprotected).

Performance degrades with >1000 simultaneous heavy strokes per room.

Scaling considerations

For production scale (1k+ concurrent users):

Run multiple server instances behind a load balancer with session affinity / sticky sessions.

Use Redis (pub/sub) or Kafka to broadcast events between server instances.

Persist periodic canvas snapshots to a DB (S3 + metadata) for recovery.

Consider switching Operational Transform → CRDTs for more robust offline & multi-region support.

Deployment
Docker
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production=false
COPY . .
EXPOSE 8080
CMD ["npm", "start"]

Render (recommended for full Node)

Push repo to GitHub → Render.com → New Web Service → Docker (or Node) → connect repo → deploy.

Ensure server reads process.env.PORT || 8080. Healthcheck is available at /health.

Vercel / Serverless

Vercel requires serverless functions for WebSocket (non-trivial); prefer Render/Railway/Heroku for full WebSocket servers.

Development notes & testing

Enable debug logs: look for [v0] prefixed logs.

Useful test scenarios: high-frequency drawing, throttled networks, many concurrent users, undo stacks with overlapping strokes.

Use browser DevTools Network tab to monitor WebSocket frames.

Contributing

Contributions welcome. Suggested areas:

Add DB-backed persistence & snapshots.

Implement authentication for private rooms.

Add layers & selection tools.

Optimize memory & CPU for large rooms.

Please open issues or PRs following the project conventions.

License

MIT
