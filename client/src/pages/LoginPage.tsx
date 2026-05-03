import React, { useState, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { determinePostLoginDestination } from '../utils/navigation';

interface LoginLocationState {
    from?: {
        pathname?: string;
    };
    reason?: 'session_expired';
}

const LoginPage: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const locationState = location.state as LoginLocationState | null;

    const from = locationState?.from?.pathname;
    const sessionExpired = locationState?.reason === 'session_expired';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await apiClient.post('/auth/login', { username, password });

            if (response.data.success) {
                // API returns { success: true, data: { token, user } }
                const { token, user } = response.data.data;
                login(token, user);
                const destination = determinePostLoginDestination(user, from);
                navigate(destination, { replace: true });
            } else {
                setError(response.data.error || 'Login failed');
            }
        } catch (err: unknown) {
            if (err instanceof Error && 'response' in err) {
                const axiosError = err as { response?: { data?: { error?: string } } };
                if (axiosError.response?.data?.error) {
                    setError(axiosError.response.data.error);
                } else {
                    setError('An unexpected error occurred. Please try again later.');
                }
            } else {
                setError('An unexpected error occurred. Please try again later.');
            }
            console.error('Login error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 px-4 sm:px-6">
            <div className="bg-white p-8 rounded-lg shadow-md">
                <h2 className="text-2xl font-heading font-bold mb-6 text-center text-gray-800">Login</h2>

                {sessionExpired && !error && (
                    <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded text-sm" role="status">
                        Your session expired. Please sign in again.
                    </div>
                )}

                {error && (
                    <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded text-sm relative" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
                            Username
                        </label>
                        <input
                            className="appearance-none border border-border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-primary"
                            id="username"
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                            Password
                        </label>
                        <input
                            className="appearance-none border border-border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2 focus:ring-primary"
                            id="password"
                            type="password"
                            placeholder="********"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <button
                            className="bg-primary hover:opacity-90 text-black font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 w-full transition-all disabled:opacity-50"
                            type="submit"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
