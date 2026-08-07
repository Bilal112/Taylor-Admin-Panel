'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_FLOW = ['received', 'cutting', 'stitching', 'pressing', 'quality_check', 'ready', 'delivered'];

const STATUS_COLORS = {
  received: 'bg-blue-100 text-blue-800',
  cutting: 'bg-yellow-100 text-yellow-800',
  stitching: 'bg-purple-100 text-purple-800',
  pressing: 'bg-orange-100 text-orange-800',
  quality_check: 'bg-cyan-100 text-cyan-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-gray-100 text-gray-700',
  rework: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-200 text-gray-500',
};

const ROLE_TRANSITIONS = {
  cutting_master: { received: 'cutting', cutting: 'stitching' },
  stitcher: { stitching: 'pressing' },
  presser: { pressing: 'quality_check' },
  stock_manager: { quality_check: 'ready', ready: 'delivered' },
};

const MEASUREMENT_FIELDS = [
  ['chest', 'Chest'], ['waist', 'Waist'], ['hips', 'Hips'], ['shoulder', 'Shoulder'],
  ['sleeveLength', 'Sleeve'], ['neck', 'Neck'], ['inseam', 'Inseam'],
  ['outseam', 'Outseam'], ['thigh', 'Thigh'], ['height', 'Height'],
];

export default function OrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState({ amount: '', method: 'cash' });
  const [paying, setPaying] = useState(false);
  const [rackNum, setRackNum] = useState('');

  const fetchOrder = () => {
    setLoading(true);
    api.get(`/orders/${id}`)
      .then(r => { setOrder(r.data.data); setRackNum(r.data.data.rackNumber || ''); })
      .catch(err => toast.error(err.response?.data?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrder(); }, [id]);

  const advanceStatus = async (nextStatus) => {
    try {
      await api.put(`/orders/${id}/status`, { status: nextStatus });
      toast.success(`Status → ${nextStatus.replace(/_/g, ' ')}`);
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const addPayment = async (e) => {
    e.preventDefault();
    setPaying(true);
    try {
      await api.put(`/orders/${id}/payment`, { amount: Number(payment.amount), method: payment.method });
      toast.success('Payment recorded');
      setPayment({ amount: '', method: 'cash' });
      fetchOrder();
    } catch { toast.error('Failed'); }
    finally { setPaying(false); }
  };

  const saveRack = async () => {
    try {
      await api.put(`/orders/${id}/rack`, { rackNumber: rackNum });
      toast.success('Rack saved');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const markPickedUp = async () => {
    try {
      await api.put(`/orders/${id}/rack`, { rackNumber: rackNum, isPickedUp: true });
      toast.success('Marked as picked up');
      fetchOrder();
    } catch { toast.error('Failed'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
  if (!order) return <div className="text-center text-gray-400 py-20">Order not found or not assigned to you</div>;

  const role = user?.role;
  const isAdmin = ['super_admin', 'admin'].includes(role);
  const isStaff = !isAdmin;

  // What each role can see
  const canSeeCustomerInfo = isAdmin;               // name, phone — admin only
  const canSeeMeasurements = !['stock_manager'].includes(role); // cutting/stitching/presser + admin need it
  const canSeePricing = isAdmin;
  const canSeeStaffAssignment = isAdmin;
  const canUpdateRack = isAdmin || role === 'stock_manager';
  const canAddPayment = isAdmin;

  const currentIdx = STATUS_FLOW.indexOf(order.status);

  // Status advance button
  const getNextStatus = () => {
    if (isAdmin) return STATUS_FLOW[currentIdx + 1] || null;
    return ROLE_TRANSITIONS[role]?.[order.status] || null;
  };
  const nextStatus = getNextStatus();

  // Measurements — from order snapshot, fallback to customer's saved measurements
  const measurements = order.measurements || order.customer?.measurements;
  const hasMeasurements = measurements && MEASUREMENT_FIELDS.some(([k]) => measurements[k]);

  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{order.orderNumber}</h1>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className={`badge ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
              {order.status?.replace(/_/g, ' ')}
            </span>
            {order.isRush && <span className="badge bg-red-500 text-white">RUSH</span>}
            {order.isPickedUp && <span className="badge bg-green-100 text-green-700">Picked Up ✓</span>}
          </div>
        </div>
        {nextStatus && (
          <button onClick={() => advanceStatus(nextStatus)} className="btn-primary text-sm">
            Mark as {nextStatus.replace(/_/g, ' ')} →
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="card p-4">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_FLOW.map((s, i) => (
            <div key={s} className="flex flex-col items-center gap-1 shrink-0">
              <div className={`h-2 w-10 rounded-full transition-colors ${i <= currentIdx ? 'bg-primary' : 'bg-gray-200'}`} />
              <span className="hidden lg:block text-gray-400 text-center capitalize" style={{ fontSize: '10px' }}>
                {s.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Customer info — admin only ── */}
      {canSeeCustomerInfo && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-700">Customer</h2>
          <div>
            <p className="font-medium">{order.customer?.name}</p>
            <p className="text-sm text-gray-400">{order.customer?.phone}</p>
            {order.customer?.address && <p className="text-sm text-gray-400">{order.customer.address}</p>}
          </div>
        </div>
      )}

      {/* ── Order / Garment details — everyone sees this ── */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-700">Garment Details</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p><span className="text-gray-400">Type:</span> <span className="font-medium">{order.garmentType}</span></p>
          <p><span className="text-gray-400">Fabric:</span> {order.fabric || '—'}</p>
          <p><span className="text-gray-400">Source:</span> {order.fabricSource?.replace(/_/g, ' ') || '—'}</p>
          <p>
            <span className="text-gray-400">Promised:</span>{' '}
            <span className={
              order.promisedDate && new Date(order.promisedDate) < new Date() && order.status !== 'delivered'
                ? 'text-red-600 font-semibold' : 'font-medium'
            }>
              {order.promisedDate ? format(new Date(order.promisedDate), 'dd MMM yyyy') : '—'}
            </span>
          </p>
        </div>
        {order.styleNotes && (
          <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-sm text-gray-700 italic">
            📝 {order.styleNotes}
          </div>
        )}
      </div>

      {/* ── Measurements — shown to cutting master, stitcher, presser, admin ── */}
      {canSeeMeasurements && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-700">📏 Customer Measurements (inches)</h2>
          {hasMeasurements ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {MEASUREMENT_FIELDS.map(([k, label]) => measurements[k] ? (
                <div key={k} className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-bold text-gray-800">{measurements[k]}"</p>
                </div>
              ) : null)}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No measurements recorded for this customer.</p>
          )}
          {measurements?.notes && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded p-2">📝 {measurements.notes}</p>
          )}
        </div>
      )}

      {/* ── Billing — admin only ── */}
      {canSeePricing && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-700">Billing</h2>
          <div className="text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-400">Base Price</span><span>PKR {order.basePrice?.toLocaleString()}</span></div>
            {order.rushSurcharge > 0 && <div className="flex justify-between"><span className="text-gray-400">Rush Surcharge</span><span className="text-red-500">+PKR {order.rushSurcharge?.toLocaleString()}</span></div>}
            {order.discountAmount > 0 && <div className="flex justify-between"><span className="text-gray-400">Discount</span><span className="text-green-600">-PKR {order.discountAmount?.toLocaleString()}</span></div>}
            <div className="flex justify-between font-bold border-t border-gray-100 pt-1"><span>Total</span><span>PKR {order.totalPrice?.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Paid</span><span className="text-green-600">PKR {order.amountPaid?.toLocaleString()}</span></div>
            <div className="flex justify-between font-bold">
              <span>Balance Due</span>
              <span className={order.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}>PKR {order.balanceDue?.toLocaleString()}</span>
            </div>
          </div>
          {order.payments?.length > 0 && (
            <div className="text-xs space-y-1 bg-gray-50 rounded p-2">
              {order.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-gray-500">
                  <span>{p.method?.replace(/_/g, ' ')}</span>
                  <span>PKR {p.amount?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          {canAddPayment && order.balanceDue > 0 && (
            <form onSubmit={addPayment} className="flex gap-2">
              <input type="number" required className="input flex-1 text-sm" placeholder="Amount" value={payment.amount} onChange={e => setPayment({ ...payment, amount: e.target.value })} />
              <select className="input w-32 text-sm" value={payment.method} onChange={e => setPayment({ ...payment, method: e.target.value })}>
                {['cash', 'card', 'bank_transfer', 'mobile_money'].map(m => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
              </select>
              <button type="submit" disabled={paying} className="btn-primary text-sm px-3">Pay</button>
            </form>
          )}
        </div>
      )}

      {/* ── Staff Assignment — admin only ── */}
      {canSeeStaffAssignment && (
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-3">Staff Assignment</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              ['✂️ Cutting Master', order.cuttingMaster],
              ['🧵 Stitcher', order.stitcher],
              ['🔥 Presser', order.presser],
              ['📦 Stock Manager', order.stockManager],
            ].map(([r, s]) => (
              <div key={r} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-400 mb-1">{r}</p>
                <p className="font-medium">{s?.name || <span className="text-gray-300 text-xs">Unassigned</span>}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Rack — stock_manager + admin only ── */}
      {canUpdateRack && (
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-3">📦 Rack / Pickup</h2>
          <div className="flex gap-3 items-center flex-wrap">
            <input className="input w-40" placeholder="Rack number e.g. A-12" value={rackNum} onChange={e => setRackNum(e.target.value)} />
            <button onClick={saveRack} className="btn-primary text-sm">Save Rack</button>
            {!order.isPickedUp && order.status === 'ready' && (
              <button onClick={markPickedUp} className="btn-secondary text-sm">Mark as Picked Up ✓</button>
            )}
            {order.isPickedUp && <span className="badge bg-green-100 text-green-700">Picked Up ✓</span>}
          </div>
          {order.rackNumber && (
            <p className="mt-2 text-sm text-gray-500">Current rack: <span className="font-bold text-gray-800">{order.rackNumber}</span></p>
          )}
        </div>
      )}

      {/* ── Status History — everyone sees ── */}
      <div className="card">
        <h2 className="font-semibold text-gray-700 mb-3">Status History</h2>
        <div className="space-y-2">
          {order.statusHistory?.map((h, i) => (
            <div key={i} className="flex gap-3 text-sm items-start">
              <span className="text-gray-400 text-xs w-32 shrink-0 mt-0.5">
                {h.changedAt ? format(new Date(h.changedAt), 'dd MMM HH:mm') : ''}
              </span>
              <span className="font-medium capitalize">{h.status?.replace(/_/g, ' ')}</span>
              {/* Only show who changed it to admin */}
              {isAdmin && <span className="text-gray-400 text-xs">{h.changedBy?.name || ''}</span>}
              {h.note && <span className="text-gray-400 italic text-xs">{h.note}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
