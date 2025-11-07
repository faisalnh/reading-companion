import Link from 'next/link';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <div className="w-full max-w-4xl">
      <div className="mb-6 text-center text-white/80">
        <p>
          Remember your password?{' '}
          <Link href="/login" className="font-semibold text-white underline-offset-4 hover:underline">
            Return to sign in
          </Link>
        </p>
      </div>
      <div className="flex justify-center">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
