import React, { useState } from 'react';
import { createUser, loginUser } from '../services/authService.js';
import Spinner from './Spinner.js';
import Alert from './Alert.js';

const Auth = ({ onLogin, onContinueAsGuest }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginView, setIsLoginView] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (isLoginView) {
                await loginUser(email, password);
            } else {
                await createUser(email, password);
            }
            onLogin(email);
        } catch (err) {
            setError(err.message);
            setIsLoading(false);
        }
    };

    const form = React.createElement('form', { onSubmit: handleSubmit, className: "space-y-4" },
        React.createElement('input', {
            type: "email",
            value: email,
            onChange: (e) => setEmail(e.target.value),
            placeholder: "Email",
            required: true,
            className: "w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition",
            disabled: isLoading,
            autoComplete: "email"
        }),
        React.createElement('input', {
            type: "password",
            value: password,
            onChange: (e) => setPassword(e.target.value),
            placeholder: "Password",
            required: true,
            minLength: 6,
            className: "w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition",
            disabled: isLoading,
            autoComplete: isLoginView ? "current-password" : "new-password"
        }),
        React.createElement('button', {
            type: "submit",
            disabled: isLoading || !email || password.length < 6,
            className: "w-full bg-cyan-500 text-slate-900 font-bold py-3 px-4 rounded-lg hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center"
        }, isLoading ? React.createElement(Spinner, null) : (isLoginView ? 'Login' : 'Create Account'))
    );

    return React.createElement('div', { className: "bg-slate-800/50 border border-slate-700 p-8 rounded-lg shadow-2xl w-full max-w-md text-center animate-fade-in" },
        React.createElement('h2', { className: "text-2xl font-semibold mb-2 text-cyan-300" }, isLoginView ? 'Welcome Back' : 'Create an Account'),
        React.createElement('p', { className: "text-slate-400 mb-6" }, isLoginView ? 'Log in to access your goal history.' : 'Sign up to save your progress across devices.'),
        error && React.createElement(Alert, { message: error, type: "error" }),
        form,
        React.createElement('div', { className: "mt-6 text-sm" },
            React.createElement('button', {
                onClick: () => {
                    setIsLoginView(!isLoginView);
                    setError(null);
                },
                className: "text-cyan-400 hover:text-cyan-300"
            }, isLoginView ? 'Need an account? Sign Up' : 'Already have an account? Login')
        ),
        React.createElement('div', { className: "relative my-6" },
            React.createElement('div', { className: "absolute inset-0 flex items-center", "aria-hidden": "true" },
                React.createElement('div', { className: "w-full border-t border-slate-700" })
            ),
            React.createElement('div', { className: "relative flex justify-center text-sm" },
                React.createElement('span', { className: "bg-slate-800/50 px-2 text-slate-500" }, "OR")
            )
        ),
        React.createElement('button', {
            onClick: onContinueAsGuest,
            className: "w-full bg-slate-700 text-white font-semibold py-3 px-4 rounded-lg hover:bg-slate-600 transition-colors"
        }, 'Continue as Guest')
    );
};

export default Auth;
