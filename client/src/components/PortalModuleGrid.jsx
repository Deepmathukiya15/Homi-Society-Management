import { ChevronRight } from 'lucide-react';
import { Pill, SectionCard } from './ui.jsx';

const TONES = {
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  violet: 'bg-violet-50 text-violet-600 border-violet-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
  sky: 'bg-sky-50 text-sky-600 border-sky-100',
  rose: 'bg-rose-50 text-rose-600 border-rose-100',
};

export default function PortalModuleGrid({ modules = [], onOpen }) {
  return (
    <SectionCard className="p-4 sm:p-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <button
              key={module.id}
              type="button"
              onClick={() => onOpen?.(module.id)}
              className="group min-h-[112px] rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${TONES[module.tone] || TONES.indigo}`}>
                  {Icon && <Icon className="h-5 w-5" />}
                </div>
                <div className="flex items-center gap-2">
                  {module.badge > 0 && <Pill className="bg-amber-50 text-amber-700 border border-amber-200">{module.badge}</Pill>}
                  <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                </div>
              </div>
              <div className="mt-3 text-sm font-bold text-slate-900">{module.label}</div>
              {module.description && <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">{module.description}</p>}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
