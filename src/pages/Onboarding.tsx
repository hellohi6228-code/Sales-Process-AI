import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/SupabaseClient';
import { useAppContext } from '../AppContext';

// 15 individual PNGs you placed in /public/
// Vite serves public/ at the root, so the URL is just /1.png, /2.png … /15.png
export const AVATARS = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  src: `/${i + 1}.png`,
}));

const GOALS = [
  { id: 'close', label: 'Close more deals', sub: 'Track leads and move pipelines faster' },
  { id: 'process', label: 'Sharpen my process', sub: 'Document and refine my sales playbook' },
  { id: 'team', label: 'Align my team', sub: 'Coordinate strategy across reps' },
];

const DEAL_SIZES = [
  { id: 'smb', label: 'Under $10k', sub: 'SMB' },
  { id: 'mid', label: '$10k – $100k', sub: 'Mid-market' },
  { id: 'ent', label: 'Over $100k', sub: 'Enterprise' },
];

interface OnboardingData {
  goal: string;
  dealSize: string;
  name: string;
  avatarId: number | null;
}

export function Onboarding() {
  const { setOnboardingComplete, setUserProfile } = useAppContext();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    goal: '',
    dealSize: '',
    name: '',
    avatarId: null,
  });

  const advance = () => { setDirection(1); setStep((s) => s + 1); };
  const back    = () => { setDirection(-1); setStep((s) => s - 1); };

  const finish = async () => {
    setSaving(true);
    try {
      const profile = {
        goal: data.goal,
        deal_size: data.dealSize,
        full_name: data.name,
        avatar_id: data.avatarId,
        onboarding_complete: true,
      };
      // Persist to Supabase user metadata (survives logout/login)
      await supabase.auth.updateUser({ data: profile });
      // Also write to localStorage for instant reads without a network call
      localStorage.setItem('user_profile', JSON.stringify(profile));
      setUserProfile(profile);
      setOnboardingComplete(true);
      navigate('/', { replace: true });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const variants = {
    enter:  (dir: number) => ({ x: dir * 40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit:   (dir: number) => ({ x: dir * -40, opacity: 0 }),
  };

  const canAdvanceStep0 = data.goal !== '';
  const canAdvanceStep1 = data.dealSize !== '';
  const canFinish = data.name.trim() !== '' && data.avatarId !== null;

  return (
    <div className="relative flex h-screen w-full bg-[#f4f4f5] dark:bg-[#09090b] overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans items-center justify-center p-4">
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-sky-200/40 mix-blend-multiply filter blur-[80px] opacity-60 pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[35vw] h-[35vw] rounded-full bg-sky-300/40 mix-blend-multiply filter blur-[80px] opacity-60 pointer-events-none" />

      <div className="w-full max-w-lg z-10 flex flex-col items-center">

        {/* Progress dots */}
        <div className="flex gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step
                  ? 'w-8 bg-neutral-900 dark:bg-white'
                  : i < step
                  ? 'w-4 bg-neutral-400 dark:bg-neutral-600'
                  : 'w-4 bg-neutral-200 dark:bg-neutral-800'
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={direction}>

          {/* ── STEP 1: Goal ── */}
          {step === 0 && (
            <motion.div
              key="step-0"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-full"
            >
              <div className="text-center mb-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Step 1 of 3</p>
                <h1 className="text-3xl font-bold mb-2">What's your main goal?</h1>
                <p className="text-neutral-500 text-sm">We'll set up your workspace around this.</p>
              </div>

              <div className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 rounded-[24px] p-6 shadow-xl space-y-3">
                {GOALS.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setData((d) => ({ ...d, goal: g.id }))}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all active:scale-[0.98] ${
                      data.goal === g.id
                        ? 'border-neutral-900 dark:border-white bg-neutral-900/5 dark:bg-white/5'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-700/40'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-sm">{g.label}</div>
                      <div className="text-xs text-neutral-500 mt-0.5">{g.sub}</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 transition-colors ${
                      data.goal === g.id
                        ? 'border-neutral-900 dark:border-white bg-neutral-900 dark:bg-white'
                        : 'border-neutral-300 dark:border-neutral-600'
                    }`} />
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <button
                  onClick={advance}
                  disabled={!canAdvanceStep0}
                  className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-40"
                >
                  Continue →
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 2: Deal size ── */}
          {step === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-full"
            >
              <div className="text-center mb-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Step 2 of 3</p>
                <h1 className="text-3xl font-bold mb-2">What's your typical deal size?</h1>
                <p className="text-neutral-500 text-sm">Helps us surface the right sales stages for you.</p>
              </div>

              <div className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 rounded-[24px] p-6 shadow-xl grid grid-cols-3 gap-3">
                {DEAL_SIZES.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setData((prev) => ({ ...prev, dealSize: d.id }))}
                    className={`flex flex-col items-center gap-1.5 p-5 rounded-xl border text-center transition-all active:scale-[0.98] ${
                      data.dealSize === d.id
                        ? 'border-neutral-900 dark:border-white bg-neutral-900/5 dark:bg-white/5'
                        : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-700/40'
                    }`}
                  >
                    <span className="font-bold text-sm">{d.label}</span>
                    <span className="text-xs text-neutral-500">{d.sub}</span>
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={advance}
                  disabled={!canAdvanceStep1}
                  className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-40"
                >
                  Continue →
                </button>
                <button onClick={back} className="w-full text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors py-2">
                  ← Back
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Name + Avatar ── */}
          {step === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="w-full"
            >
              <div className="text-center mb-8">
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Step 3 of 3</p>
                <h1 className="text-3xl font-bold mb-2">Set up your profile</h1>
                <p className="text-neutral-500 text-sm">Your teammates will see your name and avatar.</p>
              </div>

              <div className="bg-white/60 dark:bg-neutral-800/60 backdrop-blur-md border border-white dark:border-neutral-700 rounded-[24px] p-6 shadow-xl space-y-6">

                {/* Name */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Your name
                  </label>
                  <input
                    type="text"
                    value={data.name}
                    onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
                    placeholder="e.g. Jordan Smith"
                    className="w-full p-4 bg-transparent border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100 transition-shadow"
                  />
                </div>

                {/* Avatar picker */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                    Choose your avatar
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {AVATARS.map((av) => {
                      const isSelected = data.avatarId === av.id;
                      return (
                        <button
                          key={av.id}
                          onClick={() => setData((d) => ({ ...d, avatarId: av.id }))}
                          className={`relative aspect-square rounded-xl overflow-hidden transition-all active:scale-95 ${
                            isSelected
                              ? 'ring-2 ring-neutral-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-neutral-800 scale-105'
                              : 'opacity-75 hover:opacity-100 hover:scale-105'
                          }`}
                        >
                          <img
                            src={av.src}
                            alt={`Avatar ${av.id + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/20">
                              <svg className="w-5 h-5 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {data.avatarId === null && (
                    <p className="text-xs text-amber-500 mt-2">Pick an avatar to continue.</p>
                  )}
                </div>

              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={finish}
                  disabled={saving || !canFinish}
                  className="w-full py-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold rounded-xl text-sm transition-transform active:scale-95 shadow-sm hover:shadow disabled:opacity-40"
                >
                  {saving ? 'Setting up your workspace…' : 'Enter my workspace →'}
                </button>
                <button onClick={back} className="w-full text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors py-2">
                  ← Back
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
