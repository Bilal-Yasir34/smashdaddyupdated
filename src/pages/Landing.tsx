import { ArrowRight, Lock, ClipboardList, Sparkles, ChefHat, BarChart2 } from 'lucide-react';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';

interface LandingProps {
  onAdmin: () => void;
  onOrder: () => void;
}

export default function Landing({ onAdmin, onOrder }: LandingProps) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white relative overflow-hidden flex flex-col items-center justify-center p-4 sm:p-6">
      {/* Top right theme toggle */}
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle />
      </div>

      {/* Ambient background glow orbs */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-yellow-400/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-20 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 -right-20 w-[400px] h-[400px] bg-yellow-500/5 rounded-full blur-[90px] pointer-events-none" />

      <div className="relative w-full max-w-xl text-center z-10 space-y-8">
        {/* Logo & Header Title */}
        <div className="flex flex-col items-center animate-[fadeInUp_0.6s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-xl animate-pulse" />
            <Logo size={130} className="relative z-10 drop-shadow-2xl transition-transform hover:scale-105" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles size={13} /> Premium POS Suite
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-tight drop-shadow-sm">
            SMASH <span className="text-yellow-400">DADDY</span>
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base max-w-sm mt-2 font-medium">
            Fast, intuitive point of sale & kitchen display system
          </p>
        </div>

        {/* Primary Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-[scaleIn_0.5s_cubic-bezier(0.16,1,0.3,1)]">
          {/* Take Order Card */}
          <button
            type="button"
            onClick={onOrder}
            className="group relative bg-yellow-400 hover:bg-yellow-300 text-black rounded-3xl p-6 text-left transition-all duration-300 hover:-translate-y-1 active:scale-95 shadow-xl hover:shadow-2xl hover:shadow-yellow-400/30 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-black/10 flex items-center justify-center font-bold">
                <ClipboardList size={26} className="text-black" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-black/15 text-black px-2.5 py-1 rounded-full">
                POS & KDS
              </span>
            </div>

            <h2 className="text-2xl font-black tracking-wide">Take Order</h2>
            <p className="text-black/75 text-xs font-semibold mt-1">
              Punch new orders, manage cart & live KDS queue
            </p>

            <div className="flex items-center gap-1.5 mt-5 text-xs font-black uppercase tracking-wider group-hover:translate-x-1 transition-transform">
              Open Portal <ArrowRight size={15} />
            </div>
          </button>

          {/* Admin Portal Card */}
          <button
            type="button"
            onClick={onAdmin}
            className="group relative glass-card bg-zinc-900/80 hover:bg-zinc-900 border border-zinc-800 hover:border-yellow-400/50 text-white rounded-3xl p-6 text-left transition-all duration-300 hover:-translate-y-1 active:scale-95 shadow-xl hover:shadow-yellow-400/10 overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center">
                <Lock size={24} className="text-yellow-400" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full border border-zinc-700">
                Management
              </span>
            </div>

            <h2 className="text-2xl font-black tracking-wide text-white">Admin Portal</h2>
            <p className="text-zinc-400 text-xs mt-1">
              Manage menu items, inventory, staff & analytics
            </p>

            <div className="flex items-center gap-1.5 mt-5 text-xs font-black uppercase tracking-wider text-yellow-400 group-hover:translate-x-1 transition-transform">
              Admin Login <ArrowRight size={15} />
            </div>
          </button>
        </div>

        {/* Bottom Highlights & Footer */}
        <div className="pt-2">
          <div className="flex items-center justify-center gap-6 text-xs font-semibold text-zinc-400">
            <span className="flex items-center gap-1.5">
              <ChefHat size={14} className="text-yellow-400" /> KDS Timer Queue
            </span>
            <span className="flex items-center gap-1.5">
              <BarChart2 size={14} className="text-yellow-400" /> Sales Analytics
            </span>
          </div>

          <p className="text-zinc-500 text-xs mt-6 font-medium">
            Smash Daddy POS System — Powered by Bilal Yasir
          </p>
        </div>
      </div>
    </div>
  );
}
