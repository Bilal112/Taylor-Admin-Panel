'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

const ROLES = ['admin', 'cutting_master', 'stitcher', 'presser', 'stock_manager'];

export default function StaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'stitcher', phone: '', branch: '', commissionPerPiece: '' });

  useEffect(() => {
    Promise.all([
      api.get('/staff'),
      user.role === 'super_admin' ? api.get('/branches') : Promise.resolve({ data: { data: [] } }),
    ]).then(([sRes, bRes]) => {
      setStaff(sRes.data.data);
      setBranches(bRes.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...form, commissionPerPiece: Number(form.commissionPerPiece) };
      if (user.role === 'admin') payload.branch = user.branch._id;
      const { data } = await api.post('/staff', payload);
      setStaff(s => [data.data, ...s]);
      setShowForm(false);
      setForm({ name: '', email: '', password: '', role: 'stitcher', phone: '', branch: '', commissionPerPiece: '' });
      toast.success('Staff member added!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const toggleActive = async (id, isActive) => {
    try {
      if (isActive) {
        await api.delete(`/staff/${id}`);
      } else {
        await api.put(`/staff/${id}`, { isActive: true });
      }
      setStaff(s => s.map(m => m._id === id ? { ...m, isActive: !isActive } : m));
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm">+ Add Staff</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-gray-700">New Staff Member</h2>
          <div className="grid grid-cols-2 gap-4">
            {[['name', 'Name', 'text', true], ['email', 'Email', 'email', true], ['password', 'Password', 'password', true], ['phone', 'Phone', 'tel', false]].map(([k, l, t, req]) => (
              <div key={k}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{l} {req && '*'}</label>
                <input type={t} required={req} className="input" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select required className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            {user.role === 'super_admin' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Branch *</label>
                <select required className="input" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })}>
                  <option value="">Select branch…</option>
                  {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Commission/piece (PKR)</label>
              <input type="number" className="input" value={form.commissionPerPiece} onChange={e => setForm({ ...form, commissionPerPiece: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">Save</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Name', 'Role', 'Branch', 'Phone', 'Commission', 'Status','Email', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading…</td></tr>
            ) : staff.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No staff found</td></tr>
            ) : staff.map(m => (
              <tr key={m._id} className={`hover:bg-gray-50 transition-colors ${!m.isActive ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{m.role?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-gray-500">{m.branch?.name || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{m.phone || '—'}</td>
                <td className="px-4 py-3 text-gray-500">PKR {m.commissionPerPiece || 0}</td>
                <td className="px-4 py-3 text-gray-500">{m.email}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(m._id, m.isActive)} className="text-xs text-gray-500 hover:text-red-500">
                    {m.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
