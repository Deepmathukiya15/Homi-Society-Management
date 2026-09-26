import { useEffect, useState } from 'react';
import { Bell, Megaphone, Pin, Search } from 'lucide-react';
import { EmptyState, Input, Pill, SectionCard } from '../../components/ui.jsx';
import { noticeApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { NOTICE_PILL, PRIORITY_PILL, dateTimeShort, timeAgo } from '../../lib/format.js';

export default function ResidentNotices() {
  const toast = useToast();
  const [notices, setNotices] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await noticeApi.list();
        setNotices(res.notices);
      } catch (err) {
        toast.alert('Notice Board Error', err.message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = notices.filter((n) =>
    `${n.title} ${n.content} ${n.category}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <SectionCard className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Society Notice Board</h3>
            <p className="text-xs text-slate-500 font-medium">
              {notices.length} announcements • {notices.filter((n) => n.isPinned).length} pinned by the committee
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <Input className="!pl-10" placeholder="Search notices…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </SectionCard>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Bell} title="No notices found" message="New announcements from the committee appear here instantly." />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((notice) => (
            <div
              key={notice._id}
              className={`bg-white border rounded-2xl p-5 shadow-xs space-y-3 animate-fade-in ${
                notice.isPinned ? 'border-indigo-200' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Pill className={NOTICE_PILL[notice.category]}>{notice.category}</Pill>
                  <Pill className={PRIORITY_PILL[notice.priority]}>{notice.priority}</Pill>
                  {notice.isPinned && (
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full uppercase flex items-center gap-1">
                      <Pin className="w-3 h-3" /> Pinned
                    </span>
                  )}
                </div>
              </div>
              <h4 className="text-sm font-bold text-slate-900">{notice.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{notice.content}</p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span>Posted by {notice.postedBy}</span>
                <span title={dateTimeShort(notice.createdAt)}>{timeAgo(notice.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
