import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`px-3 py-1.5 rounded-xl border font-bold text-xs transition-all flex items-center gap-1.5 active:scale-95 shadow-sm ${
        theme === 'dark'
          ? 'bg-zinc-900 border-zinc-800 text-yellow-400 hover:border-yellow-400/50 hover:bg-zinc-800'
          : 'bg-white border-zinc-300 text-zinc-900 hover:border-yellow-500 hover:bg-zinc-100'
      } ${className}`}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {theme === 'dark' ? (
        <>
          <Sun size={15} className="text-yellow-400 animate-[spin_10s_linear_infinite]" />
          <span className="hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon size={15} className="text-indigo-600" />
          <span className="hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  );
}
