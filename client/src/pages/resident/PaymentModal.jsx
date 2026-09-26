import { useState } from 'react';
import { BadgeCheck, CreditCard, Landmark, Lock, QrCode, ShieldCheck, Smartphone } from 'lucide-react';
import { Button, DataRow, Field, Modal, Select } from '../../components/ui.jsx';
import { paymentApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { inr } from '../../lib/format.js';
import { PAYMENT_MODES } from '../../lib/constants.js';

const MODE_ICONS = { UPI: Smartphone, CARD: CreditCard, NETBANKING: Landmark };

export default function PaymentModal({ bill, open, onClose, onPaid }) {
  const toast = useToast();
  const [mode, setMode] = useState('UPI');
  const [stage, setStage] = useState('SELECT'); // SELECT → PROCESSING → VERIFYING → DONE
  const [txn, setTxn] = useState(null);
  const [error, setError] = useState('');

  const reset = () => {
    setStage('SELECT');
    setTxn(null);
    setError('');
  };

  const pay = async () => {
    setError('');
    setStage('PROCESSING');
    try {
      const order = await paymentApi.createOrder(bill._id);
      // Simulated Razorpay checkout latency, then the real HMAC verification
      await new Promise((r) => setTimeout(r, 1100));
      setStage('VERIFYING');
      const result = await paymentApi.verify({ billId: bill._id, razorpay_order_id: order.order.orderId, mode });
      setTxn(result.transaction);
      setStage('DONE');
      toast.success('Payment Successful', result.message);
      onPaid?.(result.bill);
    } catch (err) {
      setStage('SELECT');
      setError(err.message);
      toast.alert('Payment Error', err.message);
    }
  };

  const close = () => {
    reset();
    onClose();
  };

  if (!bill) return null;

  return (
    <Modal
      open={open}
      onClose={close}
      title={stage === 'DONE' ? 'Payment Successful!' : 'Razorpay Secure Checkout'}
      subtitle={`${bill.billingPeriod || `${bill.month} ${bill.year}`} • Flat ${bill.flatId}`}
      icon={ShieldCheck}
      maxWidth="max-w-xl"
      footer={
        stage === 'DONE' ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4" /> Maintenance Bill marked as PAID in society database
            </span>
            <Button onClick={close}>Done / Return to Portal</Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> 256-bit encrypted • HMAC-SHA256 verified server-side
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={close} disabled={stage !== 'SELECT'}>
                Cancel
              </Button>
              <Button onClick={pay} disabled={stage !== 'SELECT'} icon={MODE_ICONS[mode]}>
                {stage === 'SELECT' ? `Pay ${inr(bill.amount)}` : 'Processing…'}
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
          <DataRow label="Flat ID" value={bill.flatId} mono />
          <DataRow label="Billing Period" value={`${bill.month} ${bill.year}`} />
          <DataRow label="Base Maintenance" value={inr(bill.baseMaintenance)} />
          <DataRow label="Parking Charge" value={inr(bill.parkingCharge)} />
          <DataRow label="Water Charge" value={inr(bill.waterCharge)} />
          <DataRow label="Security Charge" value={inr(bill.securityCharge)} />
          <div className="pt-2 mt-2 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Total Payable Amount</span>
            <span className="text-lg font-black text-indigo-700 font-mono">{inr(bill.amount)}</span>
          </div>
        </div>

        {stage === 'SELECT' && (
          <>
            <Field label="Select Payment Mode">
              <Select value={mode} onChange={(e) => setMode(e.target.value)}>
                {PAYMENT_MODES.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.hint}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_MODES.map((m) => {
                const Icon = MODE_ICONS[m.id];
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border text-[11px] font-bold transition-all ${
                      active
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>

            {mode === 'UPI' && (
              <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4">
                <div className="w-20 h-20 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                  <QrCode className="w-10 h-10 text-white" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">Simulated test gateway</div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    GPay · PhonePe · Paytm · BHIM. Enter any virtual UPI ID (VPA) in test mode — no real money moves, but
                    the order + HMAC verification path is executed exactly as in production.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {stage !== 'SELECT' && stage !== 'DONE' && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
              <span className="text-xs font-bold text-indigo-900">
                {stage === 'PROCESSING'
                  ? 'Processing Razorpay token & updating maintenance ledger…'
                  : 'Verifying cryptographic HMAC signature…'}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-indigo-200 overflow-hidden">
              <div className={`h-full bg-indigo-600 transition-all duration-700 ${stage === 'PROCESSING' ? 'w-1/2' : 'w-full'}`} />
            </div>
            <p className="text-[11px] text-indigo-800 font-mono">
              crypto.createHmac('sha256', KEY_SECRET).update(`order_id|payment_id`).digest('hex')
            </p>
          </div>
        )}

        {stage === 'DONE' && txn && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
              <BadgeCheck className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <div className="text-sm font-bold text-emerald-900">HMAC SIGNATURE VERIFIED</div>
                <p className="text-[11px] text-emerald-800">
                  {inr(bill.amount)} settled for {bill.month} {bill.year} through {txn.mode}.
                </p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 font-mono text-[11px] text-slate-700">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="truncate">{txn.txnId}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Order ID:</span>
                <span className="truncate">{txn.orderId}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Signature:</span>
                <span className="truncate">{txn.signature}</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
