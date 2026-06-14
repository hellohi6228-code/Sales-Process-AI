import React, { useState } from 'react';
import { supabase } from '../lib/SupabaseClient';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

export function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(error.message);
      } else {
        setMessage('Password updated successfully.');
        setTimeout(() => {
          navigate('/', { replace: true });
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full bg-[#f4f4f5] dark:bg-[#09090b] overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans selection:bg-blue-500/30 items-center justify-center p-4">
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] flex-shrink-0 rounded-full bg-sky-200/40 mix-blend-multiply filter blur-[80px] opacity-60"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[35vw] h-[35vw] flex-shrink-0 rounded-full bg-sky-300/40 mix-blend-multiply filter blur-[80px] opacity-60"></div>
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm z-10"
      >
        <div className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 rounded-[24px] p-8 shadow-xl">
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password"
                className="w-full p-4 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
              />
            </div>

            <div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full p-4 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
              />
            </div>

            {error && <div className="text-sm font-medium text-red-500">{error}</div>}
            {message && <div className="text-sm font-medium text-green-500">{message}</div>}

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-50 mt-2"
            >
              {loading ? 'Updating...' : 'Update password'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
