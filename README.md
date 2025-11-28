# Collaborative Whiteboard

A real-time collaborative whiteboard application built with React, TypeScript, and Fabric.js. This project allows multiple users to draw, chat, and collaborate on a shared canvas in real-time.

## Features

- **Real-time Collaboration**: Draw and interact with others instantly using Socket.IO.
- **Advanced Drawing Tools**:
  - Pencil (Freehand drawing)
  - Shapes (Rectangle, Circle, Line)
  - Text Tool
  - Eraser
- **Customization**:
  - Adjustable stroke color and width
  - Fill color support for shapes
- **History Management**: Robust Undo/Redo functionality.
- **Export Options**: Save your work as PNG or PDF.
- **Live Chat**: Integrated chat feature with unique user identification.
- **Modern UI**: Sleek "Glassmorphism" design using Bootstrap 5.

## Tech Stack

- **Frontend**: React, TypeScript, Fabric.js, Bootstrap 5
- **Backend**: Node.js, Express, Socket.IO
- **Authentication**: Keycloak Integration
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- Keycloak server running locally

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Aryaman1792/Collaborative-Whiteboard.git
   cd Collaborative-Whiteboard
   ```

2. **Install Dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Run the Application**
   ```bash
   # Start the server (from server directory)
   npm start

   # Start the client (from client directory)
   npm run dev
   ```

## License

This project is licensed under the MIT License.
