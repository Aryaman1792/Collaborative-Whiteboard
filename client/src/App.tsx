import { useState, useEffect, useRef } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import Whiteboard from './components/Whiteboard';
import Chat from './components/Chat';
import InviteModal from './components/InviteModal';
import keycloak from './services/auth';
import { socket } from './services/socket';

function App() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [user, setUser] = useState('');
    const [error, setError] = useState<string | null>(null);
    const init = useRef(false);

    useEffect(() => {
        if (init.current) return;
        init.current = true;

        keycloak.init({ onLoad: 'login-required' }).then((auth: boolean) => {
            setIsLoggedIn(auth);
            if (auth) {
                const uniqueSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
                const baseName = keycloak.tokenParsed?.preferred_username || 'Anonymous';
                setUser(`${baseName}#${uniqueSuffix}`);
                socket.emit('join-room', 'default-room');
            }
        }).catch((err) => {
            console.error(err);
            setError('Failed to connect to authentication server. Please ensure Keycloak is running.');
        });
    }, []);

    const logout = () => {
        keycloak.logout();
    };

    if (error) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="glass-panel p-5 text-center text-danger">
                    <h1>Error</h1>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="glass-panel p-5 text-center">
                    <h1>Loading...</h1>
                    <p>Redirecting to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h1>Collaborative Whiteboard</h1>
                <div className="d-flex align-items-center gap-3">
                    <InviteModal />
                    <span>Welcome, {user}</span>
                    <button className="btn glass-button" onClick={logout}>Logout</button>
                </div>
            </div>

            <div className="row">
                <div className="col-md-8">
                    <Whiteboard />
                </div>
                <div className="col-md-4">
                    <Chat username={user} />
                </div>
            </div>
        </div>
    );
}

export default App;
