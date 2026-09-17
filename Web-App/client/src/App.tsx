import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SocketProvider } from './contexts/SocketContext';
import { DeviceProvider } from './contexts/DeviceContext';
import { AuthProvider } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import DeviceDetail from './pages/DeviceDetail';
import UnifiedSms from './pages/UnifiedSms';
import Transactions from './pages/Transactions';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

function App() {
    return (
        <AuthProvider>
            <SocketProvider>
                <DeviceProvider>
                    <BrowserRouter>
                        <Routes>
                            <Route path="/login" element={<Login />} />
                            <Route path="/" element={
                                <ProtectedRoute>
                                    <Layout><Dashboard /></Layout>
                                </ProtectedRoute>
                            } />
                            <Route path="/sms" element={
                                <ProtectedRoute>
                                    <Layout><UnifiedSms /></Layout>
                                </ProtectedRoute>
                            } />
                            <Route path="/transactions" element={
                                <ProtectedRoute>
                                    <Layout><Transactions /></Layout>
                                </ProtectedRoute>
                            } />
                            <Route path="/device/:id" element={
                                <ProtectedRoute>
                                    <Layout><DeviceDetail /></Layout>
                                </ProtectedRoute>
                            } />
                        </Routes>
                    </BrowserRouter>
                </DeviceProvider>
            </SocketProvider>
        </AuthProvider>
    );
}

export default App;
