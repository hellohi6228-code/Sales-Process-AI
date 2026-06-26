import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/SupabaseClient';
import { motion } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { useAppContext } from '../AppContext';

export function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const { session, onboardingComplete } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) {
      // New users (onboarding not complete) → onboarding; returning users → app
      navigate(onboardingComplete ? '/' : '/onboarding', { replace: true });
    }
  }, [session, onboardingComplete, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
        },
      });

      if (error) {
        setError(error.message);
      } else if (data?.session) {
        setMessage('Sign up successful! Logging in...');
      } else {
        setMessage('Check your email for the confirmation link.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'google') => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          scopes: 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      if (error) setError(error.message);
      if (data?.url) {
        window.open(data.url, 'oauth_popup', 'width=600,height=700');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up');
    }
  };

  if (session) return null;

  return (
    <div className="relative flex h-screen w-full bg-[#f4f4f5] dark:bg-[#09090b] overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans selection:bg-blue-500/30 items-center justify-center p-4">
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] flex-shrink-0 rounded-full bg-sky-200/40 mix-blend-multiply filter blur-[80px] opacity-60"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[35vw] h-[35vw] flex-shrink-0 rounded-full bg-sky-300/40 mix-blend-multiply filter blur-[80px] opacity-60"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Create an Account</h1>
          <p className="text-neutral-500 text-sm">Sign up to get started</p>
        </div>

        <div className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 rounded-[24px] p-8 shadow-xl">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full p-4 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
              />
            </div>

            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full p-4 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
              />
            </div>

            <div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full p-4 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
              />
            </div>

            {error && <div className="text-sm font-medium text-red-500">{error}</div>}
            {message && <div className="text-sm font-medium text-green-500">{message}</div>}

            <button
              type="submit"
              disabled={loading || !email || !password || !confirmPassword}
              className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-50 mt-2"
            >
              {loading ? 'Signing up...' : 'Sign up'}
            </button>
            <div className="text-center mt-4">
              <Link to="/login" className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors">
                Already have an account? Log in
              </Link>
            </div>
          </form>

          <div className="mt-8 mb-6 relative flex items-center justify-center">
            <div className="absolute w-full border-t border-neutral-200 dark:border-neutral-700"></div>
            <span className="relative bg-[#f4f4f5] dark:bg-[#1a1a1c] px-4 text-xs font-medium text-neutral-500">Or continue with</span>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full py-3 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:bg-neutral-50 dark:hover:bg-neutral-700 flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" color="#4285F4"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" color="#34A853"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" color="#FBBC05"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" color="#EA4335"/></svg>
              Google
            </button>
          </div>

        </div>
      </motion.div>
    </div>
  );
}
