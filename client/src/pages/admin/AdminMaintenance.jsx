import { useCallback, useEffect, useState } from 'react';
import { Banknote, CircleDollarSign, Clock4, Download, FileWarning, ReceiptText, Search, Wallet } from 'lucide-react';
import {
  Button,
  EmptyState,
  Input,
  Pill,
  SectionCard,
  SectionHeader,
  Select,
  StatCard,
  TableShell,
} from '../../components/ui.jsx';
import { maintenanceApi, paymentApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { BILL_PILL, compactInr, dateShort, inr } from '../../lib/format.js';
import { useSocket } from '../../context/SocketContext.jsx';
import { downloadInvoicePdf } from '../../lib/invoicePdf.js';

export default function AdminMaintenance({ onRunCron, cronRunning }) {
  const toast = useToast();
  const { on } = useSocket();
  const [bills, setBills] = useState([]);
  const [stats, setStats] = useState(null);
  const [defaulters, setDefaulters] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [month, setMonth] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ledger, s, d] = await Promise.all([
        maintenanceApi.bills({ status, search }),
        maintenanceApi.stats(),
        maintenanceApi.defaulters(),
      ]);
      setBills(month === 'ALL' ? ledger.bills : ledger.bills.filter((b) => b.month === month));
      setStats(s.stats);
      setDefaulters(d.defaulters);
    } catch (err) {
      toast.alert('Ledger Error', err.message);
    } finally {
      setLoading(false);
    }
  }, [status, search, month, toast]);

  useEffect(() => {
    const timer = setTimeout(load, 180);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    const off = on('bill_paid', () => load());
    return () => off();
  }, [on, load]);

  const downloadInvoice = async (bill) => {
    try {
      await downloadInvoicePdf(bill);
      toast.success('Invoice PDF Downloaded', `${bill.month} ${bill.year} • Flat ${bill.flatId}`);
    } catch (err) {
      toast.alert('Invoice Download Failed', err.message || 'Could not generate the invoice PDF.');
    }
  };

  const recordOffline = async (bill) => {
    try {
      const res = await paymentApi.recordOffline({ billId: bill._id, mode: 'CASH' });
      toast.success('Offline Settlement', res.message);
      load();
    } catch (err) {
      toast.alert('Settlement Failed', err.message);
    }
  };

  const exportCsv = () => {
    const header = ['Flat ID', 'Resident', 'Month', 'Year', 'Amount', 'Status', 'Due Date', 'Txn Reference', 'Mode'];
    const rows = bills.map((b) => [
      b.flatId,
      b.residentName,
      b.month,
      b.year,
      b.amount,
      b.status,
      dateShort(b.dueDate),
      b.paymentTxnid || '',
      b.paymentMode || '',
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `homi-maintenance-ledger-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Ledger Exported', `${bills.length} invoice rows downloaded as CSV.`);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Invoiced" value={compactInr(stats?.totalInvoiced)} sub={`${stats?.totalBills ?? 0} invoices raised`} icon={ReceiptText} tone="indigo" />
        <StatCard label="Collected (INR)" value={compactInr(stats?.totalCollected)} sub={`${stats?.collectionRate ?? 0}% collection rate`} icon={CircleDollarSign} tone="emerald" />
        <StatCard label="Pending Dues" value={compactInr(stats?.pendingDues)} sub={`${stats?.pendingCount ?? 0} invoices awaiting payment`} icon={Clock4} tone="amber" />
        <StatCard label="Overdue Dues" value={compactInr(stats?.overdueDues)} sub={`${stats?.overdueCount ?? 0} invoices past due date`} icon={FileWarning} tone="rose" />
      </div>

      <SectionCard className="p-4 flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Status:</span>
          {['ALL', 'PAID', 'PENDING', 'OVERDUE'].map((item) => (
            <button
              key={item}
              onClick={() => setStatus(item)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                status === item ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item}
            </button>
          ))}
          <span className="text-xs font-semibold text-slate-500 ml-2">Month:</span>
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="!w-40 !py-1.5 !text-xs">
            <option value="ALL">All months</option>
            {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <Input
              className="!pl-10"
              placeholder="Search flat, resident or month…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" icon={Download} onClick={exportCsv}>
            Export CSV
          </Button>
          <Button variant="dark" icon={Wallet} onClick={onRunCron} disabled={cronRunning}>
            {cronRunning ? 'Running Cron…' : 'Invoice Batch'}
          </Button>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <div className="xl:col-span-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Maintenance Bills</h3>
            <span className="text-xs text-slate-500 font-medium">
              Total Bills: <strong className="text-slate-900">{bills.length}</strong>
            </span>
          </div>

          {loading && !bills.length ? (
            <div className="h-72 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ) : bills.length === 0 ? (
            <SectionCard>
              <EmptyState icon={ReceiptText} title="No invoices match these filters" message="Adjust the status, month or search query." />
            </SectionCard>
          ) : (
            <TableShell head={['Flat ID', 'Resident', 'Billing Month', 'Amount', 'Due Date', 'Status', 'Txn Reference', 'Action']}>
              {bills.slice(0, 60).map((bill) => (
                <tr key={bill._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">{bill.flatId}</td>
                  <td className="py-3.5 px-4">{bill.residentName}</td>
                  <td className="py-3.5 px-4">
                    {bill.month} {bill.year}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{inr(bill.amount)}</td>
                  <td className="py-3.5 px-4 text-slate-500">{dateShort(bill.dueDate)}</td>
                  <td className="py-3.5 px-4">
                    <Pill className={BILL_PILL[bill.status]}>{bill.status}</Pill>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{bill.paymentTxnid || '—'}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3 min-w-max">
                      <button
                        type="button"
                        onClick={() => downloadInvoice(bill)}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wide"
                        title="Download this maintenance invoice as a PDF"
                      >
                        <Download className="w-3.5 h-3.5" /> PDF
                      </button>
                      {bill.status === 'PAID' ? (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {bill.paymentMode || 'PAID'}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => recordOffline(bill)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase tracking-wide"
                          title="Record a cash / cheque settlement collected at the society office"
                        >
                          Record Offline
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </TableShell>
          )}
        </div>

        <div className="space-y-5">
          <SectionCard className="p-5">
            <SectionHeader title="Outstanding by Flat" subtitle="Reconciliation queue" />
            <div className="mt-4 space-y-2.5">
              {defaulters.slice(0, 7).map((d) => (
                <div key={d.flatId} className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-bold font-mono text-slate-900">{d.flatId}</span>
                    <span className="text-xs font-black text-rose-600 font-mono">{inr(d.due)}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                    {d.residentName} • {d.months.join(', ')}
                  </div>
                </div>
              ))}
              {!defaulters.length && <p className="text-xs text-slate-500">No pending dues across the society.</p>}
            </div>
          </SectionCard>

          <SectionCard className="p-5">
            <SectionHeader title="Charge Composition" subtitle="Per flat, per month" />
            <div className="mt-3.5 space-y-2 text-xs">
              {[
                ['Base maintenance', '₹2,300 – ₹2,900 (area based)'],
                ['Parking bay', '₹400 if allocated'],
                ['Water charges', '₹150 flat'],
                ['Security & staff', '₹250 flat'],
                ['Due date', '10th of billing month'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-800 text-right">{value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              Auto-generated by node-cron on the 1st at 00:00 IST.
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
