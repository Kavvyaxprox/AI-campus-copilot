import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, GraduationCap, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

interface DemoAccount {
  label: string;
  email: string;
  hint: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: 'Demo Admin',
    email: 'cse_admin@campus.edu',
    hint: 'Department admin, CSE',
  },
  {
    label: 'Demo Student',
    email: 'student@campus.edu',
    hint: 'Student, CSE semester 5',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in, continue to the correct portal.
  useEffect(() => {
    if (user) navigate(user.homePath, { replace: true });
  }, [user, navigate]);

  const applyDemo = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword('');
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;

    setError(null);
    setIsLoading(true);
    try {
      const profile = await login(email.trim(), password);
      navigate(profile.homePath, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left branding panel, desktop only */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-900 p-12">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-emerald-400" />
          <span className="text-sm font-semibold tracking-wide text-slate-300 uppercase">
            Campus Knowledge System
          </span>
        </div>

        <div className="max-w-md">
          <GraduationCap className="mb-6 h-14 w-14 text-emerald-400" />
          <h1 className="text-4xl font-bold tracking-tight text-white">
            AI Campus Copilot
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-slate-300">
            One sign in for every role. Answers are grounded in approved campus
            documents only, with page level citations on every response.
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-6 border-t border-slate-800 pt-6 text-sm">
          <div>
            <dt className="text-slate-400">Sources</dt>
            <dd className="mt-1 font-semibold text-white">Approved PDFs only</dd>
          </div>
          <div>
            <dt className="text-slate-400">Access</dt>
            <dd className="mt-1 font-semibold text-white">Department scoped</dd>
          </div>
          <div>
            <dt className="text-slate-400">Review</dt>
            <dd className="mt-1 font-semibold text-white">Student dispute desk</dd>
          </div>
        </dl>
      </div>

      {/* Right authentication panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center bg-slate-100 p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <GraduationCap className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
            <h1 className="text-2xl font-bold text-slate-900">AI Campus Copilot</h1>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-slate-900">Sign in</h2>
            <p className="mt-1 mb-6 text-sm text-slate-500">
              Use your institutional credentials. Your role decides which portal
              opens after sign in.
            </p>

            {/* Demo account shortcuts */}
            <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Quick demo fill
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.label}
                    type="button"
                    onClick={() => applyDemo(account)}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-emerald-500 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    {account.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {DEMO_ACCOUNTS.map((account) => account.hint).join(' · ')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  College Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@campus.edu"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 pr-11 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((previous) => !previous)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Authenticating
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 text-xs leading-5 text-slate-500">
              Admin and faculty accounts open the admin portal. Student accounts
              open the copilot assistant.
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <Link to="/privacy" className="hover:text-slate-800 hover:underline">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-slate-800 hover:underline">
              Terms and Conditions
            </Link>
            <span>Contact the IT Help Desk if you are unable to sign in.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
