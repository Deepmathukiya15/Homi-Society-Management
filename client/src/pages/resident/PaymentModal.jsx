import { useEffect, useState } from 'react';
import { BadgeCheck, CreditCard, Landmark, Lock, QrCode, ShieldCheck, Smartphone } from 'lucide-react';
import { Button, DataRow, Modal } from '../../components/ui.jsx';
import { paymentApi } from '../../lib/api.js';
import { useToast } from '../../context/ToastContext.jsx';
import { inr } from '../../lib/format.js';
import { PAYMENT_MODES } from '../../lib/constants.js';

const MODE_ICONS = { UPI: Smartphone, CARD: CreditCard, NETBANKING: Landmark };

const loadRazorpayCheckout = () => new Promise((resolve, reject) => {
  if (window.Razorpay) return resolve();
  const existing = document.querySelector('script[data-razorpay-checkout]');
  if (existing) {
    existing.addEventListener('load', () => window.Razorpay ? resolve() : reject(new Error('Razorpay checkout could not be loaded')),
      { once: true });
    existing.addEventListener('error', () => reject(new Error('Could not load the secure payment checkout')),
      { once: true });
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.async = true;
  script.dataset.razorpayCheckout = 'true';
  script.onload = () => window.Razorpay ? resolve() : reject(new Error('Razorpay checkout could not be loaded'));
  script.onerror = () => reject(new Error('Could not load the secure payment checkout'));
  document.body.appendChild(script);
});

export default function PaymentModal({ bill, open, onClose, onPaid }) {
  const toast = useToast();
  const [mode, setMode] = useState('UPI');
  const [stage, setStage] = useState('SELECT'); // SELECT → PROCESSING → VERIFYING → DONE
  const [txn, setTxn] = useState(null);
  const [error, setError] = useState('');
  const [paymentEnabled, setPaymentEnabled] = useState(true);
  const [simulatedGateway, setSimulatedGateway] = useState(true);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    paymentApi.config().then((config) => {
      if (active) {
        setPaymentEnabled(Boolean(config.enabled));
        setSimulatedGateway(Boolean(config.simulated));
      }
    }).catch(() => {
      if (active) setPaymentEnabled(false);
    });
    return () => { active = false; };
  }, [open]);

  const reset = () => {
    setStage('SELECT');
    setTxn(null);
    setError('');
  };

  const verifyAndComplete = async (paymentDetails) => {
    setError('');
    setStage('VERIFYING');
    try {
      const result = await paymentApi.verify({ billId: bill._id, ...paymentDetails, mode });
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

  const pay = async () => {
    setError('');
    setStage('PROCESSING');
    try {
      const config = await paymentApi.config();
      setPaymentEnabled(Boolean(config.enabled));
      setSimulatedGateway(Boolean(config.simulated));
      if (!config.enabled) throw new Error('Online payments are not configured. Please contact the society office.');
      const order = await paymentApi.createOrder(bill._id);

      if (config.simulated) {
        // Local/demo mode runs through the same order and HMAC verification path
        // but does not move real money.
        await new Promise((resolve) => setTimeout(resolve, 800));
        await verifyAndComplete({ razorpay_order_id: order.order.orderId });
        return;
      }

      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: order.order.keyId,
        amount: order.order.amount,
        currency: order.order.currency,
        name: 'HOMI Society',
        description: `${bill.billingPeriod || `${bill.month} ${bill.year}`} maintenance payment`,
        order_id: order.order.orderId,
        method: {
          upi: mode === 'UPI',
          card: mode === 'CARD',
          netbanking: mode === 'NETBANKING',
        },
        theme: { color: '#4f46e5' },
        handler: (response) => {
          verifyAndComplete({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
        },
        modal: { ondismiss: () => setStage('SELECT') },
      });
      checkout.on('payment.failed', (response) => {
        const message = response.error?.description || 'Payment failed. Please try again.';
        setStage('SELECT');
        setError(message);
        toast.alert('Payment Failed', message);
      });
      checkout.open();
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 shrink-0" /> Maintenance Bill marked as PAID in society database
            </span>
            <Button className="w-full sm:w-auto" onClick={close}>Done / Return to Portal</Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" /> Payment verification is handled securely by the server.
            </span>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close} disabled={stage !== 'SELECT'}>
                Cancel
              </Button>
              <Button onClick={pay} disabled={stage !== 'SELECT' || !paymentEnabled} icon={MODE_ICONS[mode]}>
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

        {stage === 'SELECT' && !paymentEnabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            Online payments are temporarily unavailable. Please contact the society office for assistance.
          </div>
        )}

        {stage === 'SELECT' && (
          <>
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Choose Payment Method</p>
              <div role="group" aria-label="Choose payment method" className="grid grid-cols-3 gap-2">
                {PAYMENT_MODES.map((m) => {
                const Icon = MODE_ICONS[m.id];
                const active = mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={active}
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
            </div>

            {mode === 'UPI' && (
              <div className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl p-4">
                <div className="w-20 h-20 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                  <QrCode className="w-10 h-10 text-white" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    {simulatedGateway ? 'Demo payment mode' : 'Secure Razorpay checkout'}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {simulatedGateway
                      ? 'No real money moves in demo mode. The order and server verification flow will still be demonstrated.'
                      : 'You will complete your payment in the secure Razorpay checkout window.'}
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
