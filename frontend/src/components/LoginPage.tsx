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
    <div className="login-shell flex min-h-screen items-center justify-center px-4 py-8 text-text dark:text-textDark">
      <div className="login-panel grid w-full max-w-5xl overflow-hidden rounded-[24px] border border-[#D9D6CF] bg-[#F5F3EE]/95 shadow-[0_28px_80px_rgba(13,13,13,0.12)] dark:border-[#292929] dark:bg-[#151515]/95 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="flex flex-col justify-between p-8 sm:p-10 lg:p-12">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-xl font-bold text-[#F5F3EE] shadow-[0_10px_22px_rgba(229,57,53,0.22)]">I</div>
              <div>
                <h1 className="text-2xl font-bold tracking-[-0.04em]">InkKnits</h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text/50 dark:text-textDark/55">Production studio</p>
              </div>
            </div>
          </div>

          <div className="mt-12 max-w-md">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Build. Write. Ship.</p>
            <h2 className="mt-6 text-4xl font-semibold tracking-[-0.06em]">Your content production workspace.</h2>
            <p className="mt-4 text-base leading-7 text-text/65 dark:text-textDark/70">Create, review, and ship editorial output with clear production flow and focused team workflows.</p>
          </div>

          <div className="mt-10 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-text/45 dark:text-textDark/60">
            <span className="h-px flex-1 bg-[#D9D6CF] dark:bg-[#292929]" />
            <span>Editorial system</span>
            <span className="h-px flex-1 bg-[#D9D6CF] dark:bg-[#292929]" />
          </div>
        </div>

        <div className="flex items-center justify-center bg-[#0D0D0D] p-6 sm:p-8 lg:p-10">
          <div className="w-full max-w-md rounded-[20px] border border-[#292929] bg-[#151515] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.25)]">
            <div className="mb-7">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F5F3EE]/60">Welcome back</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#F5F3EE]">Sign in</h3>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#F5F3EE]/70">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-[#292929] bg-[#101010] px-4 py-3 text-[#F5F3EE] placeholder:text-[#F5F3EE]/40 focus:border-accent focus:outline-none"
                  placeholder="admin@example.com"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#F5F3EE]/70">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-lg border border-[#292929] bg-[#101010] px-4 py-3 text-[#F5F3EE] placeholder:text-[#F5F3EE]/40 focus:border-accent focus:outline-none"
                  placeholder="InkKnits-Dev-2026!"
                  required
                />
              </label>

              {error ? (
                <div className="rounded-lg border border-[#E53935]/60 bg-[#FCE9E8] px-3 py-2 text-sm text-[#0D0D0D]">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-[0.12em] text-[#F5F3EE] transition hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(229,57,53,0.22)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Signing in...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
