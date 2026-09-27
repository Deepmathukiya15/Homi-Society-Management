import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Clock, RefreshCw, Sparkles, WalletCards } from 'lucide-react';
import { Button, EmptyState, Field, Input, Modal, Pill, SectionCard, Select, StatCard } from '../../components/ui.jsx';
import { payrollApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';

const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const rupees = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const monthLabel = (value) => {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return value || '—';
  return new Date(`${value}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
};
const when = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function AdminPayroll() {
  const toast = useToast();
  const [data, setData] = useState({ staff: [], records: [], totals: { pending: 0, paid: 0 } });
  const [drafts, setDrafts] = useState({});
  const [month, setMonth] = useState(monthNow());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [paying, setPaying] = useState(null);
  const [paymentMode, setPaymentMode] = useState('BANK_TRANSFER');
  const [reference, setReference] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const result = await payrollApi.staff();
      setData(result);
      setDrafts(Object.fromEntries((result.staff || []).map((person) => [person._id, String(person.monthlySalary || 0)])));
    } catch (error) {
      toast.alert('Salary Register Error', error.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const approved = useMemo(() => data.staff.filter((person) => person.approvalStatus === 'APPROVED'), [data.staff]);

  const saveSalary = async (person) => {
    const value = Number(drafts[person._id]);
    if (!Number.isFinite(value) || value < 0) return toast.alert('Invalid Salary', 'Enter a valid monthly salary amount.');
    setBusy(`salary:${person._id}`);
    try {
      const result = await payrollApi.setMonthlySalary(person._id, value);
      toast.success('Monthly Salary Saved', result.message);
      await load();
    } catch (error) {
      toast.alert('Could Not Save Salary', error.message);
    } finally {
      setBusy('');
    }
  };

  const createRecord = async (person) => {
    setBusy(`record:${person._id}`);
    try {
      const result = await payrollApi.createRecord(person._id, month);
      toast.success('Salary Record Created', result.message);
      await load();
    } catch (error) {
      toast.alert('Could Not Create Salary', error.message);
    } finally {
      setBusy('');
    }
  };

  const submitPaid = async (event) => {
    event.preventDefault();
    if (!paying) return;
    setBusy(`paid:${paying._id}`);
    try {
      const result = await payrollApi.markPaid(paying._id, paymentMode, reference.trim());
      toast.success('Payment Recorded', result.message);
      setPaying(null);
      setReference('');
      await load();
    } catch (error) {
      toast.alert('Could Not Record Payment', error.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Cleaning Staff" value={approved.length} sub="approved accounts" icon={Sparkles} tone="amber" />
        <StatCard label="Salary Pending" value={rupees(data.totals?.pending)} sub="recorded unpaid payroll" icon={Clock} tone="rose" />
        <StatCard label="Salary Recorded Paid" value={rupees(data.totals?.paid)} sub="manual records, not app transfers" icon={BadgeCheck} tone="emerald" />
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950">
        <strong>Payment note:</strong> this page records salary after the society pays by bank, UPI or cash outside HOMI. It does not initiate a bank transfer. Add the transaction reference or cash voucher number when marking salary paid.
      </div>

      <SectionCard
        title="Cleaning Staff & Monthly Salary"
        subtitle="Set each approved cleaner’s monthly salary, then create one salary record for the selected month."
        action={<Button variant="outline" size="sm" icon={RefreshCw} onClick={load} disabled={loading}>Refresh</Button>}
      >
        <div className="mb-4 max-w-xs">
          <Field label="Payroll month">
            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </Field>
        </div>
        {loading ? (
          <div className="py-8 text-center text-sm text-slate-500">Loading staff and salary records…</div>
        ) : data.staff.length === 0 ? (
          <EmptyState icon={Sparkles} title="No cleaning staff registered" message="When someone selects Other (Cleaning Staff) and the admin approves them, they will appear here." />
        ) : (
          <div className="space-y-3">
            {data.staff.map((person) => (
              <div key={person._id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900">{person.name}</h3>
                      <Pill className={person.approvalStatus === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}>
                        {person.approvalStatus || 'APPROVED'}
                      </Pill>
                      {person.staffId && <span className="text-[11px] font-mono text-slate-500">{person.staffId}</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{person.email}{person.contactNumber ? ` • ${person.contactNumber}` : ''}</p>
                    {person.approvalStatus !== 'APPROVED' && <p className="mt-2 text-xs text-amber-800">Approve this registration first in User Approvals.</p>}
                  </div>
                  {person.approvalStatus === 'APPROVED' && (
                    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                      <Field label="Monthly salary (₹)">
                        <Input type="number" min="0" step="100" className="sm:!w-36" value={drafts[person._id] ?? 0} onChange={(event) => setDrafts((current) => ({ ...current, [person._id]: event.target.value }))} />
                      </Field>
                      <Button variant="outline" size="sm" onClick={() => saveSalary(person)} disabled={busy === `salary:${person._id}`}>
                        {busy === `salary:${person._id}` ? 'Saving…' : 'Save Salary'}
                      </Button>
                      <Button size="sm" icon={WalletCards} onClick={() => createRecord(person)} disabled={busy === `record:${person._id}` || Number(person.monthlySalary || 0) <= 0}>
                        {busy === `record:${person._id}` ? 'Creating…' : `Create ${monthLabel(month)} Record`}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Salary Payment Ledger" subtitle="One monthly record per cleaner. Mark it paid only after payment is made outside the app.">
        {data.records.length === 0 ? (
          <EmptyState icon={WalletCards} title="No salary records yet" message="Set a monthly salary and create a record for the chosen month." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-3 pr-4">Cleaning staff</th><th className="py-3 pr-4">Month</th><th className="py-3 pr-4">Amount</th><th className="py-3 pr-4">Status / Reference</th><th className="py-3">Action</th></tr></thead>
              <tbody>
                {data.records.map((record) => (
                  <tr key={record._id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-4 font-semibold text-slate-800">{record.cleanerName}<div className="font-normal text-slate-400">{record.cleanerStaffId}</div></td>
                    <td className="py-3 pr-4">{monthLabel(record.month)}</td>
                    <td className="py-3 pr-4 font-bold">{rupees(record.amount)}</td>
                    <td className="py-3 pr-4"><Pill className={record.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}>{record.status}</Pill>{record.reference && <div className="mt-1 text-slate-500">{record.paymentMode} · {record.reference}</div>}{record.paidAt && <div className="text-slate-400">Recorded {when(record.paidAt)}</div>}</td>
                    <td className="py-3">{record.status === 'PENDING' ? <Button variant="success" size="sm" onClick={() => { setPaying(record); setPaymentMode('BANK_TRANSFER'); setReference(''); }}>Record as Paid</Button> : <span className="text-slate-400">Complete</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <Modal
        open={Boolean(paying)}
        onClose={() => { setPaying(null); setReference(''); }}
        title="Record Salary Payment"
        subtitle={paying ? `${paying.cleanerName} • ${monthLabel(paying.month)} • ${rupees(paying.amount)}` : ''}
        icon={WalletCards}
        footer={<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setPaying(null)}>Cancel</Button><Button variant="success" onClick={submitPaid} disabled={busy.startsWith('paid:') || !reference.trim()}>Confirm Paid</Button></div>}
      >
        <div className="space-y-4">
          <Field label="How was it paid?">
            <Select value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)}>
              <option value="BANK_TRANSFER">Bank Transfer</option><option value="UPI">UPI</option><option value="CASH">Cash</option>
            </Select>
          </Field>
          <Field label={paymentMode === 'CASH' ? 'Cash voucher / receipt number' : 'Transaction reference'}>
            <Input required value={reference} onChange={(event) => setReference(event.target.value)} placeholder={paymentMode === 'CASH' ? 'e.g. CASH-2026-09-04' : 'e.g. bank UTR / UPI reference'} />
          </Field>
          <p className="text-xs text-amber-800">This confirms a payment made outside the app. HOMI will not move funds.</p>
        </div>
      </Modal>
    </div>
  );
}
