'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

const StatCard = ({ label, value, icon, color = 'text-primary' }) => (
  <div className="card flex items-center gap-4">
    <div className="text-3xl">{icon}</div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
    </div>
  </div>
);

const STATUS_COLORS = {
  received: 'bg-blue-100 text-blue-800',
  cutting: 'bg-yellow-100 text-yellow-800',
  stitching: 'bg-purple-100 text-purple-800',
  pressing: 'bg-orange-100 text-orange-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-gray-100 text-gray-800',
  rework: 'bg-red-100 text-red-800',
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/stats')
      .then(r => setStats(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orders" value={stats?.totalOrders} icon="📋" />
        <StatCard label="Active Orders" value={stats?.activeOrders} icon="⚙️" color="text-yellow-600" />
        <StatCard label="Ready to Pickup" value={stats?.readyOrders} icon="✅" color="text-green-600" />
        <StatCard label="Overdue" value={stats?.overdueOrders} icon="⚠️" color="text-red-600" />
        <StatCard label="Total Customers" value={stats?.totalCustomers} icon="👤" />
        <StatCard label="Total Revenue" value={`PKR ${stats?.revenue?.total?.toLocaleString() || 0}`} icon="💰" color="text-green-700" />
        <StatCard label="Amount Collected" value={`PKR ${stats?.revenue?.paid?.toLocaleString() || 0}`} icon="💵" />
        <StatCard label="Outstanding" value={`PKR ${((stats?.revenue?.total || 0) - (stats?.revenue?.paid || 0)).toLocaleString()}`} icon="📌" color="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status breakdown */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-4">Orders by Status</h2>
          <div className="space-y-2">
            {stats?.statusBreakdown?.map(s => (
              <div key={s._id} className="flex items-center justify-between">
                <span className={`badge ${STATUS_COLORS[s._id] || 'bg-gray-100 text-gray-700'}`}>
                  {s._id?.replace(/_/g, ' ')}
                </span>
                <span className="font-semibold text-gray-800">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Last 7 days chart */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-4">Orders — Last 7 Days</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats?.last7Days || []}>
              <XAxis dataKey="_id" tickFormatter={d => format(new Date(d), 'MMM d')} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#1a56db" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
