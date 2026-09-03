import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('InkKnits-Dev-2026!');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    const next = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/';
    return <Navigate to={next} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(180,151,231,0.16),_transparent_28%),_#423838] px-4 py-8 text-textDark">
      <div className="w-full max-w-md rounded-[20px] border border-white/10 bg-[#2f2626]/95 p-7 shadow-[0_22px_60px_rgba(18,14,14,0.36)] ring-1 ring-white/10">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-xl font-bold text-[#fffaf1] shadow-[0_10px_24px_rgba(180,151,231,0.28)]">
            I
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.04em]">InkKnits</h1>
          <p className="mt-2 text-sm text-textDark/75">Welcome back</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-textDark/90">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-textDark placeholder:text-textDark/60 focus:border-accent focus:outline-none"
              placeholder="admin@example.com"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-textDark/90">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-textDark placeholder:text-textDark/60 focus:border-accent focus:outline-none"
              placeholder="InkKnits-Dev-2026!"
              required
            />
          </label>

          {error ? (
            <div className="rounded-xl border border-statusError/50 bg-statusError/20 px-3 py-2 text-sm text-textDark">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-accent px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[#fffaf1] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
