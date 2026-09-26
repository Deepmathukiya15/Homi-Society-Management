import { AlertTriangle, CheckCircle2, Info, Siren, X } from 'lucide-react';
import { useToast } from '../context/ToastContext.jsx';

const STYLES = {
  INFO: { shell: 'bg-white border-indigo-200 text-slate-900 shadow-lg', icon: Info, tone: 'text-indigo-600' },
  SUCCESS: { shell: 'bg-white border-emerald-200 text-slate-900 shadow-lg', icon: CheckCircle2, tone: 'text-emerald-600' },
  WARNING: { shell: 'bg-white border-amber-200 text-slate-900 shadow-lg', icon: AlertTriangle, tone: 'text-amber-600' },
  ALERT: {
    shell: 'bg-white border-rose-300 text-slate-900 shadow-xl ring-2 ring-rose-100',
    icon: Siren,
    tone: 'text-rose-600',
  },
};

export default function ToastStack() {
  const { toasts, removeToast } = useToast();
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-3 max-w-sm w-[calc(100vw-2.5rem)] sm:w-full pointer-events-none">
      {toasts.map((toast) => {
        const style = STYLES[toast.type] || STYLES.INFO;
        const Icon = style.icon;
        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border transition-all duration-300 animate-rise ${style.shell}`}
          >
            <div className="mt-0.5 shrink-0">
              <Icon className={`w-5 h-5 ${style.tone}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold truncate text-slate-900">{toast.title}</h4>
                <span className="text-[10px] text-slate-400 shrink-0 font-mono">{toast.timestamp}</span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
