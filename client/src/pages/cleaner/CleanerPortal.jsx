import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Clock, RefreshCw, Sparkles, WalletCards } from 'lucide-react';
import { Button, EmptyState, Pill, SectionCard, StatCard } from '../../components/ui.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { payrollApi } from '../../lib/api.js';

const rupees = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;
const monthLabel = (value) => /^\d{4}-\d{2}$/.test(String(value || ''))
  ? new Date(`${value}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  : value || '—';
const dateLabel = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function CleanerPortal() {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState({ monthlySalary: 0, records: [] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await payrollApi.mine();
      setData(result);
    } catch (error) {
      toast.alert('Salary Page Error', error.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  const pending = data.records.filter((record) => record.status === 'PENDING');
  const paid = data.records.filter((record) => record.status === 'PAID');
  const paidTotal = paid.reduce((sum, record) => sum + Number(record.amount || 0), 0);

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#f8fafc] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-amber-700"><Sparkles className="w-5 h-5" /><span className="text-xs font-bold uppercase tracking-wider">Cleaning Staff Portal</span></div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Hello, {user?.name}</h1>
            <p className="mt-1 text-sm text-slate-500">Your assigned monthly salary and payment records.</p>
          </div>
          <Button variant="outline" icon={RefreshCw} onClick={load} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Monthly Salary" value={rupees(data.monthlySalary)} sub="set by the society admin" icon={WalletCards} tone="amber" />
          <StatCard label="Pending Records" value={pending.length} sub="salary entries not marked paid" icon={Clock} tone="rose" />
          <StatCard label="Recorded Paid" value={rupees(paidTotal)} sub="history total" icon={BadgeCheck} tone="emerald" />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-600">
          Salary payments are arranged by the society. This page shows the records entered by the admin; HOMI does not collect your bank details or initiate transfers.
        </div>

        <SectionCard title="My Salary History" subtitle="Only your own monthly salary records are shown here.">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Loading your salary records…</div>
          ) : data.records.length === 0 ? (
            <EmptyState icon={WalletCards} title="No salary records yet" message="Your approved monthly salary records will appear here after the society admin creates them." />
          ) : (
            <div className="space-y-3">
              {data.records.map((record) => (
                <div key={record._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">{monthLabel(record.month)}</h2>
                    <p className="mt-1 text-xs text-slate-500">{record.status === 'PAID' ? `Recorded paid ${dateLabel(record.paidAt)} • ${record.paymentMode}` : 'Awaiting salary payment'}</p>
                    {record.status === 'PAID' && record.reference && <p className="mt-1 text-[11px] text-slate-500">Reference: {record.reference}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-900">{rupees(record.amount)}</span>
                    <Pill className={record.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'}>{record.status}</Pill>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}
