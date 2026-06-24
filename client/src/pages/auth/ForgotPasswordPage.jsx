import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { forgotPassword } from '../../api/auth';
import Logo from '../../components/ui/Logo';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) return setError('Email is required');
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8faff] p-4">
      <div className="w-full max-w-[400px] rounded-xl border border-[#e2e8f0] bg-white p-8 shadow-md">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <Logo size={24} subtitle={false} />
          </div>
          <p className="mt-2 text-sm text-[#6b7280]">Reset your password</p>
        </div>

        {sent ? (
          <div className="flex flex-col items-center py-4 text-center">
            <MailCheck size={44} className="text-[#16a34a]" />
            <p className="mt-4 text-sm text-[#374151]">
              If an account exists for <span className="font-medium">{email}</span>, a password
              reset link has been sent. Check your inbox.
            </p>
            <Link to="/login" className="mt-6 text-sm font-medium text-brand-600 hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <p className="text-sm text-[#6b7280]">
              Enter your account email and we&apos;ll send you a link to reset your password.
            </p>
            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="you@swahilipothub.co.ke"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send Reset Link'}
            </Button>
            {error && <p className="text-center text-sm text-[#dc2626]">{error}</p>}
            <Link
              to="/login"
              className="flex items-center justify-center gap-1 text-sm text-[#6b7280] hover:text-[#374151]"
            >
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
