import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { resetPassword } from '../../api/auth';
import Logo from '../../components/ui/Logo';
import Button from '../../components/ui/Button';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [form, setForm] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function validate() {
    const e = {};
    if (!form.password) e.password = 'New password is required';
    else if (form.password.length < 8) e.password = 'Must be at least 8 characters';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      await resetPassword(token, form.password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setErrors({ form: err.response?.data?.error || 'Could not reset password.' });
    } finally {
      setSubmitting(false);
    }
  }

  const field = (key, label) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#374151]">{label}</label>
      <div className="relative">
        <input
          type={showPw ? 'text' : 'password'}
          value={form[key]}
          onChange={(ev) => setForm({ ...form, [key]: ev.target.value })}
          className={`w-full rounded-lg border bg-white px-3 py-2 pr-10 text-sm text-[#374151] focus:outline-none focus:ring-2 focus:ring-brand-200 ${
            errors[key] ? 'border-[#dc2626]' : 'border-[#e2e8f0] focus:border-brand-500'
          }`}
        />
        <button
          type="button"
          onClick={() => setShowPw((s) => !s)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-[#6b7280] hover:text-[#374151]"
          aria-label={showPw ? 'Hide password' : 'Show password'}
        >
          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {errors[key] && <p className="mt-1 text-xs text-[#dc2626]">{errors[key]}</p>}
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8faff] p-4">
      <div className="w-full max-w-[400px] rounded-xl border border-[#e2e8f0] bg-white p-8 shadow-md">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <Logo size={24} subtitle={false} />
          </div>
          <p className="mt-2 text-sm text-[#6b7280]">Set a new password</p>
        </div>

        {!token ? (
          <div className="text-center">
            <p className="text-sm text-[#dc2626]">This reset link is missing its token.</p>
            <Link to="/forgot-password" className="mt-4 inline-block text-sm font-medium text-brand-600 hover:underline">
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center py-4 text-center">
            <CheckCircle2 size={44} className="text-[#16a34a]" />
            <p className="mt-4 text-sm text-[#374151]">
              Your password has been reset. Redirecting you to sign in…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {field('password', 'New Password')}
            {field('confirm', 'Confirm New Password')}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Resetting…' : 'Reset Password'}
            </Button>
            {errors.form && <p className="text-center text-sm text-[#dc2626]">{errors.form}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
