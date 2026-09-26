import { useState } from 'react';
import { Bell, CalendarDays, ShieldCheck } from 'lucide-react';
import AdminNotices from '../admin/AdminNotices.jsx';
import CommitteeMeetings from './CommitteeMeetings.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const SECTIONS = [
  { id: 'NOTICES', label: 'Notices', icon: Bell },
  { id: 'MEETINGS', label: 'Meetings', icon: CalendarDays },
];

export default function CommitteePortal() {
  const { user } = useAuth();
  const [section, setSection] = useState('NOTICES');
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8fafc] text-slate-800 p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <section className="bg-white border border-slate-200 p-5 sm:p-6 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-700"><ShieldCheck className="w-7 h-7" /></div>
          <div><p className="text-[10px] font-black uppercase tracking-wider text-violet-600">Committee workspace</p><h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">Notices &amp; Meetings</h1><p className="text-xs text-slate-500 mt-1">Signed in as {user?.name} • Committee access</p></div>
        </div>
        <nav className="flex gap-2" aria-label="Committee modules">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setSection(id)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors ${section === id ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </nav>
      </section>
      {section === 'NOTICES' ? <AdminNotices key="committee-notices" /> : <CommitteeMeetings key="committee-meetings" />}
    </main>
  );
}
