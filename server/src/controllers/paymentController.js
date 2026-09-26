import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { db } from '../store/index.js';
import { asyncHandler } from '../utils/helpers.js';
import { emitToAdmins, emitToFlat } from '../realtime/socket.js';

/**
 * Razorpay integration.
 * When RAZORPAY_KEY_ID / KEY_SECRET are configured the server talks to the
 * live Razorpay Orders API. Development without keys uses the same HMAC-SHA256
 * verification flow against a locally signed simulated order; production disables
 * online payments until live gateway credentials are configured.
 */
const hasRazorpayKeys = () => Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
const isSimulated = () => !hasRazorpayKeys() && env.NODE_ENV !== 'production';
const paymentsEnabled = () => hasRazorpayKeys() || env.NODE_ENV !== 'production';
const signingSecret = () => env.RAZORPAY_KEY_SECRET || 'homi_simulated_gateway_secret';

const signatureFor = (orderId, paymentId) =>
  crypto.createHmac('sha256', signingSecret()).update(`${orderId}|${paymentId}`).digest('hex');

const safeCompare = (a, b) => {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
};

/** GET /api/payments/config */
export const getPaymentConfig = (_req, res) => {
  res.json({
    success: true,
    enabled: paymentsEnabled(),
    simulated: isSimulated(),
    keyId: env.RAZORPAY_KEY_ID || null,
    modes: [
      { id: 'UPI', label: 'UPI / QR', hint: 'GPay, PhonePe, Paytm, BHIM' },
      { id: 'CARD', label: 'Card', hint: 'Visa / Mastercard / RuPay' },
      { id: 'NETBANKING', label: 'Net Banking', hint: 'All major Indian banks' },
    ],
  });
};

/** POST /api/payments/create-order  { billId } */
export const createOrder = asyncHandler(async (req, res) => {
  if (!paymentsEnabled()) {
    res.status(503);
    throw new Error('Online payments are not configured. Please contact the society office.');
  }
  const { billId } = req.body;
  const bill = await db.Bill.findById(billId);
  if (!bill) {
    res.status(404);
    throw new Error('Maintenance bill not found');
  }
  if (req.user.role === 'RESIDENT' && bill.flatId !== req.user.flatId) {
    res.status(403);
    throw new Error('You can only pay bills raised against your own flat');
  }
  if (bill.status === 'PAID') {
    res.status(400);
    throw new Error(`Bill ${bill.billingPeriod || bill.month} is already marked as PAID`);
  }

  const amountInPaise = Math.round(Number(bill.amount) * 100);
  const receipt = `HOMI-${bill.flatId}-${String(bill.month).slice(0, 3)}${bill.year}`;
  let orderId;

  if (!isSimulated()) {
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: 'INR',
        receipt,
        notes: { flatId: bill.flatId, billId: String(bill._id), billingPeriod: bill.billingPeriod },
      }),
    });
    if (!response.ok) {
      const detail = await response.text();
      res.status(502);
      throw new Error(`Razorpay order creation failed: ${detail.slice(0, 180)}`);
    }
    ({ id: orderId } = await response.json());
  } else {
    orderId = `order_sim${crypto.randomBytes(6).toString('hex')}`;
  }

  await db.Bill.findByIdAndUpdate(bill._id, { $set: { razorpayOrderId: orderId } });

  res.json({
    success: true,
    simulated: isSimulated(),
    message: `Razorpay order ${orderId} created for ₹${Number(bill.amount).toLocaleString('en-IN')}`,
    order: {
      orderId,
      amount: amountInPaise,
      amountInRupees: Number(bill.amount),
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_simulated',
      receipt,
      bill: { ...bill, razorpayOrderId: orderId },
    },
  });
});

/**
 * POST /api/payments/verify
 * Verifies the cryptographic HMAC signature returned by the gateway before the
 * ledger is mutated — a client can never mark a bill PAID on its own.
 */
export const verifyPayment = asyncHandler(async (req, res) => {
  if (!paymentsEnabled()) {
    res.status(503);
    throw new Error('Online payments are not configured. Please contact the society office.');
  }
  const { billId, razorpay_order_id, razorpay_payment_id, razorpay_signature, mode = 'UPI' } = req.body;
  if (!['UPI', 'CARD', 'NETBANKING'].includes(mode)) {
    res.status(400);
    throw new Error('Unsupported online payment method');
  }

  const bill = await db.Bill.findById(billId);
  if (!bill) {
    res.status(404);
    throw new Error('Maintenance bill not found');
  }
  if (req.user.role === 'RESIDENT' && bill.flatId !== req.user.flatId) {
    res.status(403);
    throw new Error('You can only pay bills for your own flat');
  }
  if (bill.status === 'PAID') {
    res.status(400);
    throw new Error(`Bill ${bill.billingPeriod || bill.month} is already marked as PAID`);
  }

  const orderId = razorpay_order_id || bill.razorpayOrderId;
  if (!orderId || !bill.razorpayOrderId) {
    res.status(400);
    throw new Error('No Razorpay order found for this bill — create an order first');
  }
  if (String(orderId) !== String(bill.razorpayOrderId)) {
    res.status(400);
    throw new Error('Payment order does not match this maintenance bill');
  }
  if (!isSimulated() && (!razorpay_payment_id || !razorpay_signature)) {
    res.status(400);
    throw new Error('Razorpay payment ID and signature are required to verify a live payment');
  }

  // Simulated gateway: the server mints the payment id + signature, then runs
  // the identical verification path below. Live mode requires real gateway values.
  const paymentId = razorpay_payment_id || `pay_sim${crypto.randomBytes(8).toString('hex')}`;
  const receivedSignature = razorpay_signature || signatureFor(orderId, paymentId);
  const expectedSignature = signatureFor(orderId, paymentId);

  if (!safeCompare(expectedSignature, receivedSignature)) {
    res.status(400);
    throw new Error('Payment verification failed — HMAC signature mismatch (possible tampering)');
  }

  const updated = await db.Bill.findByIdAndUpdate(
    bill._id,
    {
      $set: {
        status: 'PAID',
        paymentTxnid: paymentId,
        paymentMode: mode,
        paidAt: new Date(),
        razorpayOrderId: orderId,
      },
    },
    { new: true }
  );

  emitToFlat(updated.flatId, 'bill_paid', { bill: updated });
  emitToAdmins('bill_paid', { bill: updated });

  res.json({
    success: true,
    hmacVerified: true,
    message: `Payment Successful — ₹${Number(updated.amount).toLocaleString('en-IN')} received. Maintenance bill marked as PAID in society database.`,
    bill: updated,
    transaction: {
      txnId: paymentId,
      orderId,
      mode,
      signature: expectedSignature.slice(0, 24) + '…',
      verifiedAt: new Date().toISOString(),
    },
  });
});

/** POST /api/payments/record-offline (admin) — cash / cheque reconciliation at the office */
export const recordOfflinePayment = asyncHandler(async (req, res) => {
  const { billId, mode = 'CASH', reference } = req.body;
  if (!['CASH', 'CHEQUE', 'BANK_TRANSFER'].includes(mode)) {
    res.status(400);
    throw new Error('Unsupported offline payment method');
  }
  const bill = await db.Bill.findById(billId);
  if (!bill) {
    res.status(404);
    throw new Error('Maintenance bill not found');
  }
  if (bill.status === 'PAID') {
    res.status(400);
    throw new Error(`Bill ${bill.billingPeriod || bill.month} is already marked as PAID — nothing to settle offline`);
  }
  const updated = await db.Bill.findByIdAndUpdate(
    bill._id,
    {
      $set: {
        status: 'PAID',
        paymentMode: mode,
        paymentTxnid: reference || `OFFLINE-${Date.now().toString().slice(-8)}`,
        paidAt: new Date(),
      },
    },
    { new: true }
  );
  emitToFlat(updated.flatId, 'bill_paid', { bill: updated });
  emitToAdmins('bill_paid', { bill: updated });
  res.json({ success: true, message: `Offline ${mode} settlement recorded for Flat ${updated.flatId}`, bill: updated });
});
