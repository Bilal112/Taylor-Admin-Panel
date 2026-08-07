'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const MEASUREMENT_FIELDS = [
  ['chest', 'Chest'], ['waist', 'Waist'], ['hips', 'Hips'], ['shoulder', 'Shoulder'],
  ['sleeveLength', 'Sleeve'], ['neck', 'Neck'], ['inseam', 'Inseam'],
  ['outseam', 'Outseam'], ['thigh', 'Thigh'], ['height', 'Height'],
];

export default function NewOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Phone lookup state
  const [phone, setPhone] = useState('');
  const [looking, setLooking] = useState(false);
  const [customer, setCustomer] = useState(null);        // found customer
  const [customerStatus, setCustomerStatus] = useState(''); // 'found' | 'new' | ''
  const [newCustomerName, setNewCustomerName] = useState('');
  const [measurements, setMeasurements] = useState({});
  const [showHistory, setShowHistory] = useState(false);

  const [form, setForm] = useState({
    garmentType: '', fabric: '', fabricSource: 'customer_provided',
    styleNotes: '', promisedDate: '', basePrice: '', isRush: false,
    rushSurcharge: '0', notes: '', advancePayment: '', paymentMethod: 'cash',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setM = (k, v) => setMeasurements(m => ({ ...m, [k]: v }));

  // ----- Phone lookup -----
  const lookupPhone = async () => {
    if (!phone.trim()) return;
    setLooking(true);
    setCustomer(null);
    setCustomerStatus('');
    try {
      const { data } = await api.get('/customers/lookup', { params: { phone: phone.trim() } });
      if (data.found) {
        setCustomer(data.data);
        setMeasurements(data.data.measurements || {});
        setCustomerStatus('found');
        toast.success(`Customer found: ${data.data.name}`);
      } else {
        setCustomerStatus('new');
        setMeasurements({});
        toast('New customer — fill in name & measurements', { icon: '👤' });
      }
    } catch {
      toast.error('Lookup failed');
    } finally {
      setLooking(false);
    }
  };

  // ----- Submit -----
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerStatus) { toast.error('Look up a phone number first'); return; }
    setLoading(true);
    try {
      let customerId = customer?._id;

      // Create new customer if needed
      if (customerStatus === 'new') {
        if (!newCustomerName.trim()) { toast.error('Enter customer name'); setLoading(false); return; }
        const { data } = await api.post('/customers', { name: newCustomerName.trim(), phone: phone.trim() });
        customerId = data.data._id;
        setCustomer(data.data);
      }

      // Save measurements if any field filled
      const hasMeasurement = Object.values(measurements).some(v => v !== '' && v !== undefined && v !== null);
      if (hasMeasurement && customerId) {
        await api.put(`/customers/${customerId}/measurements`, measurements);
      }

      // Create order
      const payload = {
        customer: customerId,
        garmentType: form.garmentType,
        fabric: form.fabric,
        fabricSource: form.fabricSource,
        styleNotes: form.styleNotes,
        promisedDate: form.promisedDate,
        basePrice: Number(form.basePrice),
        isRush: form.isRush,
        rushSurcharge: Number(form.rushSurcharge),
        notes: form.notes,
        measurements: hasMeasurement ? measurements : undefined,
        payments: form.advancePayment ? [{ amount: Number(form.advancePayment), method: form.paymentMethod }] : [],
      };

      const { data: orderData } = await api.post('/orders', payload);
      toast.success(`Order ${orderData.data.orderNumber} created!`);
      router.push(`/orders/${orderData.data._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">New Order</h1>

      {/* ── Step 1: Phone lookup ── */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">Step 1 — Customer</h2>
        <div className="flex gap-2">
          <input
            className="input flex-1" placeholder="Enter customer phone number…"
            value={phone} onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), lookupPhone())}
          />
          <button type="button" onClick={lookupPhone} disabled={looking || !phone}
            className="btn-primary text-sm px-4">
            {looking ? 'Looking…' : 'Lookup'}
          </button>
        </div>

        {/* Found customer */}
        {customerStatus === 'found' && customer && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-800">✅ {customer.name}</p>
                <p className="text-sm text-green-600">{customer.phone}</p>
              </div>
              <button onClick={() => setCustomerStatus('')} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
            </div>

            {/* Current measurements */}
            {customer.measurements && Object.keys(customer.measurements).length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-green-700 mb-2">📏 Saved Measurements (inches) — update if changed:</p>
                <div className="grid grid-cols-5 gap-2">
                  {MEASUREMENT_FIELDS.map(([k, l]) => (
                    <div key={k}>
                      <label className="block text-xs text-gray-500 mb-1">{l}</label>
                      <input type="number" step="0.5" className="input text-xs text-center py-1"
                        value={measurements[k] || ''}
                        onChange={e => setM(k, Number(e.target.value))} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Measurement history */}
            {customer.measurementHistory?.length > 0 && (
              <div>
                <button onClick={() => setShowHistory(v => !v)} className="text-xs text-primary hover:underline">
                  {showHistory ? 'Hide' : 'Show'} measurement history ({customer.measurementHistory.length} records)
                </button>
                {showHistory && (
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {customer.measurementHistory.map((h, i) => (
                      <div key={i} className="bg-white border border-gray-100 rounded p-2 text-xs text-gray-600">
                        <p className="font-medium text-gray-700 mb-1">
                          {h.takenAt ? new Date(h.takenAt).toLocaleDateString() : 'Unknown date'}
                          {h.takenBy?.name && ` — by ${h.takenBy.name}`}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {MEASUREMENT_FIELDS.map(([k, l]) => h[k] ? <span key={k}>{l}: <b>{h[k]}"</b></span> : null)}
                        </div>
                        {h.notes && <p className="mt-1 italic">{h.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* New customer */}
        {customerStatus === 'new' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-blue-800">👤 New customer — will be created</p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Customer Name *</label>
              <input className="input" value={newCustomerName} onChange={e => setNewCustomerName(e.target.value)} placeholder="Full name" />
            </div>
            <p className="text-xs font-medium text-gray-600 mb-1">Measurements (inches) — optional but recommended:</p>
            <div className="grid grid-cols-5 gap-2">
              {MEASUREMENT_FIELDS.map(([k, l]) => (
                <div key={k}>
                  <label className="block text-xs text-gray-500 mb-1">{l}</label>
                  <input type="number" step="0.5" className="input text-xs text-center py-1"
                    value={measurements[k] || ''}
                    onChange={e => setM(k, Number(e.target.value))} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Step 2: Order details ── */}
      {customerStatus && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-semibold text-gray-700">Step 2 — Order Details</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Garment Type *</label>
              <input required className="input" value={form.garmentType} onChange={e => set('garmentType', e.target.value)} placeholder="Shirt, Suit, Shalwar Kameez…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fabric</label>
              <input className="input" value={form.fabric} onChange={e => set('fabric', e.target.value)} placeholder="Cotton, Silk…" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fabric Source</label>
              <select className="input" value={form.fabricSource} onChange={e => set('fabricSource', e.target.value)}>
                <option value="customer_provided">Customer Provided</option>
                <option value="shop_supplied">Shop Supplied</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promised Date *</label>
              <input required type="date" className="input" value={form.promisedDate} onChange={e => set('promisedDate', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Style Notes</label>
            <textarea className="input" rows={2} value={form.styleNotes} onChange={e => set('styleNotes', e.target.value)} placeholder="Design instructions…" />
          </div>

          <hr className="border-gray-100" />
          <h3 className="font-semibold text-gray-700">Billing</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (PKR) *</label>
              <input required type="number" className="input" value={form.basePrice} onChange={e => set('basePrice', e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Advance Payment (PKR)</label>
              <input type="number" className="input" value={form.advancePayment} onChange={e => set('advancePayment', e.target.value)} placeholder="0" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isRush} onChange={e => set('isRush', e.target.checked)} className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-gray-700">Rush Order</span>
            </label>
            {form.isRush && (
              <input type="number" className="input flex-1" value={form.rushSurcharge} onChange={e => set('rushSurcharge', e.target.value)} placeholder="Rush surcharge (PKR)" />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Creating…' : 'Create Order'}</button>
            <button type="button" onClick={() => router.back()} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
