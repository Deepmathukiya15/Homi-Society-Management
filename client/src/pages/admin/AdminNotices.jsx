import { useEffect, useState } from 'react';
import { Bell, Megaphone, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import { Button, EmptyState, Field, Input, Modal, Pill, SectionCard, Select, TextArea } from '../../components/ui.jsx';
import { noticeApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { NOTICE_PILL, PRIORITY_PILL, timeAgo } from '../../lib/format.js';
import { NOTICE_CATEGORIES } from '../../lib/constants.js';

export default function AdminNotices({ openSignal = 0 }) {
  const toast = useToast();
  const [notices, setNotices] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'GENERAL', priority: 'NORMAL', isPinned: false });

  const load = async () => {
    try {
      const res = await noticeApi.list();
      setNotices(res.notices);
    } catch (err) {
      toast.alert('Notice Board Error', err.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  const publish = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast.warning('Incomplete Notice', 'A title and description are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await noticeApi.create(form);
      toast.success('Notice Published', res.message);
      setForm({ title: '', content: '', category: 'GENERAL', priority: 'NORMAL', isPinned: false });
      setOpen(false);
      load();
    } catch (err) {
      toast.alert('Publish Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (notice) => {
    try {
      await noticeApi.remove(notice._id);
      toast.info('Notice Deleted', 'Notice removed from board.');
      load();
    } catch (err) {
      toast.alert('Delete Failed', err.message);
    }
  };

  const togglePin = async (notice) => {
    try {
      const res = await noticeApi.togglePin(notice._id);
      toast.success('Notice Board Updated', res.message);
      load();
    } catch (err) {
      toast.alert('Pin Failed', err.message);
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Digital Notice Board Management</h3>
            <p className="text-xs text-slate-500 font-medium">
              {notices.length} notices live • {notices.filter((n) => n.isPinned).length} pinned to the top
            </p>
          </div>
        </div>
        <Button icon={Plus} onClick={() => setOpen(true)}>
          Publish Notice
        </Button>
      </SectionCard>

      {notices.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Megaphone} title="Notice board is empty" message="Publish the first society announcement." />
        </SectionCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {notices.map((notice) => (
            <div key={notice._id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3 animate-fade-in">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Pill className={NOTICE_PILL[notice.category]}>{notice.category}</Pill>
                    <Pill className={PRIORITY_PILL[notice.priority]}>{notice.priority}</Pill>
                    {notice.isPinned && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full uppercase">
                        Pinned
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-2">{notice.title}</h4>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => togglePin(notice)}
                    className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title={notice.isPinned ? 'Unpin notice' : 'Pin notice to top'}
                  >
                    {notice.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => remove(notice)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete notice"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{notice.content}</p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                <span>Posted by {notice.postedBy}</span>
                <span>{timeAgo(notice.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Publish New Society Notice"
        subtitle="Published notices appear on resident portals right away"
        icon={Megaphone}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={publish} disabled={saving}>
              {saving ? 'Publishing…' : 'Publish Notice'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <Field label="Notice Title">
            <Input
              placeholder="e.g. Water Supply Interruption on 18 September"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <TextArea
              rows={5}
              placeholder="Details of the announcement…"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Category">
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {NOTICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {['NORMAL', 'HIGH', 'CRITICAL'].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Pin this notice to the top of the board
          </label>
        </div>
      </Modal>
    </div>
  );
}
