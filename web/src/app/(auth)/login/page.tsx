import Link from 'next/link';
import { LoginForm } from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <div className="w-full max-w-4xl">
      <div className="mb-6 text-center text-white/80">
        <p>
          Need an account?{' '}
          <Link href="/signup" className="font-semibold text-white underline-offset-4 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
      <div className="flex justify-center">
        <LoginForm />
      </div>
    </div>
  );
}
