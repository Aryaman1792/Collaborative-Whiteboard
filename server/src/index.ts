import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on('draw', (data) => {
        // data should contain drawing info
        const { roomId, ...drawData } = data;
        socket.to(roomId).emit('draw', drawData);
    });

    socket.on('cursor-move', (data) => {
        const { roomId, ...cursorData } = data;
        socket.to(roomId).emit('cursor-move', cursorData);
    });

    socket.on('chat-message', (data) => {
        const { roomId, message, user } = data;
        io.to(roomId).emit('chat-message', { user, message, timestamp: new Date() });
    });

    socket.on('clear', (roomId) => {
        io.to(roomId).emit('clear');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
