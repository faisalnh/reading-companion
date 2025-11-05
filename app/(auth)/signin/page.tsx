'use client';

import { Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-400 via-secondary-400 to-accent-400 p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full transform hover:scale-105 transition-transform duration-300">
        {/* Logo/Icon */}
        <div className="text-center mb-8">
          <div className="inline-block bg-gradient-to-r from-primary-500 to-secondary-500 rounded-full p-6 mb-4">
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
            Reading Buddy
          </h1>
          <p className="text-gray-600 text-lg">Let's start your reading adventure! 📚✨</p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded">
            <p className="font-medium">Oops! Something went wrong</p>
            <p className="text-sm">
              {error === 'OAuthSignin' && 'Error signing in with Google'}
              {error === 'OAuthCallback' && 'Error during sign in callback'}
              {error === 'OAuthCreateAccount' && 'Error creating account'}
              {error === 'EmailCreateAccount' && 'Error creating account'}
              {error === 'Callback' && 'Error in callback'}
              {error === 'OAuthAccountNotLinked' && 'Account already exists with different provider'}
              {error === 'EmailSignin' && 'Check your email for sign in link'}
              {error === 'CredentialsSignin' && 'Sign in failed. Check your credentials'}
              {error === 'SessionRequired' && 'Please sign in to access this page'}
              {!['OAuthSignin', 'OAuthCallback', 'OAuthCreateAccount', 'EmailCreateAccount', 'Callback', 'OAuthAccountNotLinked', 'EmailSignin', 'CredentialsSignin', 'SessionRequired'].includes(error) && 'Please try again'}
            </p>
          </div>
        )}

        {/* Sign In Button */}
        <button
          onClick={() => signIn('google', { callbackUrl })}
          className="w-full bg-white border-2 border-gray-300 rounded-xl py-4 px-6 flex items-center justify-center gap-3 hover:bg-gray-50 hover:border-primary-400 hover:shadow-lg transition-all duration-300 group"
        >
          <span className="flex h-6 w-6 items-center justify-center">
            <svg
              className="h-5 w-5 flex-shrink-0"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          </span>
          <span className="text-gray-700 font-semibold group-hover:text-primary-600 transition-colors">
            Sign in with Google
          </span>
        </button>

        {/* Info Text */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>New users will automatically get a Student account</p>
          <p className="mt-2">Contact your teacher or admin for other role access</p>
        </div>
      </div>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-400 via-secondary-400 to-accent-400 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 max-w-md w-full text-center">
          Loading...
        </div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
