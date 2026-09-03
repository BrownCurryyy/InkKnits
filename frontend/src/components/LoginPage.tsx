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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="blob-circle -left-16 top-20 h-48 w-48 bg-accentSecondary/50" aria-hidden="true" />
      <div className="blob-circle bottom-10 right-10 h-36 w-36 bg-accent/40" aria-hidden="true" />

      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-2xl shadow-bold lg:grid-cols-2">
        {/* Brand panel */}
        <div className="hidden flex-col justify-between bg-accent p-10 text-text lg:flex">
          <div>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-text font-display text-2xl font-bold text-white">I</div>
            <h1 className="display-heading mt-8">inkknits</h1>
            <p className="mt-4 text-sm font-medium text-text/70">Create, generate, and preview — all in one place.</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-text/50">production studio</p>
        </div>

        {/* Form panel */}
        <div className="bg-accentSecondary p-8 text-white sm:p-10">
          <div className="mb-8 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent font-display text-xl font-bold text-text">I</div>
            <h1 className="font-display mt-4 text-3xl font-bold lowercase">inkknits</h1>
          </div>

          <h2 className="font-display text-2xl font-bold lowercase">welcome back</h2>
          <p className="mt-1 text-sm text-white/70">Sign in to your workspace</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/70">Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border-2 border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
                placeholder="admin@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/70">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border-2 border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/40 focus:border-accent focus:outline-none"
                placeholder="••••••••"
                required
              />
            </label>

            {error ? (
              <div className="rounded-xl border border-statusError/60 bg-statusError/20 px-3 py-2 text-sm">{error}</div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-accent px-4 py-3.5 font-bold text-text transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in…' : 'Sign in →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
