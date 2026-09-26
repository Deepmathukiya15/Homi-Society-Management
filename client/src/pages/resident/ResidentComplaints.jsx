import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock4, Plus, Send, Wrench } from 'lucide-react';
import { Button, EmptyState, Field, Input, Pill, SectionCard, SectionHeader, Select, TextArea } from '../../components/ui.jsx';
import { complaintApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { dateTimeShort, PRIORITY_PILL, TICKET_PILL, timeAgo } from '../../lib/format.js';
import { COMPLAINT_CATEGORIES, COMPLAINT_PRIORITIES } from '../../lib/constants.js';

export default function ResidentComplaints({ onChanged }) {
  const toast = useToast();
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [form, setForm] = useState({ category: 'PLUMBING', title: '', description: '', priority: 'MEDIUM' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    try {
      const res = await complaintApi.list({});
      setComplaints(res.complaints);
    } catch (err) {
      toast.alert('Helpdesk Error', err.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.title.trim()) {
      toast.warning('Issue Title Required', 'Describe the issue so the maintenance team can act on it.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await complaintApi.create(form);
      toast.success('Ticket Raised', res.message);
      setForm({ category: 'PLUMBING', title: '', description: '', priority: 'MEDIUM' });
      load();
      onChanged?.();
    } catch (err) {
      toast.alert('Ticket Failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openCount = complaints.filter((c) => c.status !== 'RESOLVED').length;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <SectionCard className="p-5">
        <SectionHeader
          title="Raise Helpdesk Ticket"
          subtitle={`Maintenance team will be notified for Flat ${user?.flatId}`}
        />
        <form onSubmit={submit} className="mt-5 space-y-4">
          <Field label="Issue Category">
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {COMPLAINT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Issue Title">
            <Input
              placeholder="e.g. Bathroom tap leakage"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <TextArea
              rows={4}
              placeholder="Provide details of the problem…"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="Priority">
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {COMPLAINT_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" size="lg" icon={Send} className="w-full" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Ticket'}
          </Button>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 font-medium flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-slate-400 shrink-0" />
            Your ticket is sent to the society admin and appears in the helpdesk queue.
          </div>
        </form>
      </SectionCard>

      <div className="xl:col-span-2 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] text-slate-500 font-medium">Total Tickets</div>
            <div className="text-xl font-black text-slate-900 font-mono mt-1">{complaints.length}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <Clock4 className="w-3 h-3 text-amber-500" /> Open
            </div>
            <div className="text-xl font-black text-amber-600 font-mono mt-1">{openCount}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
            <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Resolved
            </div>
            <div className="text-xl font-black text-emerald-600 font-mono mt-1">{complaints.length - openCount}</div>
          </div>
        </div>

        {complaints.length === 0 ? (
          <SectionCard>
            <EmptyState icon={Wrench} title="No tickets raised yet" message="Report a plumbing, electrical or lift issue using the form." />
          </SectionCard>
        ) : (
          complaints.map((complaint) => (
            <div key={complaint._id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] font-bold text-slate-500">{complaint.ticketNo}</span>
                <Pill className={TICKET_PILL[complaint.status]}>{complaint.status.replace('_', ' ')}</Pill>
                <Pill className={PRIORITY_PILL[complaint.priority]}>{complaint.priority}</Pill>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  {complaint.category}
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900">{complaint.title}</h4>
              <p className="text-xs text-slate-600 leading-relaxed">{complaint.description}</p>
              {complaint.adminRemarks && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-[11px] text-emerald-800">
                  <strong>Admin Remarks:</strong> {complaint.adminRemarks}
                </div>
              )}
              <div className="text-[10px] text-slate-500 font-medium">
                Raised {timeAgo(complaint.createdAt)}
                {complaint.resolvedAt ? ` • resolved ${dateTimeShort(complaint.resolvedAt)}` : ''}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
