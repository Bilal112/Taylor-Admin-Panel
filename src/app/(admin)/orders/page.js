'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

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

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  const isAdmin = ['super_admin', 'admin'].includes(user?.role);
  const canSeeCustomer = isAdmin;
  const canSeeBalance = isAdmin;

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/orders', { params });
      setOrders(data.data);
      setPagination(data.pagination);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [page, statusFilter]);

  const handleSearch = (e) => { e.preventDefault(); fetchOrders(); };

  // Build columns dynamically based on role
  const columns = [
    { key: 'order', label: 'Order #', show: true },
    { key: 'customer', label: 'Customer', show: canSeeCustomer },
    { key: 'garment', label: 'Garment', show: true },
    { key: 'status', label: 'Status', show: true },
    { key: 'promised', label: 'Promised', show: true },
    { key: 'balance', label: 'Balance Due', show: canSeeBalance },
    { key: 'actions', label: '', show: true },
  ].filter(c => c.show);

  const colSpan = columns.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        {isAdmin && (
          <Link href="/orders/new" className="btn-primary text-sm">+ New Order</Link>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4 flex gap-3 flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <input className="input flex-1 max-w-xs" placeholder="Search order number…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <button type="submit" className="btn-primary text-sm">Search</button>
        </form>
        <select className="input w-48" value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s =>
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          )}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {columns.map(col => (
                <th key={col.key} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={colSpan} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={colSpan} className="text-center py-12 text-gray-400">No orders found</td></tr>
            ) : orders.map(order => (
              <tr key={order._id} className="hover:bg-gray-50 transition-colors">

                {/* Order # — always shown */}
                <td className="px-4 py-3 font-mono font-medium text-primary">
                  {order.orderNumber}
                  {order.isRush && <span className="badge bg-red-500 text-white ml-2 text-xs">RUSH</span>}
                </td>

                {/* Customer — admin only */}
                {canSeeCustomer && (
                  <td className="px-4 py-3">
                    <div className="font-medium">{order.customer?.name}</div>
                    <div className="text-xs text-gray-400">{order.customer?.phone}</div>
                  </td>
                )}

                {/* Garment — always shown */}
                <td className="px-4 py-3 text-gray-700">{order.garmentType}</td>

                {/* Status — always shown */}
                <td className="px-4 py-3">
                  <span className={`badge ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                    {order.status?.replace(/_/g, ' ')}
                  </span>
                </td>

                {/* Promised date — always shown */}
                <td className="px-4 py-3">
                  <span className={
                    order.promisedDate &&
                    new Date(order.promisedDate) < new Date() &&
                    order.status !== 'delivered'
                      ? 'text-red-600 font-medium' : 'text-gray-700'
                  }>
                    {order.promisedDate ? format(new Date(order.promisedDate), 'dd MMM yyyy') : '—'}
                  </span>
                </td>

                {/* Balance — admin only */}
                {canSeeBalance && (
                  <td className="px-4 py-3 font-medium">
                    <span className={order.balanceDue > 0 ? 'text-red-600' : 'text-green-600'}>
                      PKR {order.balanceDue?.toLocaleString()}
                    </span>
                  </td>
                )}

                {/* Actions */}
                <td className="px-4 py-3">
                  <Link href={`/orders/${order._id}`}
                    className="text-primary hover:underline text-xs font-medium">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pagination.pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-sm text-gray-500">
              Page {pagination.page} of {pagination.pages} ({pagination.total} total)
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">Prev</button>
              <button disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)}
                className="btn-secondary text-xs px-3 py-1 disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
