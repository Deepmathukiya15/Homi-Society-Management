import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, MapPin, Pencil, Plus, XCircle } from 'lucide-react';
import { Button, EmptyState, Field, Input, Modal, SectionCard, TextArea } from '../../components/ui.jsx';
import { meetingApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const blankForm = { title: '', description: '', startAt: '', endAt: '', location: '' };
const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};
const readableDate = (value) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function CommitteeMeetings() {
  const toast = useToast();
  const [meetings, setMeetings] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await meetingApi.list();
      setMeetings(data.meetings || []);
    } catch (err) {
      toast.alert('Meetings Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startCreate = () => { setEditing(null); setForm(blankForm); setOpen(true); };
  const startEdit = (meeting) => {
    setEditing(meeting);
    setForm({
      title: meeting.title || '',
      description: meeting.description || '',
      startAt: toLocalInput(meeting.startAt),
      endAt: toLocalInput(meeting.endAt),
      location: meeting.location || '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.startAt || !form.location.trim()) {
      toast.warning('Missing details', 'Meeting title, date and time, and location are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, endAt: form.endAt || null };
      const result = editing ? await meetingApi.update(editing._id, payload) : await meetingApi.create(payload);
      toast.success(editing ? 'Meeting Updated' : 'Meeting Scheduled', result.message);
      setOpen(false);
      setEditing(null);
      setForm(blankForm);
      await load();
    } catch (err) {
      toast.alert('Could Not Save Meeting', err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelMeeting = async (meeting) => {
    if (!window.confirm(`Cancel “${meeting.title}”?`)) return;
    setBusyId(meeting._id);
    try {
      const result = await meetingApi.cancel(meeting._id);
      setMeetings((current) => current.map((item) => item._id === meeting._id ? result.meeting : item));
      toast.info('Meeting Cancelled', result.message);
    } catch (err) {
      toast.alert('Could Not Cancel Meeting', err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center"><CalendarDays className="w-5 h-5" /></div>
          <div><h2 className="text-sm font-bold text-slate-900">Society meetings</h2><p className="text-xs text-slate-500">{meetings.filter((meeting) => meeting.status !== 'CANCELLED').length} scheduled • visible to committee and admins</p></div>
        </div>
        <Button icon={Plus} onClick={startCreate}>Schedule Meeting</Button>
      </SectionCard>

      {loading ? <SectionCard className="p-6 text-center text-sm text-slate-500">Loading meetings…</SectionCard> : meetings.length === 0 ? (
        <SectionCard><EmptyState icon={CalendarDays} title="No meetings scheduled" message="Schedule the first society or committee meeting." /></SectionCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {meetings.map((meeting) => (
            <article key={meeting._id} className={`bg-white border rounded-2xl p-5 shadow-xs space-y-3 ${meeting.status === 'CANCELLED' ? 'border-rose-200 opacity-75' : 'border-slate-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-sm font-bold text-slate-900">{meeting.title}</h3><p className="text-[10px] text-slate-500 mt-1">{meeting.status === 'CANCELLED' ? 'CANCELLED' : 'SCHEDULED'} • Added by {meeting.createdBy}</p></div>
                {meeting.status !== 'CANCELLED' && <div className="flex items-center gap-1 shrink-0">
                  <button type="button" title="Edit meeting" onClick={() => startEdit(meeting)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"><Pencil className="w-4 h-4" /></button>
                  <button type="button" title="Cancel meeting" disabled={busyId === meeting._id} onClick={() => cancelMeeting(meeting)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50"><XCircle className="w-4 h-4" /></button>
                </div>}
              </div>
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2"><Clock3 className="w-3.5 h-3.5 text-indigo-500" /><span>{readableDate(meeting.startAt)}{meeting.endAt ? ` – ${new Date(meeting.endAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</span></div>
                <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-indigo-500" /><span>{meeting.location}</span></div>
              </div>
              {meeting.description && <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">{meeting.description}</p>}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit Society Meeting' : 'Schedule a Society Meeting'}
        subtitle="Set the time, venue, and details for residents and committee members."
        icon={CalendarDays}
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Schedule Meeting'}</Button></div>}
      >
        <div className="space-y-3.5">
          <Field label="Meeting title"><Input placeholder="e.g. Monthly Society Committee Meeting" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Start date and time"><Input type="datetime-local" value={form.startAt} onChange={(event) => setForm({ ...form, startAt: event.target.value })} /></Field>
            <Field label="End date and time (optional)"><Input type="datetime-local" value={form.endAt} onChange={(event) => setForm({ ...form, endAt: event.target.value })} /></Field>
          </div>
          <Field label="Location"><Input placeholder="e.g. Clubhouse meeting room" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></Field>
          <Field label="Agenda / details (optional)"><TextArea rows={4} placeholder="Meeting agenda and any details attendees should know…" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
