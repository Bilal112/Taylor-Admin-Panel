'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-600',
  received: 'bg-blue-100 text-blue-800',
  cutting: 'bg-yellow-100 text-yellow-800',
  cutting_review: 'bg-amber-100 text-amber-800',
  stitching: 'bg-purple-100 text-purple-800',
  stitching_review: 'bg-amber-100 text-amber-800',
  pressing: 'bg-orange-100 text-orange-800',
  pressing_review: 'bg-amber-100 text-amber-800',
  quality_check: 'bg-cyan-100 text-cyan-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-gray-100 text-gray-700',
  rework: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-200 text-gray-500',
};

const STATUS_LABELS = {
  cutting_review: 'Awaiting Checker (Cutting)',
  stitching_review: 'Awaiting Checker (Stitching)',
  pressing_review: 'Awaiting Checker (Pressing)',
};

// Default to tomorrow (browser-local day), same convention as the backend default.
const tomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD
};

export default function UpcomingDeliveryPage() {
  const { user } = useAuth();
  const isAdmin = ['super_admin', 'admin'].includes(user?.role);
  const [date, setDate] = useState(tomorrowStr());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = (d) => {
    setLoading(true);
    api.get('/orders/upcoming-delivery', { params: { date: d } })
      .then(r => setOrders(r.data.data))
      .catch(() => toast.error('Failed to load upcoming deliveries'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOrders(date); }, [date]);

  const itemsSummary = (order) =>
    (order.items?.length ? order.items : order.garmentType ? [order] : [])
      .map(it => `${it.garmentType}${it.quantity > 1 ? ` ×${it.quantity}` : ''}`)
      .join(', ');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">🚚 Upcoming Delivery</h1>
        <button onClick={() => fetchOrders(date)} className="btn-secondary text-sm">🔄 Refresh</button>
      </div>

      {/* Date picker — defaults to tomorrow, admin/checker can change it */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-gray-700">Promised Date</label>
        <input type="date" className="input w-auto" value={date} onChange={e => setDate(e.target.value)} />
        <button
          type="button"
          onClick={() => setDate(tomorrowStr())}
          className="text-xs text-primary hover:underline"
        >
          Reset to tomorrow
        </button>
        <span className="text-sm text-gray-400 ml-auto">
          {orders.length} order{orders.length !== 1 ? 's' : ''} promised {date === tomorrowStr() ? 'tomorrow' : format(new Date(`${date}T00:00:00`), 'dd MMM yyyy')}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No orders promised for this date</div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {orders.map(order => (
              <Link key={order._id} href={`/orders/${order._id}`} className="card block space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-medium text-primary text-sm">{order.orderNumber}</span>
                  <span className={`badge ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                    {STATUS_LABELS[order.status] || order.status?.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-sm text-gray-700">{itemsSummary(order)}</div>
                {isAdmin && order.customer?.name && (
                  <div className="text-xs text-gray-400">{order.customer.name} · {order.customer.phone}</div>
                )}
                {order.suitNo && <div className="text-xs text-gray-400">Suit No: {order.suitNo}</div>}
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order #</th>
                    {isAdmin && <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>}
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Suit No</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map(order => (
                    <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-medium text-primary">{order.orderNumber}</td>
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="font-medium">{order.customer?.name}</div>
                          <div className="text-xs text-gray-400">{order.customer?.phone}</div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-700">{itemsSummary(order)}</td>
                      <td className="px-4 py-3 text-gray-500">{order.suitNo || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                          {STATUS_LABELS[order.status] || order.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/orders/${order._id}`} className="text-primary hover:underline text-xs font-medium">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
