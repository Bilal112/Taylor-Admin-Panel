'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

// Backend enum value → display label
const ROLE_LABELS = {
  admin: 'Admin',
  checker: 'Checker',
  cutting_master: 'Cutting Master',
  stitcher: 'Stitcher',
  presser: 'Press Man',
  stock_manager: 'Stock Manager',
};
const ROLES = Object.keys(ROLE_LABELS);
// Checker always needs login (reviews orders through the admin panel), same as admin.
// super_admin is never created from this form.
const LOGIN_REQUIRED_ROLES = ['admin', 'checker'];

const emptyForm = { name: '', phone: '', role: 'stitcher', branch: '', commissionPerPiece: '', email: '', password: '' };

export default function StaffPage() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [wantsLogin, setWantsLogin] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const requiresLogin = LOGIN_REQUIRED_ROLES.includes(form.role);
  const showLoginFields = requiresLogin || wantsLogin;

  useEffect(() => {
    Promise.all([
      api.get('/staff'),
      user.role === 'super_admin' ? api.get('/branches') : Promise.resolve({ data: { data: [] } }),
    ]).then(([sRes, bRes]) => {
      setStaff(sRes.data.data);
      setBranches(bRes.data.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const resetForm = () => {
    setForm(emptyForm);
    setWantsLogin(false);
    setShowForm(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        phone: form.phone,
        role: form.role,
        commissionPerPiece: Number(form.commissionPerPiece) || 0,
      };
      if (user.role === 'super_admin') payload.branch = form.branch;
      if (showLoginFields) {
        payload.email = form.email;
        payload.password = form.password;
      }

      const { data } = await api.post('/staff', payload);
      setStaff(s => [data.data, ...s]);
      resetForm();
      toast.success('Staff member added!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Staff</h1>
        <button onClick={() => setShowForm(v => !v)} className="btn-primary text-sm">+ Add Staff</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-gray-700">New Staff Member</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input required className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
              <input required type="tel" className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select required className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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

          {/* Login access toggle — not needed for shop-floor roles, this is just a data record */}
          <div className="border-t border-gray-100 pt-4">
            {requiresLogin ? (
              <p className="text-xs text-gray-500 mb-2">This role needs to sign in to the admin panel, so email &amp; password are required.</p>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input type="checkbox" checked={wantsLogin} onChange={e => setWantsLogin(e.target.checked)} className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-gray-700">Give this staff member login access</span>
              </label>
            )}

            {showLoginFields && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email {requiresLogin && '*'}</label>
                  <input type="email" required={requiresLogin} className="input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password {requiresLogin && '*'}</label>
                  <input type="password" required={requiresLogin} className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary text-sm">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" onClick={resetForm} className="btn-secondary text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : staff.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No staff found</div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {staff.map(m => (
              <div key={m._id} className={`card space-y-2 ${!m.isActive ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className="font-medium">{m.name}</span>
                  <span className={`badge ${m.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {m.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="text-sm text-gray-600">{ROLE_LABELS[m.role] || m.role?.replace(/_/g, ' ')} · {m.branch?.name || '—'}</div>
                <div className="text-xs text-gray-500">{m.phone || '—'} · PKR {m.commissionPerPiece || 0}/piece</div>
                <div className="text-xs text-gray-500">
                  {m.hasLogin ? <span>{m.email}</span> : <span className="text-gray-300">No login</span>}
                </div>
                <button onClick={() => toggleActive(m._id, m.isActive)} className="text-xs text-gray-500 hover:text-red-500">
                  {m.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['Name', 'Role', 'Branch', 'Phone', 'Commission', 'Login', 'Status', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {staff.map(m => (
                    <tr key={m._id} className={`hover:bg-gray-50 transition-colors ${!m.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{m.name}</td>
                      <td className="px-4 py-3 text-gray-600">{ROLE_LABELS[m.role] || m.role?.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-gray-500">{m.branch?.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{m.phone || '—'}</td>
                      <td className="px-4 py-3 text-gray-500">PKR {m.commissionPerPiece || 0}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {m.hasLogin ? <span className="text-gray-600">{m.email}</span> : <span className="text-gray-300 text-xs">No login</span>}
                      </td>
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
        </>
      )}
    </div>
  );
}
