"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import type { Branch } from "@/types/user";

type SettingKey = "requireOrderPrice" | "autoAssignOrders";

// Mirrors backend Branch.settings — defaults here must match the backend's,
// since branches created before settings existed have no object at all.
const SETTINGS: {
  key: SettingKey;
  label: string;
  description: string;
  defaultValue: boolean;
}[] = [
  {
    key: "requireOrderPrice",
    label: "Price required on new orders",
    description:
      "Every item must have a price before an order can be created. Turn off to take orders first and add prices later by editing the order.",
    defaultValue: true,
  },
  {
    key: "autoAssignOrders",
    label: "Auto-assign new orders",
    description:
      "If no cutting master is picked on the New Order form, the least busy one is assigned automatically — instead of saving the order as a draft.",
    defaultValue: false,
  },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [values, setValues] = useState<Record<SettingKey, boolean> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/branches")
      .then(({ data }) => {
        setBranches(data.data);
        // An admin only ever gets their own branch back — select it right
        // away. super_admin picks from the dropdown (preselected when there
        // is just one branch anyway).
        if (data.data.length === 1) setBranchId(data.data[0]._id);
      })
      .catch((err) => toast.error(errorMessage(err, "Failed to load settings")))
      .finally(() => setLoading(false));
  }, []);

  const branch = branches.find((b) => b._id === branchId);

  // Seed the toggles from the selected branch, falling back to defaults
  useEffect(() => {
    if (!branch) {
      setValues(null);
      return;
    }
    setValues(
      Object.fromEntries(
        SETTINGS.map((s) => [s.key, branch.settings?.[s.key] ?? s.defaultValue]),
      ) as Record<SettingKey, boolean>,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, branches]);

  const save = async () => {
    if (!branch || !values) return;
    setSaving(true);
    try {
      const { data } = await api.put(
        `/branches/${branch._id}/settings`,
        values,
      );
      setBranches((list) =>
        list.map((b) => (b._id === branch._id ? data.data : b)),
      );
      toast.success("Settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
        Settings
      </h1>

      {isSuperAdmin && (
        <div className="card">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Branch
          </label>
          <select
            className="input"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
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

      {branch && values ? (
        <div className="card space-y-4">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">
            Order Settings — {branch.name}
          </h2>
          {SETTINGS.map((s) => (
            <label
              key={s.key}
              className="flex items-start gap-3 cursor-pointer border border-gray-200 dark:border-gray-700 rounded-lg p-3"
            >
              <input
                type="checkbox"
                className="w-4 h-4 text-primary mt-0.5"
                checked={values[s.key]}
                onChange={(e) =>
                  setValues((v) => v && { ...v, [s.key]: e.target.checked })
                }
              />
              <span>
                <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                  {s.label}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {s.description}
                </span>
              </span>
            </label>
          ))}
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      ) : (
        !isSuperAdmin && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No branch found for your account.
          </p>
        )
      )}
    </div>
  );
}
