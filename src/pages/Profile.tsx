import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/SupabaseClient';
import { useAppContext } from '../AppContext';
import { updateTeamProfileInDrive } from '../lib/googleDrive';

// Mirror of the AVATARS constant from Onboarding.tsx
const AVATARS = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  src: `/${i + 1}.png`,
}));

function AvatarDisplay({ avatarId, size = 72 }: { avatarId: number | null | undefined; size?: number }) {
  const src = avatarId != null ? `/${avatarId + 1}.png` : `/1.png`;

  return (
    <div
      className="rounded-full overflow-hidden ring-2 ring-neutral-200 dark:ring-neutral-700 flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt="Avatar"
        className="w-full h-full object-cover"
      />
    </div>
  );
}

function AvatarPicker({ selected, onSelect }: { selected: number | null; onSelect: (id: number) => void }) {
  const DISPLAY = 52;

  return (
    <div className="grid grid-cols-5 gap-2">
      {AVATARS.map((av) => {
        const isSelected = selected === av.id;
        return (
          <button
            key={av.id}
            type="button"
            onClick={() => onSelect(av.id)}
            className={`relative rounded-xl overflow-hidden transition-all active:scale-95 ${
              isSelected
                ? 'ring-2 ring-neutral-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-neutral-800 scale-105'
                : 'hover:scale-105 opacity-75 hover:opacity-100'
            }`}
            style={{ width: DISPLAY, height: DISPLAY }}
          >
            <img
              src={av.src}
              alt={`Avatar ${av.id + 1}`}
              className="w-full h-full object-cover"
            />
            {isSelected && (
              <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/20">
                <svg className="w-4 h-4 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Profile() {
  const { session, userProfile, setUserProfile } = useAppContext();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [avatarId, setAvatarId] = useState<number | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (session?.user?.email) setEmail(session.user.email);
    const userId = session?.user?.id;
    const profile = userProfile ?? (() => {
      if (!userId) return {};
      try { return JSON.parse(localStorage.getItem(`user_profile_${userId}`) ?? '{}'); } catch { return {}; }
    })();
    if (profile?.full_name) setFullName(profile.full_name);
    if (profile?.avatar_id != null) setAvatarId(profile.avatar_id);
  }, [session, userProfile]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const authUpdates: any = {};
      if (email !== session?.user?.email) authUpdates.email = email;
      if (password) {
        if (password !== confirmPassword) throw new Error('Passwords do not match');
        authUpdates.password = password;
      }

      const profileData = {
        ...(userProfile ?? {}),
        full_name: fullName,
        avatar_id: avatarId,
        onboarding_complete: true,
      };

      // Always update profile metadata
      authUpdates.data = profileData;

      const { error } = await supabase.auth.updateUser(authUpdates);
      if (error) throw error;

      const userId = session?.user?.id;
      if (userId) {
        localStorage.setItem(`user_profile_${userId}`, JSON.stringify(profileData));
      }

      // Sync to Google Drive
      try {
        await updateTeamProfileInDrive({ name: fullName, avatarId: avatarId });
      } catch (err) {
        console.error('Failed to sync profile to Drive:', err);
      }

      setUserProfile(profileData);
      setMessage('Profile updated successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      {/* Profile header card */}
      <div className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 rounded-[24px] p-6 shadow-sm flex items-center gap-5">
        <AvatarDisplay avatarId={avatarId} size={72} />
        <div>
          <p className="text-lg font-bold text-neutral-900 dark:text-white">
            {fullName || session?.user?.email?.split('@')[0] || 'Your Profile'}
          </p>
          <p className="text-sm text-neutral-500">{session?.user?.email}</p>
        </div>
      </div>

      {/* Edit form */}
      <div className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 rounded-[24px] p-8 shadow-sm">
        <h2 className="text-xl font-bold mb-6 text-neutral-900 dark:text-white">Profile Settings</h2>

        <form onSubmit={handleUpdate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your name"
              className="w-full p-4 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
            />
            <p className="text-xs text-neutral-500 mt-1">If you change your email, you'll need to verify the new address.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">
              Avatar
            </label>
            <AvatarPicker selected={avatarId} onSelect={setAvatarId} />
          </div>

          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-white mt-6 mb-4">Change Password</h3>
            <div className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="New password (leave blank to keep current)"
                className="w-full p-4 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                disabled={!password}
                className="w-full p-4 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow disabled:opacity-40"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm font-medium text-red-500 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg border border-red-200 dark:border-red-800">
              {error}
            </div>
          )}
          {message && (
            <div className="text-sm font-medium text-green-600 bg-green-50 dark:bg-green-900/10 p-3 rounded-lg border border-green-200 dark:border-green-800">
              {message}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="py-3 px-6 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-50"
            >
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
