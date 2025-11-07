import Link from 'next/link';
import { SignupForm } from '@/components/auth/SignupForm';

export default function SignupPage() {
  return (
    <div className="w-full max-w-4xl">
      <div className="mb-6 text-center text-white/80">
        <p>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-white underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
      <div className="flex justify-center">
        <SignupForm />
      </div>
    </div>
  );
}
