import { useState } from 'react';
import { Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import Logo from '../components/Logo';
import { loginAdmin } from '../lib/auth';
import ThemeToggle from '../components/ThemeToggle';

interface AdminLoginProps {
  onSuccess: () => void;
  onBack: () => void;
}

export default function AdminLogin({ onSuccess, onBack }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      if (loginAdmin(password)) {
        onSuccess();
      } else {
        setError('Incorrect password. Try again.');
        setLoading(false);
      }
    }, 400);
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      {/* glow background */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-yellow-400/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 animate-[fadeIn_0.5s_ease-out]">
          <Logo size={80} className="mb-4 animate-[bounce_2s_ease-in-out_infinite]" />
          <h1 className="text-3xl font-black text-white tracking-tight">
            SMASH <span className="text-yellow-400">DADDY</span>
          </h1>
          <p className="text-zinc-500 text-sm mt-1">Admin Portal</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-2xl p-6 shadow-2xl animate-[scaleIn_0.4s_cubic-bezier(0.16,1,0.3,1)]"
        >
          <label className="block text-sm font-medium text-zinc-300 mb-2">Admin Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="Enter password"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-10 pr-10 py-3 text-white placeholder-zinc-600 focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 outline-none transition-all"
            />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <p className="text-red-400 text-sm mt-3 animate-[fadeIn_0.2s_ease-out]">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full mt-5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-zinc-800 disabled:text-zinc-600 text-black font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all hover:shadow-lg hover:shadow-yellow-400/30 active:scale-[0.98]"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <>
                Login <ArrowRight size={18} />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onBack}
            className="w-full mt-3 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            Back to home
          </button>
        </form>

        <p className="text-center text-zinc-600 text-xs mt-6">
        </p>
      </div>
    </div>
  );
}
