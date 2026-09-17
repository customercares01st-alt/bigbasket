import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
    const { isConnected } = useSocket();
    const { logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (path: string) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="app-container">
            <header className="header">
                <div className="header-title">
                    <span className="header-logo">📱</span>
                    <h1>Device Control Panel</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="header-status">
                        <span className={`status-dot ${isConnected ? 'online' : 'offline'}`}></span>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={handleLogout} title="Log out">
                        ⎋ Logout
                    </button>
                </div>
            </header>

            <nav className="top-nav">
                <Link to="/" className={`top-nav-link ${isActive('/') ? 'active' : ''}`}>
                    📲 Devices
                </Link>
                <Link to="/sms" className={`top-nav-link ${isActive('/sms') ? 'active' : ''}`}>
                    💬 All SMS
                </Link>
                <Link
                    to="/transactions"
                    className={`top-nav-link ${isActive('/transactions') ? 'active' : ''}`}
                >
                    💰 Money
                </Link>
            </nav>

            <main>{children}</main>
        </div>
    );
}
