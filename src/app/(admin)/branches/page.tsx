"use client";
import { useEffect, useState, type FormEvent } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import {
  PlusIcon,
  BuildingStorefrontIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import type { Branch } from "@/types/user";

interface BranchForm {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
}

const EMPTY_FORM: BranchForm = { name: "", address: "", city: "", phone: "", email: "" };

const FORM_FIELDS: [keyof BranchForm, string, boolean][] = [
  ["name", "Branch Name", true],
  ["address", "Address", true],
  ["city", "City", false],
  ["phone", "Phone", false],
  ["email", "Email", false],
];

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<BranchForm>(EMPTY_FORM);

  useEffect(() => {
    api
      .get("/branches")
      .then((r) => setBranches(r.data.data))
      .catch((err) => toast.error(errorMessage(err, "Failed to load branches")))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/branches", form);
      setBranches((b) => [data.data, ...b]);
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast.success("Branch created!");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to create branch"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
          Branches
        </h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-primary text-sm"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          Add Branch
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card space-y-4">
          <h2 className="font-semibold text-ink">New Branch</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FORM_FIELDS.map(([k, l, req]) => (
              <div key={k} className={k === "address" ? "sm:col-span-2" : ""}>
                <label className="block text-sm font-semibold text-ink mb-1">
                  {l} {req && "*"}
                </label>
                <input
                  required={req}
                  className="input"
                  value={form[k]}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">
              Create Branch
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-faint">
            Loading…
          </div>
        ) : branches.length === 0 ? (
          <div className="col-span-full text-center py-12 text-faint">
            No branches yet
          </div>
        ) : (
          branches.map((b: any) => (
            <div
              key={b._id}
              className={`card ${!b.isActive ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-ink flex items-center gap-1.5">
                  <BuildingStorefrontIcon className="h-4 w-4 text-accent shrink-0" aria-hidden="true" />
                  {b.name}
                </h3>
                <span className={b.isActive ? "badge-success" : "badge-neutral"}>
                  {b.isActive ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="text-sm text-muted space-y-1">
                <p className="flex items-center gap-1.5">
                  <MapPinIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {b.address}
                  {b.city ? `, ${b.city}` : ""}
                </p>
                {b.phone && (
                  <p className="flex items-center gap-1.5">
                    <PhoneIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {b.phone}
                  </p>
                )}
                {b.email && (
                  <p className="flex items-center gap-1.5">
                    <EnvelopeIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {b.email}
                  </p>
                )}
                {b.admin && (
                  <p className="flex items-center gap-1.5">
                    <UserIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Admin: {b.admin.name}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
