import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock, Loader2, MessageSquare, Wrench } from 'lucide-react';
import { Button, EmptyState, Field, Modal, Pill, SectionCard, Select, TextArea } from '../../components/ui.jsx';
import { complaintApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { dateTimeShort, PRIORITY_PILL, TICKET_PILL, timeAgo } from '../../lib/format.js';
import { COMPLAINT_CATEGORIES, TICKET_STATUSES } from '../../lib/constants.js';

export default function AdminComplaints() {
  const toast = useToast();
  const [complaints, setComplaints] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [active, setActive] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await complaintApi.list({ status, category });
      setComplaints(res.complaints);
    } catch (err) {
      toast.alert('Helpdesk Error', err.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category]);

  const update = async (complaint, nextStatus, note) => {
    setSaving(true);
    try {
      const res = await complaintApi.setStatus(complaint._id, nextStatus, note ?? remarks);
      toast.success('Complaint Updated', res.message);
      setActive(null);
      setRemarks('');
      load();
    } catch (err) {
      toast.alert('Update Failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  const counts = TICKET_STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: complaints.filter((c) => c.status === s).length }),
    {}
  );

  return (
    <div className="space-y-5">
      <SectionCard className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          {['ALL', ...TICKET_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                status === s ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s}
              {s !== 'ALL' && <span className="ml-1.5 opacity-70">({counts[s] ?? 0})</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Category:</span>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="!w-44 !py-1.5 !text-xs">
            {['ALL', ...COMPLAINT_CATEGORIES].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
      </SectionCard>

      {complaints.length === 0 ? (
        <SectionCard>
          <EmptyState icon={Wrench} title="No tickets in this queue" message="Resident grievances will appear here in real time." />
        </SectionCard>
      ) : (
        <div className="space-y-3">
          {complaints.map((complaint) => (
            <div key={complaint._id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px] font-bold text-slate-500">{complaint.ticketNo}</span>
                    <Pill className={TICKET_PILL[complaint.status]}>{complaint.status.replace('_', ' ')}</Pill>
                    <Pill className={PRIORITY_PILL[complaint.priority]}>{complaint.priority}</Pill>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                      {complaint.category}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mt-2">{complaint.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{complaint.description}</p>
                  <div className="text-[10px] text-slate-500 font-medium mt-2">
                    Flat <strong className="text-slate-700 font-mono">{complaint.flatId}</strong> • {complaint.residentName} •
                    raised {timeAgo(complaint.createdAt)}
                    {complaint.resolvedAt ? ` • resolved ${dateTimeShort(complaint.resolvedAt)}` : ''}
                  </div>
                  {complaint.adminRemarks && (
                    <div className="mt-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-[11px] text-emerald-800">
                      <strong>Admin Remarks:</strong> {complaint.adminRemarks}
                    </div>
                  )}
                </div>

                <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                  {complaint.status === 'PENDING' && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={saving ? Loader2 : Clock}
                      onClick={() => update(complaint, 'IN_PROGRESS')}
                      disabled={saving}
                    >
                      Mark In Progress
                    </Button>
                  )}
                  {complaint.status !== 'RESOLVED' && (
                    <Button
                      variant="success"
                      size="sm"
                      icon={CheckCircle2}
                      onClick={() => {
                        setActive(complaint);
                        setRemarks('');
                      }}
                    >
                      Mark Resolved
                    </Button>
                  )}
                  {complaint.status === 'RESOLVED' && (
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Closed
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title="Resolve Helpdesk Ticket"
        subtitle={active ? `${active.ticketNo} • Flat ${active.flatId}` : ''}
        icon={MessageSquare}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button variant="success" icon={CheckCircle2} onClick={() => update(active, 'RESOLVED')} disabled={saving}>
              {saving ? 'Saving…' : 'Mark Resolved'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="text-xs font-bold text-slate-900">{active?.title}</div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{active?.description}</p>
          </div>
          <Field label="Admin Remarks">
            <TextArea
              rows={3}
              placeholder="Action taken by Society Management Committee…"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </Field>
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
            The resident receives a live socket notification with these remarks.
          </div>
        </div>
      </Modal>
    </div>
  );
}
