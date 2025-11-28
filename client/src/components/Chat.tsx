import React, { useEffect, useState } from 'react';
import { socket } from '../services/socket';

interface Message {
    user: string;
    message: string;
    timestamp: string;
}

const Chat: React.FC<{ username: string }> = ({ username }) => {
    const [history, setHistory] = useState<Message[]>([]);
    const [draft, setDraft] = useState('');

    useEffect(() => {
        socket.on('chat-message', (msg: Message) => {
            setHistory((prev) => [...prev, msg]);
        });

        return () => {
            socket.off('chat-message');
        };
    }, []);

    const send = (e: React.FormEvent) => {
        e.preventDefault();
        if (draft.trim()) {
            socket.emit('chat-message', {
                roomId: 'default-room',
                user: username,
                message: draft,
            });
            setDraft('');
        }
    };

    return (
        <div className="glass-panel p-3 h-100 d-flex flex-column">
            <h5 className="mb-3">Chat</h5>
            <div className="chat-container flex-grow-1 mb-3">
                {history.map((msg, idx) => (
                    <div
                        key={idx}
                        className={`chat-message ${msg.user === username ? 'mine' : ''}`}
                    >
                        <small className="text-white-50 d-block">{msg.user}</small>
                        <div>{msg.message}</div>
                    </div>
                ))}
            </div>
            <form onSubmit={send} className="d-flex gap-2">
                <input
                    type="text"
                    className="form-control bg-transparent text-white"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Type a message..."
                    style={{ border: '1px solid rgba(255,255,255,0.3)' }}
                />
                <button type="submit" className="btn glass-button">Send</button>
            </form>
        </div>
    );
};

export default Chat;
