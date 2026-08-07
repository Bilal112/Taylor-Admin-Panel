'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function BranchesPage() {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', city: '', phone: '', email: '' });

  useEffect(() => {
    api.get('/branches').then(r => setBranches(r.data.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post('/branches', form);
      setBranches(b => [data.data, ...b]);
      setShowForm(false);
      setForm({ name: '', address: '', city: '', phone: '', email: '' });
      toast.success('Branch created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm">+ Add Branch</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-gray-700">New Branch</h2>
          <div className="grid grid-cols-2 gap-4">
            {[['name', 'Branch Name', true], ['address', 'Address', true], ['city', 'City', false], ['phone', 'Phone', false], ['email', 'Email', false]].map(([k, l, req]) => (
              <div key={k} className={k === 'address' ? 'col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l} {req && '*'}</label>
                <input required={req} className="input" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">Create Branch</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 text-center py-12 text-gray-400">Loading…</div>
        ) : branches.length === 0 ? (
          <div className="col-span-3 text-center py-12 text-gray-400">No branches yet</div>
        ) : branches.map(b => (
          <div key={b._id} className={`card ${!b.isActive ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900">🏪 {b.name}</h3>
              <span className={`badge ${b.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {b.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="text-sm text-gray-500 space-y-1">
              <p>📍 {b.address}{b.city ? `, ${b.city}` : ''}</p>
              {b.phone && <p>📞 {b.phone}</p>}
              {b.email && <p>✉️ {b.email}</p>}
              {b.admin && <p>👤 Admin: {b.admin.name}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
