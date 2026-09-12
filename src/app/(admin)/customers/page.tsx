"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { UserPlusIcon } from "@heroicons/react/24/outline";
import { normalizePkMobile, PHONE_ERROR } from "@/lib/phone";
import type { AxiosError } from "axios";
import type { Customer } from "@/types/customer";
import type { Gender } from "@/types/user";

interface CustomerForm {
  name: string;
  phone: string;
  email: string;
  gender: Gender | "";
  address: string;
}

const EMPTY_FORM: CustomerForm = { name: "", phone: "", email: "", gender: "", address: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);

  const fetchCustomers = (q = "") => {
    setLoading(true);
    api
      .get("/customers", { params: q ? { search: q } : {} })
      .then((r) => setCustomers(r.data.data))
      .catch(() => toast.error("Failed to load customers"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    fetchCustomers(search);
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedPhone = normalizePkMobile(form.phone);
    if (!normalizedPhone) {
      toast.error(PHONE_ERROR);
      return;
    }
    try {
      const { data } = await api.post("/customers", {
        ...form,
        phone: normalizedPhone,
      });
      setCustomers((c) => [data.data, ...c]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast.success("Customer added!");
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(axiosErr.response?.data?.message || "Failed to create customer");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">Customers</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary text-sm"
        >
          <UserPlusIcon className="h-4 w-4" aria-hidden="true" />
          Add Customer
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-ink">New Customer</h2>
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
              <label className="block text-sm font-semibold text-ink mb-1">Phone *</label>
              <input
                required
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-1">Gender</label>
              <select
                className="input"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value as Gender | "" })}
              >
                <option value="">Select…</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-1">Address</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">
              Save Customer
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
        <input
          className="input flex-1 min-w-[160px] sm:max-w-xs"
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className="btn-primary text-sm">
          Search
        </button>
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              fetchCustomers();
            }}
            className="btn-secondary text-sm"
          >
            Clear
          </button>
        )}
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
        </div>
      ) : customers.length === 0 ? (
        <div className="card text-center py-12 text-faint">No customers found</div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {customers.map((c) => (
              <Link
                key={c._id}
                href={`/customers/${c._id}`}
                className="card block space-y-1"
              >
                <div className="font-semibold text-ink">{c.name}</div>
                <div className="text-sm text-muted">{c.phone}</div>
                <div className="text-xs text-faint">
                  {c.email || "—"} · {c.gender || "—"}
                </div>
                <div className="text-xs text-faint">
                  {(typeof c.branch === "object" && c.branch?.name) || "—"}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block table-wrap">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    {["Name", "Phone", "Email", "Gender", "Branch", "Actions"].map((h) => (
                      <th key={h} className="whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c._id}>
                      <td className="font-semibold text-ink">{c.name}</td>
                      <td className="text-muted">{c.phone}</td>
                      <td className="text-muted">{c.email || "—"}</td>
                      <td className="capitalize text-muted">{c.gender || "—"}</td>
                      <td className="text-muted">
                        {(typeof c.branch === "object" && c.branch?.name) || "—"}
                      </td>
                      <td>
                        <Link
                          href={`/customers/${c._id}`}
                          className="text-accent hover:underline text-xs font-semibold"
                        >
                          View / Edit
                        </Link>
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
