"use client";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import type { Branch } from "@/types/user";
import { FEATURES, FEATURE_KEYS, type FeatureKey } from "@/lib/features";
import { to12h } from "@/lib/time";

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

// Same list as backend GARMENT_TYPES / the New Order form.
const GARMENT_TYPES = [
  "Simple Suit",
  "4 Part & Fancy Button",
  "Designing Suit",
  "Selling Suit with Press",
  "Embroidery Suit",
];

export default function SettingsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [values, setValues] = useState<Record<SettingKey, boolean> | null>(
    null,
  );
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [features, setFeatures] = useState<Record<FeatureKey, boolean> | null>(
    null,
  );
  const [appt, setAppt] = useState<{
    enabled: boolean;
    message: string;
    open: string;
    close: string;
    perHour: string;
  } | null>(null);
  const [savingAppt, setSavingAppt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);
  const [savingFeatures, setSavingFeatures] = useState(false);

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

  // Seed all three editors from the selected branch, falling back to defaults
  useEffect(() => {
    if (!branch) {
      setValues(null);
      setFeatures(null);
      setPrices({});
      setAppt(null);
      return;
    }
    setAppt({
      enabled: branch.settings?.appointmentsEnabled ?? true,
      message: branch.settings?.appointmentsClosedMessage ?? "",
      open: branch.settings?.appointmentOpenTime ?? "12:00",
      close: branch.settings?.appointmentCloseTime ?? "22:00",
      perHour: String(branch.settings?.appointmentsPerHour ?? 6),
    });
    setValues(
      Object.fromEntries(
        SETTINGS.map((s) => [s.key, branch.settings?.[s.key] ?? s.defaultValue]),
      ) as Record<SettingKey, boolean>,
    );
    setPrices(
      Object.fromEntries(
        GARMENT_TYPES.map((g) => {
          const p = branch.settings?.garmentPrices?.[g];
          return [g, p === undefined || p === null ? "" : String(p)];
        }),
      ),
    );
    setFeatures(
      Object.fromEntries(
        FEATURE_KEYS.map((k) => [k, branch.features?.[k] ?? FEATURES[k].default]),
      ) as Record<FeatureKey, boolean>,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, branches]);

  const updateBranchInList = (updated: Branch) =>
    setBranches((list) =>
      list.map((b) => (b._id === updated._id ? updated : b)),
    );

  const save = async () => {
    if (!branch || !values) return;
    setSaving(true);
    try {
      const { data } = await api.put(`/branches/${branch._id}/settings`, values);
      updateBranchInList(data.data);
      toast.success("Settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  };

  const savePrices = async () => {
    if (!branch) return;
    setSavingPrices(true);
    try {
      const garmentPrices: Record<string, number> = {};
      for (const g of GARMENT_TYPES) {
        const v = (prices[g] ?? "").trim();
        if (v !== "") garmentPrices[g] = Number(v) || 0;
      }
      const { data } = await api.put(`/branches/${branch._id}/settings`, {
        garmentPrices,
      });
      updateBranchInList(data.data);
      toast.success("Price list saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save price list"));
    } finally {
      setSavingPrices(false);
    }
  };

  const saveFeatures = async () => {
    if (!branch || !features) return;
    setSavingFeatures(true);
    try {
      const { data } = await api.put(
        `/branches/${branch._id}/features`,
        features,
      );
      updateBranchInList(data.data);
      toast.success("Features saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save features"));
    } finally {
      setSavingFeatures(false);
    }
  };

  const saveAppt = async () => {
    if (!branch || !appt) return;
    setSavingAppt(true);
    try {
      const { data } = await api.put(`/branches/${branch._id}/settings`, {
        appointmentsEnabled: appt.enabled,
        appointmentsClosedMessage: appt.message,
        appointmentOpenTime: appt.open,
        appointmentCloseTime: appt.close,
        appointmentsPerHour: Number(appt.perHour) || 6,
      });
      updateBranchInList(data.data);
      toast.success("Appointment settings saved");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save appointment settings"));
    } finally {
      setSavingAppt(false);
    }
  };

  // Branch admins may edit settings/prices only while the branchSettings
  // feature is on for their branch (backend enforces the same rule).
  const settingsAllowed = isSuperAdmin || (branch?.features?.branchSettings ?? true);
  const priceListOn = branch ? branch.features?.priceList ?? true : false;

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
        <>
          {settingsAllowed ? (
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
            <div className="card text-sm text-gray-500 dark:text-gray-400">
              ⚙️ Settings for this branch are managed by the super admin.
            </div>
          )}

          {settingsAllowed && priceListOn && (
            <div className="card space-y-4">
              <div>
                <h2 className="font-semibold text-gray-700 dark:text-gray-300">
                  Default Price List
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Auto-fills the item price on the New Order form. Leave a field
                  blank for no default.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GARMENT_TYPES.map((g) => (
                  <div key={g}>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      {g}
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input text-sm"
                      placeholder="PKR"
                      value={prices[g] ?? ""}
                      onChange={(e) =>
                        setPrices((p) => ({ ...p, [g]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={savePrices}
                disabled={savingPrices}
                className="btn-primary"
              >
                {savingPrices ? "Saving…" : "Save Price List"}
              </button>
            </div>
          )}

          {settingsAllowed && (branch.features?.appointments ?? true) && appt && (
            <div className="card space-y-4">
              <div>
                <h2 className="font-semibold text-gray-700 dark:text-gray-300">
                  Appointments
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Online booking for this branch — shift hours, how many
                  customers per hour, and the &quot;we&apos;re full&quot; switch.
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary mt-0.5"
                  checked={appt.enabled}
                  onChange={(e) =>
                    setAppt((a) => a && { ...a, enabled: e.target.checked })
                  }
                />
                <span>
                  <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                    Accept online appointments
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Turn off to stop new bookings — customers will see your
                    message instead.
                  </span>
                </span>
              </label>
              {!appt.enabled && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Message shown to customers
                  </label>
                  <input
                    className="input text-sm"
                    maxLength={200}
                    placeholder="We are fully booked right now — please call the shop."
                    value={appt.message}
                    onChange={(e) =>
                      setAppt((a) => a && { ...a, message: e.target.value })
                    }
                  />
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Opens
                  </label>
                  <select
                    className="input text-sm"
                    value={appt.open}
                    onChange={(e) =>
                      setAppt((a) => a && { ...a, open: e.target.value })
                    }
                  >
                    {Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`).map(
                      (t) => (
                        <option key={t} value={t}>
                          {to12h(t)}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Closes
                  </label>
                  <select
                    className="input text-sm"
                    value={appt.close}
                    onChange={(e) =>
                      setAppt((a) => a && { ...a, close: e.target.value })
                    }
                  >
                    {Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`).map(
                      (t) => (
                        <option key={t} value={t}>
                          {to12h(t)}
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Per hour
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    className="input text-sm"
                    value={appt.perHour}
                    onChange={(e) =>
                      setAppt((a) => a && { ...a, perHour: e.target.value })
                    }
                  />
                </div>
              </div>
              <button
                onClick={saveAppt}
                disabled={savingAppt}
                className="btn-primary"
              >
                {savingAppt ? "Saving…" : "Save Appointments"}
              </button>
            </div>
          )}

          {isSuperAdmin && features && (
            <div className="card space-y-4">
              <div>
                <h2 className="font-semibold text-gray-700 dark:text-gray-300">
                  Features — {branch.name}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Which features this branch&apos;s admin and staff can use.
                  Changes apply for them on their next page load.
                </p>
              </div>
              {FEATURE_KEYS.map((k) => (
                <label
                  key={k}
                  className="flex items-start gap-3 cursor-pointer border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-primary mt-0.5"
                    checked={features[k]}
                    onChange={(e) =>
                      setFeatures((f) => f && { ...f, [k]: e.target.checked })
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-gray-800 dark:text-gray-200">
                      {FEATURES[k].label}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {FEATURES[k].description}
                    </span>
                  </span>
                </label>
              ))}
              <button
                onClick={saveFeatures}
                disabled={savingFeatures}
                className="btn-primary"
              >
                {savingFeatures ? "Saving…" : "Save Features"}
              </button>
            </div>
          )}
        </>
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
