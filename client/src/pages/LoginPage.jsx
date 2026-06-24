import { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Waves as WavesIcon, Sun, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Logo from '../components/ui/Logo';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

// A single wave period is 1440 wide; the path repeats twice (2880) so an
// animated translateX of -50% loops seamlessly.
const WAVE_PATH =
  'M0,40 C240,80 480,0 720,40 C960,80 1200,0 1440,40 C1680,80 1920,0 2160,40 C2400,80 2640,0 2880,40 L2880,120 L0,120 Z';

function Waves() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 overflow-hidden">
      <svg className="wave-3 absolute bottom-0 left-0 h-32 w-[200%]" viewBox="0 0 2880 120" preserveAspectRatio="none">
        <path d={WAVE_PATH} fill="#0e7490" opacity="0.45" />
      </svg>
      <svg className="wave-2 absolute bottom-0 left-0 h-28 w-[200%]" viewBox="0 0 2880 120" preserveAspectRatio="none">
        <path d={WAVE_PATH} fill="#0891b2" opacity="0.55" />
      </svg>
      <svg className="wave-1 absolute bottom-0 left-0 h-20 w-[200%]" viewBox="0 0 2880 120" preserveAspectRatio="none">
        <path d={WAVE_PATH} fill="#22d3ee" opacity="0.7" />
      </svg>
    </div>
  );
}

// Hand-placed rising sea sparkles (no randomness so it stays deterministic).
const BUBBLES = [
  { left: '8%', size: 10, delay: 0, dur: 9 },
  { left: '18%', size: 6, delay: 2.5, dur: 7 },
  { left: '30%', size: 14, delay: 1, dur: 11 },
  { left: '44%', size: 8, delay: 3.5, dur: 8 },
  { left: '57%', size: 5, delay: 0.8, dur: 6.5 },
  { left: '68%', size: 12, delay: 2, dur: 10 },
  { left: '80%', size: 7, delay: 4, dur: 7.5 },
  { left: '90%', size: 9, delay: 1.6, dur: 9.5 },
];

function Bubbles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          className="animate-rise absolute bottom-24 rounded-full bg-white/40"
          style={{
            left: b.left,
            width: b.size,
            height: b.size,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim()) return setError('Email is required');
    if (!password) return setError('Password is required');

    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ---------- Left: animated ocean scene ---------- */}
      <div className="animate-hue relative hidden overflow-hidden bg-ocean-dawn lg:flex lg:w-[52%] lg:flex-col">
        <div className="swahili-weave pointer-events-none absolute inset-0 opacity-30" />

        {/* Sun / coastal glow */}
        <div className="animate-glow absolute -right-16 top-16 h-64 w-64 rounded-full bg-gold-300/50 blur-2xl" />
        <div className="absolute right-10 top-12 text-gold-100/90">
          <Sun size={46} className="animate-glow" />
        </div>

        {/* Dhow sail silhouette, gently swaying on the swell */}
        <div className="animate-sway absolute bottom-32 left-1/2 -translate-x-1/2 opacity-90">
          <svg width="150" height="170" viewBox="0 0 150 170" fill="none">
            <path d="M70 8 L70 132 L14 132 Z" fill="#0b1f3a" opacity="0.85" />
            <path d="M78 40 L78 132 L128 132 Z" fill="#0b1f3a" opacity="0.7" />
            <rect x="68" y="6" width="4" height="130" rx="2" fill="#0b1f3a" />
            <path d="M2 132 Q75 150 148 132 L140 150 Q75 164 10 150 Z" fill="#0b1f3a" />
          </svg>
        </div>

        <Bubbles />
        <Waves />

        {/* Copy */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-14 text-white">
          <Logo size={24} to="/" className="mb-10 brightness-0 invert drop-shadow" />
          <p className="font-display text-sm font-semibold uppercase tracking-[0.3em] text-sea-200">
            Karibu · Welcome
          </p>
          <h1 className="mt-3 max-w-md font-display text-4xl font-bold leading-tight drop-shadow-sm">
            Where the coast’s youth build their future.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/85">
            Swahilipot Hub Foundation — technology, arts & enterprise on the shores
            of the Indian Ocean, Mombasa.
          </p>
          <div className="mt-8 flex items-center gap-2 text-xs font-medium text-sea-100/90">
            <WavesIcon size={16} />
            <span>Internal Management System</span>
          </div>
        </div>
      </div>

      {/* ---------- Right: sign-in form ---------- */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-canvas p-6">
        {/* Mobile-only ocean accents (the left panel is hidden on small screens) */}
        <div className="absolute inset-x-0 top-0 h-40 bg-ocean-dawn lg:hidden">
          <div className="swahili-weave absolute inset-0 opacity-30" />
        </div>

        <div className="animate-rise-in relative z-10 w-full max-w-[400px] rounded-2xl border border-line bg-card/95 p-8 shadow-xl backdrop-blur lg:mt-0">
          <div className="mb-7 text-center">
            <div className="flex justify-center">
              <Logo size={24} to="/" />
            </div>
            <p className="mt-3 font-display text-lg font-bold text-ink">Sign in to your account</p>
            <p className="mt-1 text-sm text-subtle">Internal Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="you@swahilipothub.co.ke"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 pr-10 text-sm text-ink focus:border-sea-500 focus:outline-none focus:ring-2 focus:ring-sea-200"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-subtle hover:text-ink"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                'Signing in…'
              ) : (
                <>
                  Sign In <ArrowRight size={16} />
                </>
              )}
            </Button>

            {error && <p className="text-center text-sm text-[#dc2626]">{error}</p>}

            <div className="text-center">
              <Link to="/forgot-password" className="text-sm font-medium text-sea-700 hover:underline">
                Forgot password?
              </Link>
            </div>
          </form>

          <p className="mt-6 border-t border-line pt-4 text-center text-xs leading-relaxed text-subtle">
            By signing in, you agree to our{' '}
            <Link to="/terms" className="font-medium text-sea-700 hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="font-medium text-sea-700 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
