"use client";
import { useEffect, useState, type FormEvent } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useDialog } from "@/context/DialogContext";
import toast from "react-hot-toast";
import { UserPlusIcon, PencilSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { normalizePkMobile, PHONE_ERROR } from "@/lib/phone";
import { errorMessage } from "@/lib/errorMessage";
import type { User, UserRole, Branch } from "@/types/user";

// Backend enum value → display label
const ROLE_LABELS: Partial<Record<UserRole, string>> = {
  admin: "Admin",
  checker: "Checker",
  cutting_master: "Cutting Master",
  stitcher: "Stitcher",
  presser: "Press Man",
  stock_manager: "Stock Manager",
};
const ROLES = Object.keys(ROLE_LABELS) as UserRole[];
// Checker always needs login (reviews orders through the admin panel), same as admin.
// super_admin is never created from this form.
const LOGIN_REQUIRED_ROLES: UserRole[] = ["admin", "checker"];

interface StaffForm {
  name: string;
  phone: string;
  role: UserRole;
  branch: string;
  commissionPerPiece: string;
  email: string;
  password: string;
}

const emptyForm: StaffForm = {
  name: "",
  phone: "",
  role: "stitcher",
  branch: "",
  commissionPerPiece: "",
  email: "",
  password: "",
};

export default function StaffPage() {
  const { user } = useAuth();
  const dialog = useDialog();
  const [staff, setStaff] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [wantsLogin, setWantsLogin] = useState(false);
  const [form, setForm] = useState<StaffForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const requiresLogin = LOGIN_REQUIRED_ROLES.includes(form.role);
  const showLoginFields = requiresLogin || wantsLogin;

  // Creating admin accounts is super_admin-only (enforced server-side too) —
  // branch admins only get the shop-floor/checker roles here.
  const assignableRoles =
    user?.role === "super_admin" ? ROLES : ROLES.filter((r) => r !== "admin");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get("/staff"),
      user.role === "super_admin"
        ? api.get("/branches")
        : Promise.resolve({ data: { data: [] } }),
    ])
      .then(([sRes, bRes]) => {
        setStaff(sRes.data.data);
        setBranches(bRes.data.data);
      })
      .catch((err) => toast.error(errorMessage(err, "Failed to load staff")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const resetForm = () => {
    setForm(emptyForm);
    setWantsLogin(false);
    setShowForm(false);
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    // Phone is optional for staff, but when given it must be a valid PK mobile.
    if (form.phone && !normalizePkMobile(form.phone)) {
      toast.error(PHONE_ERROR);
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        phone: form.phone,
        role: form.role,
        commissionPerPiece: Number(form.commissionPerPiece) || 0,
      };
      if (user.role === "super_admin") payload.branch = form.branch;
      if (showLoginFields) {
        payload.email = form.email;
        payload.password = form.password;
      }

      const { data } = await api.post("/staff", payload);
      setStaff((s) => [data.data, ...s]);
      resetForm();
      toast.success("Staff member added!");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add staff member"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      // Both directions go through PUT — DELETE is a real (guarded) delete now.
      await api.put(`/staff/${id}`, { isActive: !isActive });
      setStaff((s) =>
        s.map((m) => (m._id === id ? { ...m, isActive: !isActive } : m)),
      );
    } catch {
      toast.error("Failed");
    }
  };

  // Mirror of the backend rules: no self-delete, and admin accounts can only
  // be deleted by a super_admin. Staff with order history come back as a 409
  // from the API with a "deactivate instead" message.
  const canDelete = (m: User) =>
    m._id !== user?._id && (m.role !== "admin" || user?.role === "super_admin");

  // Backend rule: you can't deactivate your own account (it would lock you
  // out mid-session), so your own row gets no toggle.
  const canToggleActive = (m: User) => m._id !== user?._id;

  const deleteStaff = async (m: User) => {
    const ok = await dialog.confirm({
      title: "Delete Staff",
      message: `Permanently delete ${m.name}? This cannot be undone.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/staff/${m._id}`);
      setStaff((s) => s.filter((x) => x._id !== m._id));
      toast.success("Staff deleted");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete staff"));
    }
  };

  // Inline commission-rate editing — the one staff detail an admin adjusts
  // day-to-day, so it's editable right in the list.
  const [rateEdit, setRateEdit] = useState<{ id: string; value: string } | null>(
    null,
  );
  const saveRate = async () => {
    if (!rateEdit) return;
    try {
      const { data } = await api.put(`/staff/${rateEdit.id}`, {
        commissionPerPiece: Number(rateEdit.value) || 0,
      });
      setStaff((s) =>
        s.map((m) =>
          m._id === rateEdit.id
            ? { ...m, commissionPerPiece: data.data.commissionPerPiece }
            : m,
        ),
      );
      setRateEdit(null);
      toast.success("Commission rate updated");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update rate"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">Staff</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary text-sm"
        >
          <UserPlusIcon className="h-4 w-4" aria-hidden="true" />
          Add Staff
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-ink">New Staff Member</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Name *</label>
              <input
                required
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Phone Number *</label>
              <input
                required
                type="tel"
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Role *</label>
              <select
                required
                className="input"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              >
                {assignableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
            {user?.role === "super_admin" && (
              <div>
                <label className="block text-sm font-semibold text-ink mb-1">Branch *</label>
                <select
                  required
                  className="input"
                  value={form.branch}
                  onChange={(e) => setForm({ ...form, branch: e.target.value })}
                >
                  <option value="">Select branch…</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">
                Commission/piece (PKR)
              </label>
              <input
                type="number"
                className="input"
                value={form.commissionPerPiece}
                onChange={(e) =>
                  setForm({ ...form, commissionPerPiece: e.target.value })
                }
              />
            </div>
          </div>

          {/* Login access toggle — not needed for shop-floor roles, this is just a data record */}
          <div className="border-t border-border pt-4">
            {requiresLogin ? (
              <p className="text-xs text-muted mb-2">
                This role needs to sign in to the admin panel, so email &amp;
                password are required.
              </p>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={wantsLogin}
                  onChange={(e) => setWantsLogin(e.target.checked)}
                  className="w-4 h-4 text-accent"
                />
                <span className="text-sm font-semibold text-ink">
                  Give this staff member login access
                </span>
              </label>
            )}

            {showLoginFields && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div>
                  <label className="block text-sm font-semibold text-ink mb-1">
                    Email {requiresLogin && "*"}
                  </label>
                  <input
                    type="email"
                    required={requiresLogin}
                    className="input"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink mb-1">
                    Password {requiresLogin && "*"}
                  </label>
                  <input
                    type="password"
                    required={requiresLogin}
                    className="input"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-sm"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : staff.length === 0 ? (
        <div className="card text-center py-12 text-faint">No staff found</div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {staff.map((m) => (
              <div
                key={m._id}
                className={`card space-y-2 ${!m.isActive ? "opacity-50" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-ink">
                    {m.name}
                    {m._id === user?._id && (
                      <span className="ml-1 text-xs font-normal text-faint">(you)</span>
                    )}
                  </span>
                  <span className={m.isActive ? "badge-success" : "badge-neutral"}>
                    {m.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="text-sm text-muted">
                  {ROLE_LABELS[m.role] || m.role?.replace(/_/g, " ")} ·{" "}
                  {(typeof m.branch === "object" && m.branch?.name) || "—"}
                </div>
                <div className="text-xs text-muted flex items-center gap-1 flex-wrap">
                  <span>{m.phone || "—"} ·</span>
                  {rateEdit?.id === m._id ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        autoFocus
                        className="input text-xs py-0.5 w-20"
                        value={rateEdit.value}
                        onChange={(e) =>
                          setRateEdit({ id: m._id, value: e.target.value })
                        }
                        onKeyDown={(e) => e.key === "Enter" && saveRate()}
                      />
                      <button onClick={saveRate} className="text-accent font-semibold">
                        Save
                      </button>
                      <button onClick={() => setRateEdit(null)} className="text-faint">
                        <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() =>
                        setRateEdit({
                          id: m._id,
                          value: String(m.commissionPerPiece || 0),
                        })
                      }
                      title="Edit commission rate"
                      className="inline-flex items-center gap-1 hover:text-accent"
                    >
                      PKR {m.commissionPerPiece || 0}/piece
                      <PencilSquareIcon className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </div>
                <div className="text-xs text-muted">
                  {m.hasLogin ? <span>{m.email}</span> : <span className="text-faint">No login</span>}
                </div>
                <div className="flex gap-4">
                  {canToggleActive(m) && (
                    <button
                      onClick={() => toggleActive(m._id, m.isActive)}
                      className="text-xs text-muted hover:text-danger"
                    >
                      {m.isActive ? "Deactivate" : "Activate"}
                    </button>
                  )}
                  {canDelete(m) && (
                    <button
                      onClick={() => deleteStaff(m)}
                      className="text-xs text-danger hover:underline"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block table-wrap">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {[
                      "Name",
                      "Role",
                      "Branch",
                      "Phone",
                      "Commission",
                      "Login",
                      "Status",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staff.map((m) => (
                    <tr key={m._id} className={!m.isActive ? "opacity-50" : ""}>
                      <td className="font-semibold text-ink">
                        {m.name}
                        {m._id === user?._id && (
                          <span className="ml-1 text-xs font-normal text-faint">(you)</span>
                        )}
                      </td>
                      <td className="text-muted">
                        {ROLE_LABELS[m.role] || m.role?.replace(/_/g, " ")}
                      </td>
                      <td className="text-muted">
                        {(typeof m.branch === "object" && m.branch?.name) || "—"}
                      </td>
                      <td className="text-muted">{m.phone || "—"}</td>
                      <td className="text-muted whitespace-nowrap">
                        {rateEdit?.id === m._id ? (
                          <span className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              autoFocus
                              className="input text-xs py-1 w-20"
                              value={rateEdit.value}
                              onChange={(e) =>
                                setRateEdit({ id: m._id, value: e.target.value })
                              }
                              onKeyDown={(e) => e.key === "Enter" && saveRate()}
                            />
                            <button
                              onClick={saveRate}
                              className="text-xs text-accent font-semibold hover:underline"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setRateEdit(null)}
                              className="text-xs text-faint"
                            >
                              <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              setRateEdit({
                                id: m._id,
                                value: String(m.commissionPerPiece || 0),
                              })
                            }
                            title="Edit commission rate"
                            className="inline-flex items-center gap-1 hover:text-accent"
                          >
                            PKR {m.commissionPerPiece || 0}
                            <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </td>
                      <td className="text-muted">
                        {m.hasLogin ? (
                          <span className="text-muted">{m.email}</span>
                        ) : (
                          <span className="text-faint text-xs">No login</span>
                        )}
                      </td>
                      <td>
                        <span className={m.isActive ? "badge-success" : "badge-neutral"}>
                          {m.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap">
                        {canToggleActive(m) && (
                          <button
                            onClick={() => toggleActive(m._id, m.isActive)}
                            className="text-xs text-muted hover:text-danger"
                          >
                            {m.isActive ? "Deactivate" : "Activate"}
                          </button>
                        )}
                        {canDelete(m) && (
                          <button
                            onClick={() => deleteStaff(m)}
                            className="ml-3 text-xs text-danger hover:underline"
                          >
                            Delete
                          </button>
                        )}
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
