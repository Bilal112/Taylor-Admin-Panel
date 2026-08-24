"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";
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
    try {
      const { data } = await api.post("/customers", form);
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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          Customers
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary text-sm"
        >
          + Add Customer
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">New Customer</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                required
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Phone *
              </label>
              <input
                required
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gender
              </label>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Address
            </label>
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : customers.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 dark:text-gray-500">
          No customers found
        </div>
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
                <div className="font-medium text-gray-900 dark:text-gray-100">{c.name}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{c.phone}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {c.email || "—"} · {c.gender || "—"}
                </div>
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  {(typeof c.branch === "object" && c.branch?.name) || "—"}
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    {[
                      "Name",
                      "Phone",
                      "Email",
                      "Gender",
                      "Branch",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {customers.map((c) => (
                    <tr
                      key={c._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{c.phone}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {c.email || "—"}
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-300">
                        {c.gender || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {(typeof c.branch === "object" && c.branch?.name) || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/customers/${c._id}`}
                          className="text-primary hover:underline text-xs font-medium"
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
