# Collaborative Whiteboard

A real-time collaborative whiteboard built with React and TypeScript. Draw together, chat in real-time, and authenticate securely with Keycloak.

## Features

- Real-time drawing with multiple users
- Drawing tools: Pencil, shapes (rectangle, circle, line), text, eraser
- Color picker and stroke width controls
- Undo/redo, clear canvas
- Export as PNG or PDF
- Live chat
- Glassmorphism UI with Bootstrap 5

## Tech Stack

React, TypeScript, Fabric.js, Bootstrap 5, Node.js, Socket.IO, Keycloak, PostgreSQL

## Prerequisites

You'll need Node.js (v14+), npm, Docker, and Git installed.

## Quick Start

### 1. Clone and navigate

```bash
git clone https://github.com/Aryaman1792/Collaborative-Whiteboard.git
cd Collaborative-Whiteboard
```

### 2. Start Keycloak (wait ~60 seconds after this)

```bash
docker-compose up -d
```

### 3. Configure Keycloak

- Go to http://localhost:8080
- Login: `admin` / `admin`
- Click "Create Realm" in the top-left dropdown
- Import the `realm-export.json` file from the project root

### 4. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 5. Run the app (use two terminals)

**Terminal 1 (Backend):**
```bash
cd server
npm start
```

**Terminal 2 (Frontend):**
```bash
cd client
npm run dev
```

### 6. Login and use

- Go to http://localhost:5173
- Login with: `user` / `password`

## Credentials

**Keycloak Admin:** `admin` / `admin` at http://localhost:8080  
**App User:** `user` / `password`

## Troubleshooting

**Keycloak won't load?** Wait 2 minutes after starting Docker, then refresh.

**Can't connect?** Make sure all three services are running:
- Docker: `docker-compose ps`
- Backend: Should show "Server running on port 3001"
- Frontend: Vite dev server should be running

**Port conflicts?** Stop whatever's using port 8080, 3001, or 5173.

**Realm import fails?** Create it manually:
1. Create realm named `whiteboard-realm`
2. Create client `whiteboard-client` with redirect URI `http://localhost:5173/*`
3. Create user `user` with password `password` (temporary: OFF)

## Stopping Everything

```bash
# Ctrl+C in both terminals, then:
docker-compose down
```

## Notes

- Drawings aren't saved to a database - they only exist during the session
- Open multiple browsers to test collaboration
- Change default passwords for production use
