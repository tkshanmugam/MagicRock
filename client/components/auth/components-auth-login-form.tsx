'use client';
import IconLockDots from '@/components/icon/icon-lock-dots';
import IconMail from '@/components/icon/icon-mail';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { AuthService } from '@/lib/authService';
import { DEFAULT_ROUTES } from '@/lib/routes';

const ComponentsAuthLoginForm = () => {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            await AuthService.login({ username, password });
            // Redirect to default page on success (using route constant)
            router.push(DEFAULT_ROUTES.AFTER_LOGIN);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Login failed';
            setError(message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form className="space-y-5 dark:text-white" onSubmit={submitForm} autoComplete="off">
            {error && (
                <div className="mb-4 rounded bg-danger/10 p-3 text-danger">
                    {error}
                </div>
            )}
            <div>
                <label htmlFor="Username">Username</label>
                <div className="relative text-white-dark">
                    <input
                        id="Username"
                        type="text"
                        placeholder="Enter Username"
                        className="form-input ps-10 placeholder:text-white-dark"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="off"
                        required
                        disabled={isLoading}
                    />
                    <span className="absolute start-4 top-1/2 -translate-y-1/2">
                        <IconMail fill={true} />
                    </span>
                </div>
            </div>
            <div>
                <label htmlFor="Password">Password</label>
                <div className="relative text-white-dark">
                    <input
                        id="Password"
                        type="password"
                        placeholder="Enter Password"
                        className="form-input ps-10 placeholder:text-white-dark"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        disabled={isLoading}
                    />
                    <span className="absolute start-4 top-1/2 -translate-y-1/2">
                        <IconLockDots fill={true} />
                    </span>
                </div>
            </div>
            <div>
              
            </div>
            <button
                type="submit"
                className="btn btn-gradient !mt-6 w-full border-0 uppercase shadow-[0_10px_20px_-10px_rgba(67,97,238,0.44)]"
                disabled={isLoading}
            >
                {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
        </form>
    );
};

export default ComponentsAuthLoginForm;
