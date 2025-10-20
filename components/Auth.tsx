import React, { useState } from 'react';
import { createUser, loginUser } from '../services/authService';
import Spinner from './Spinner';
import Alert from './Alert';

interface AuthProps {
    onLogin: (email: string, rememberMe: boolean) => void;
    onContinueAsGuest: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, onContinueAsGuest }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [isLoginView, setIsLoginView] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (isLoginView) {
                await loginUser(email, password);
            } else {
                await createUser(email, password);
            }
            onLogin(email, rememberMe);
        } catch (err) {
            setError((err as Error).message);
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-fade-in">
            <h2 className="text-2xl font-semibold mb-2 text-cyan-300">
                {isLoginView ? 'Welcome Back' : 'Create an Account'}
            </h2>
            <p className="text-slate-400 mb-6">
                {isLoginView ? 'Log in to access your goal history.' : 'Sign up to save your progress across devices.'}
            </p>

            {error && <Alert message={error} type="error" />}

            <form onSubmit={handleSubmit} className="space-y-4">
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                    disabled={isLoading}
                    autoComplete="email"
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    minLength={6}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition"
                    disabled={isLoading}
                    autoComplete={isLoginView ? "current-password" : "new-password"}
                />

                <div className="flex items-center justify-between text-sm">
                  <label htmlFor="remember-me" className="flex items-center gap-2 text-slate-400 cursor-pointer">
                    <input
                      id="remember-me"
                      name="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded bg-slate-700 border-slate-500 text-cyan-500 focus:ring-cyan-500"
                    />
                    Remember me
                  </label>
                </div>
                
                <button
                    type="submit"
                    disabled={isLoading || !email || password.length < 6}
                    className="w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
                >
                    {isLoading ? <Spinner /> : (isLoginView ? 'Login' : 'Create Account')}
                </button>
            </form>

            <div className="mt-6 text-sm">
                <button
                    onClick={() => {
                        setIsLoginView(!isLoginView);
                        setError(null);
                    }}
                    className="text-cyan-400 hover:text-cyan-300"
                >
                    {isLoginView ? 'Need an account? Sign Up' : 'Already have an account? Login'}
                </button>
            </div>
            
             <div className="relative my-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-sm">
                    <span className="bg-slate-800/50 px-2 text-slate-500">OR</span>
                </div>
            </div>

            <button
                onClick={onContinueAsGuest}
                className="w-full bg-slate-700 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-600 transition-colors"
            >
                Continue as Guest
            </button>
        </div>
    );
};

export default Auth;