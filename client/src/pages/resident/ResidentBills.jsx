import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, Download, ReceiptText, TrendingUp } from 'lucide-react';
import { Button, EmptyState, Pill, SectionCard, StatCard, TableShell } from '../../components/ui.jsx';
import PaymentModal from './PaymentModal.jsx';
import { maintenanceApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { BILL_PILL, compactInr, dateShort, inr } from '../../lib/format.js';
import { downloadInvoicePdf } from '../../lib/invoicePdf.js';

export default function ResidentBills({ onChanged }) {
  const toast = useToast();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      // Residents can read only their own invoices; the society-wide stats route is admin-only.
      const ledger = await maintenanceApi.bills({});
      setBills(ledger.bills || []);
    } catch (err) {
      toast.alert('Billing Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unpaid = bills.filter((b) => b.status !== 'PAID');
  const paid = bills.filter((b) => b.status === 'PAID');

  // Cards show the six most recent invoices, plus any older unpaid one (e.g. a
  // December carry-forward) so an outstanding bill is always payable from the UI.
  const cardBills = [...bills.slice(0, 6), ...bills.slice(6).filter((b) => b.status !== 'PAID')];
  const totalDue = unpaid.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalPaid = paid.reduce((s, b) => s + Number(b.amount || 0), 0);

  const downloadInvoice = async (bill) => {
    try {
      await downloadInvoicePdf(bill);
      toast.success('Invoice PDF Downloaded', `${bill.month} ${bill.year} invoice saved as a PDF.`);
    } catch (err) {
      toast.alert('Invoice Download Failed', err.message || 'Could not generate the invoice PDF.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Payable" value={compactInr(totalDue)} sub={`${unpaid.length} unpaid invoice(s)`} icon={AlertTriangle} tone="amber" />
        <StatCard label="Paid Till Date" value={compactInr(totalPaid)} sub={`${paid.length} settled invoice(s)`} icon={CheckCircle2} tone="emerald" />
        <StatCard label="Current Month" value={inr(bills[0]?.amount)} sub={bills[0] ? `${bills[0].month} ${bills[0].year}` : '—'} icon={ReceiptText} tone="indigo" />
        <StatCard label="Billing Cycle" value="1st – 10th" sub="Late fee ₹100 after the 10th" icon={TrendingUp} tone="violet" />
      </div>

      {loading && !bills.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-52 rounded-2xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : bills.length === 0 ? (
        <SectionCard>
          <EmptyState icon={ReceiptText} title="No maintenance bills raised yet" message="Invoices appear automatically on the 1st of every month." />
        </SectionCard>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cardBills.map((bill) => {
              const isPaid = bill.status === 'PAID';
              return (
                <div
                  key={bill._id}
                  className={`bg-white border rounded-2xl p-5 space-y-4 transition-all animate-fade-in ${
                    isPaid ? 'border-slate-200' : 'border-indigo-200 shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {bill.month} {bill.year}
                      </div>
                      <div className="text-2xl font-black text-slate-900 font-mono mt-1">{inr(bill.amount)}</div>
                    </div>
                    <Pill className={BILL_PILL[bill.status]}>{bill.status}</Pill>
                  </div>

                  <div className="space-y-1.5 pt-3 border-t border-slate-100 text-[11px] text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Base maintenance</span>
                      <span className="font-semibold">{inr(bill.baseMaintenance)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Parking + water + security</span>
                      <span className="font-semibold">
                        {inr(Number(bill.parkingCharge || 0) + Number(bill.waterCharge || 0) + Number(bill.securityCharge || 0))}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Due date</span>
                      <span className="font-semibold">{dateShort(bill.dueDate)}</span>
                    </div>
                    {isPaid && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Txn reference</span>
                        <span className="font-mono text-[10px] text-slate-600 truncate max-w-[130px]">{bill.paymentTxnid}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {isPaid ? (
                      <Button variant="outline" size="sm" icon={Download} className="w-full" onClick={() => downloadInvoice(bill)}>
                        Download Invoice
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" icon={CreditCard} className="flex-1" onClick={() => setPaying(bill)}>
                          Pay Now
                        </Button>
                        <Button variant="outline" size="sm" icon={Download} onClick={() => downloadInvoice(bill)}>
                          Invoice
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Complete Payment History</h3>
            <TableShell head={['Billing Month', 'Amount', 'Due Date', 'Status', 'Txn Reference', 'Mode']}>
              {bills.map((bill) => (
                <tr key={bill._id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-800">
                    {bill.month} {bill.year}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{inr(bill.amount)}</td>
                  <td className="py-3.5 px-4 text-slate-500">{dateShort(bill.dueDate)}</td>
                  <td className="py-3.5 px-4">
                    <Pill className={BILL_PILL[bill.status]}>{bill.status}</Pill>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">{bill.paymentTxnid || '—'}</td>
                  <td className="py-3.5 px-4 text-[11px] font-semibold text-slate-600">{bill.paymentMode || '—'}</td>
                </tr>
              ))}
            </TableShell>
          </div>
        </>
      )}

      <PaymentModal
        bill={paying}
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        onPaid={() => {
          load();
          onChanged?.();
        }}
      />
    </div>
  );
}
