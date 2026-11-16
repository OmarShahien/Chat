import React, { useState } from 'react';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

interface AuthScreenProps {
  pendingInviteCode?: string | null;
  externalError?: string | null;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  pendingInviteCode,
  externalError,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const handleGoogleSignIn = async (useRedirect = false) => {
    setLoading(true);
    setErrorCode(null);
    setErrorText(null);
    try {
      if (useRedirect) {
        await signInWithRedirect(auth, googleProvider);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code !== 'auth/popup-closed-by-user') {
        setErrorCode(e.code || 'error');
        if (e.code === 'auth/popup-blocked') {
          setErrorText('Sign-in popup was blocked by your browser.');
        } else if (e.code === 'auth/unauthorized-domain') {
          setErrorText(`This domain (${window.location.hostname}) is not authorized for sign-in yet.`);
        } else {
          setErrorText('Could not sign in right now. Please try again.');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const shownError = errorText || externalError;

  return (
    <div className="min-h-screen bg-[#cfdcf0] text-[#34476a] relative">
      {/* Navy top band */}
      <div className="h-[222px] bg-gradient-to-br from-[#0c1b36] to-[#1d4ed8] w-full absolute top-0 left-0" />

      <div className="relative z-10 max-w-[960px] mx-auto px-4 sm:px-6 pt-7 pb-14">
        {/* Top brand name */}
        <div className="flex items-center gap-3.5 mb-7">
          <span className="text-[14px] font-medium tracking-[0.04em] text-white uppercase">
            Chat Web
          </span>
        </div>

        {/* Main White Card */}
        <div className="bg-white rounded-[3px] shadow-[0_17px_50px_0_rgba(11,20,26,0.19),0_12px_15px_0_rgba(11,20,26,0.24)] px-8 sm:px-14 py-11 sm:py-14 grid md:grid-cols-12 gap-10 items-center">
          {/* Instructions column */}
          <div className="md:col-span-7 space-y-6">
            <h1 className="text-[26px] sm:text-[28px] font-light text-[#3b4f73] leading-snug">
              Use Chat Web on your computer
            </h1>

            <ol className="list-decimal list-inside space-y-4 text-[16px] text-[#34476a] leading-7">
              <li>Sign in with your Google account</li>
              <li>Add your friends by email address, @username, or invite code</li>
              <li>Start messaging privately in real time</li>
            </ol>

            {pendingInviteCode && (
              <p className="text-[14px] text-[#1d4ed8] pt-1">
                Invite code detected: <span className="font-medium">{pendingInviteCode}</span>
              </p>
            )}
          </div>

          {/* Google Sign-In column */}
          <div className="md:col-span-5 md:border-l border-[#dde8f8] md:pl-10 flex flex-col items-center justify-center text-center space-y-4 py-4">
            <button
              onClick={() => handleGoogleSignIn(false)}
              disabled={loading}
              className="w-full max-w-[260px] h-[44px] px-5 rounded-[4px] bg-white hover:bg-[#f3f7fd] active:bg-[#f1f3f4] border border-[#dadce0] text-[#3c4043] font-medium text-[14px] flex items-center justify-center gap-3 transition disabled:opacity-60 cursor-pointer"
            >
              <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24">
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
              <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>

            <p className="text-[13px] text-[#8fa7cc]">
              Your chats and contacts sync automatically
            </p>

            {shownError && (
              <div className="w-full max-w-[260px] text-left rounded-[4px] bg-[#fef2f2] border border-[#fecaca] px-3 py-2.5 text-[12.5px] text-[#991b1b] space-y-1.5">
                <p>{shownError}</p>
                {errorCode === 'auth/popup-blocked' && (
                  <button
                    onClick={() => handleGoogleSignIn(true)}
                    className="underline font-medium cursor-pointer"
                  >
                    Continue with redirect instead
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
