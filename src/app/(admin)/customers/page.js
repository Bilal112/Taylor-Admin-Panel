'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', gender: '', address: '' });

  const fetchCustomers = (q = '') => {
    setLoading(true);
    api.get('/customers', { params: q ? { search: q } : {} })
      .then(r => setCustomers(r.data.data))
      .catch(() => toast.error('Failed to load customers'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleSearch = (e) => { e.preventDefault(); fetchCustomers(search); };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/customers', form);
      setCustomers(c => [data.data, ...c]);
      setShowForm(false);
      setForm({ name: '', phone: '', email: '', gender: '', address: '' });
      toast.success('Customer added!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create customer');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Customers</h1>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm">+ Add Customer</button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-gray-700">New Customer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
              <input required className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select className="input" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">Save Customer</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
        <input className="input flex-1 min-w-[160px] sm:max-w-xs" placeholder="Search name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
        <button type="submit" className="btn-primary text-sm">Search</button>
        {search && <button type="button" onClick={() => { setSearch(''); fetchCustomers(); }} className="btn-secondary text-sm">Clear</button>}
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : customers.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No customers found</div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {customers.map(c => (
              <Link key={c._id} href={`/customers/${c._id}`} className="card block space-y-1">
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-gray-600">{c.phone}</div>
                <div className="text-xs text-gray-400">{c.email || '—'} · {c.gender || '—'}</div>
                <div className="text-xs text-gray-400">{c.branch?.name || '—'}</div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Name', 'Phone', 'Email', 'Gender', 'Branch', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {customers.map(c => (
                    <tr key={c._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3">{c.phone}</td>
                      <td className="px-4 py-3 text-gray-500">{c.email || '—'}</td>
                      <td className="px-4 py-3 capitalize">{c.gender || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{c.branch?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <Link href={`/customers/${c._id}`} className="text-primary hover:underline text-xs font-medium">View / Edit</Link>
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
