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

            <div className="pt-2 border-t border-[#dde8f8]">
              <h2 className="text-[13px] font-medium text-[#3b4f73] mb-1.5">Privacy</h2>
              <ul className="list-disc list-inside space-y-1 text-[12.5px] leading-5 text-[#5c7194]">
                <li>Sign-in happens on Google's domain; no password is ever entered here.</li>
                <li>Stored to run the app: display name, email, and the messages you send.</li>
                <li>No ads, no analytics profiles, no third-party tracking scripts.</li>
                <li>Messages are readable by the people in your chats only.</li>
              </ul>
            </div>
          </div>

          {/* Google Sign-In column */}
          <div className="md:col-span-5 md:border-l border-[#dde8f8] md:pl-10 flex flex-col items-center justify-center text-center space-y-4 py-4">
            <button
              onClick={() => handleGoogleSignIn(false)}
              disabled={loading}
              className="w-full max-w-[260px] h-[44px] px-5 rounded-[4px] bg-white hover:bg-[#f3f7fd] active:bg-[#f1f3f4] border border-[#dadce0] text-[#3c4043] font-medium text-[14px] flex items-center justify-center transition disabled:opacity-60 cursor-pointer"
            >
              <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>

            <p className="text-[12.5px] leading-5 text-[#5c7194] max-w-[280px]">
              You'll sign in on Google's own page — Chat Web never sees your Google password.
            </p>

            <p className="text-[12.5px] text-[#8fa7cc]">
              Your chats and contacts sync automatically
            </p>

            {/* Contact + transparency details, so visitors can confirm who runs this site. */}
            <div className="w-full max-w-[280px] pt-3 mt-1 border-t border-[#dde8f8] text-[12.5px] leading-5 text-[#8fa7cc] space-y-1">
              <p>
                <span className="text-[#5c7194]">Owner:</span>{' '}
                <a
                  href="mailto:omarshahieeen@gmail.com"
                  className="text-[#1d4ed8] hover:underline break-all"
                >
                  omarshahieeen@gmail.com
                </a>
              </p>
              <p>
                A personal project. Sign-in is handled by Firebase Authentication, and your
                display name, email and messages are stored only to run your chats.
              </p>
            </div>

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
