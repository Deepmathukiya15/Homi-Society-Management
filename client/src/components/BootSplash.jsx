import Logo from './Logo.jsx';

export default function BootSplash({ message = 'Booting Homi Society OS…' }) {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center gap-6 px-6">
      <div className="max-w-[260px] w-full animate-float">
        <Logo variant="full" />
      </div>
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.18em]">{message}</p>
      </div>
      <div className="w-56 h-1 rounded-full bg-slate-200 overflow-hidden">
        <div className="h-full w-1/2 bg-indigo-600 rounded-full animate-pulse" />
      </div>
    </div>
  );
}
