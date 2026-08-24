"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";

const GARMENT_TYPES = [
  "Simple Suit",
  "4 Part & Fancy Button",
  "Designing Suit",
  "Selling Suit with Press",
  "Embroidery Suit",
];

const MEASUREMENT_FIELDS = [
  ["chest", "Chest"],
  ["waist", "Waist"],
  ["hips", "Hips"],
  ["shoulder", "Shoulder"],
  ["sleeveLength", "Sleeve"],
  ["neck", "Neck"],
  ["inseam", "Inseam"],
  ["outseam", "Outseam"],
  ["thigh", "Thigh"],
  ["height", "Height"],
];

const STAFF_ROLES = [
  ["cuttingMaster", "cutting_master", "Cutting Master"],
  ["stitcher", "stitcher", "Stitcher"],
  ["presser", "presser", "Press Man"],
];

const emptyItem = () => ({
  garmentType: "",
  quantity: "1",
  basePrice: "",
  fabric: "",
  fabricSource: "customer_provided",
  fabricAmount: "0",
});

const itemLineTotal = (it) =>
  (Number(it.basePrice) || 0) * (Number(it.quantity) || 1) +
  (Number(it.fabricAmount) || 0);

export default function NewOrderPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [staffByRole, setStaffByRole] = useState({});
  const [assignment, setAssignment] = useState({
    cuttingMaster: "",
    stitcher: "",
    presser: "",
  });

  // Load assignable staff for the three roles (used to populate the dropdowns)
  useEffect(() => {
    Promise.all(
      STAFF_ROLES.map(([, role]) => api.get("/staff", { params: { role } })),
    )
      .then((results) => {
        const map = {};
        STAFF_ROLES.forEach(([field], i) => {
          map[field] = results[i].data.data.filter((s) => s.isActive);
        });
        setStaffByRole(map);
      })
      .catch(console.error);
  }, []);

  // Phone lookup state
  const [phone, setPhone] = useState("");
  const [looking, setLooking] = useState(false);
  const [customer, setCustomer] = useState(null); // found customer
  const [customerStatus, setCustomerStatus] = useState(""); // 'found' | 'new' | ''
  const [newCustomerName, setNewCustomerName] = useState("");
  const [measurements, setMeasurements] = useState({});
  const [showHistory, setShowHistory] = useState(false);

  // One order can have several items — e.g. 1 Simple Suit + 2 Designing Suits
  // for the same customer visit. Suit No is a single serial for the whole
  // order (the shop's own tag for this customer/visit), not per item.
  const [items, setItems] = useState([emptyItem()]);

  const [form, setForm] = useState({
    suitNo: "",
    styleNotes: "",
    promisedDate: "",
    isRush: false,
    rushSurcharge: "0",
    notes: "",
    advancePayment: "",
    paymentMethod: "cash",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setM = (k, v) => setMeasurements((m) => ({ ...m, [k]: v }));

  const setItem = (idx, k, v) =>
    setItems((list) =>
      list.map((it, i) => (i === idx ? { ...it, [k]: v } : it)),
    );
  const addItem = () => setItems((list) => [...list, emptyItem()]);
  const removeItem = (idx) =>
    setItems((list) =>
      list.length > 1 ? list.filter((_, i) => i !== idx) : list,
    );

  // Promised date can't be backdated — earliest allowed is today (current server date's local day).
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local timezone

  // ----- Phone lookup -----
  const lookupPhone = async () => {
    if (!phone.trim()) return;
    setLooking(true);
    setCustomer(null);
    setCustomerStatus("");
    try {
      const { data } = await api.get("/customers/lookup", {
        params: { phone: phone.trim() },
      });
      if (data.found) {
        setCustomer(data.data);
        setMeasurements(data.data.measurements || {});
        setCustomerStatus("found");
        toast.success(`Customer found: ${data.data.name}`);
      } else {
        setCustomerStatus("new");
        setMeasurements({});
        toast("New customer — fill in name & measurements", { icon: "👤" });
      }
    } catch {
      toast.error("Lookup failed");
    } finally {
      setLooking(false);
    }
  };

  // ----- Submit -----
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!customerStatus) {
      toast.error("Look up a phone number first");
      return;
    }
    if (form.promisedDate && form.promisedDate < todayStr) {
      toast.error("Promised date cannot be in the past");
      return;
    }
    if (items.some((it) => !it.garmentType)) {
      toast.error("Pick an item type for every line");
      return;
    }
    setLoading(true);
    try {
      let customerId = customer?._id;

      // Create new customer if needed
      if (customerStatus === "new") {
        if (!newCustomerName.trim()) {
          toast.error("Enter customer name");
          setLoading(false);
          return;
        }
        const { data } = await api.post("/customers", {
          name: newCustomerName.trim(),
          phone: phone.trim(),
        });
        customerId = data.data._id;
        setCustomer(data.data);
      }

      // Save measurements if any field filled
      const hasMeasurement = Object.values(measurements).some(
        (v) => v !== "" && v !== undefined && v !== null,
      );
      if (hasMeasurement && customerId) {
        await api.put(`/customers/${customerId}/measurements`, measurements);
      }

      // Create order
      const payload = {
        customer: customerId,
        suitNo: form.suitNo || undefined,
        items: items.map((it) => ({
          garmentType: it.garmentType,
          quantity: Number(it.quantity) || 1,
          basePrice: Number(it.basePrice) || 0,
          fabric: it.fabric,
          fabricSource: it.fabricSource,
          fabricAmount: Number(it.fabricAmount) || 0,
        })),
        styleNotes: form.styleNotes,
        promisedDate: form.promisedDate,
        isRush: form.isRush,
        rushSurcharge: Number(form.rushSurcharge),
        notes: form.notes,
        measurements: hasMeasurement ? measurements : undefined,
        payments: form.advancePayment
          ? [
              {
                amount: Number(form.advancePayment),
                method: form.paymentMethod,
              },
            ]
          : [],
        // Manual staff assignment — all optional. If none picked, order is created
        // as a draft and can be assigned later from the order detail page.
        cuttingMaster: assignment.cuttingMaster || undefined,
        stitcher: assignment.stitcher || undefined,
        presser: assignment.presser || undefined,
      };

      const { data: orderData } = await api.post("/orders", payload);
      if (orderData.data.status === "draft") {
        toast.success(
          `Order ${orderData.data.orderNumber} saved as draft — assign staff to activate it`,
          { icon: "📝" },
        );
      } else {
        toast.success(`Order ${orderData.data.orderNumber} created!`);
      }
      router.push(`/orders/${orderData.data._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create order");
    } finally {
      setLoading(false);
    }
  };

  const itemsSubtotal = items.reduce((sum, it) => sum + itemLineTotal(it), 0);
  const rushAmount = form.isRush ? Number(form.rushSurcharge) || 0 : 0;
  const estimatedTotal = itemsSubtotal + rushAmount;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">New Order</h1>

      {/* ── Step 1: Phone lookup ── */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700">Step 1 — Customer</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            className="input flex-1 min-w-[160px]"
            placeholder="Enter customer phone number…"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && (e.preventDefault(), lookupPhone())
            }
          />
          <button
            type="button"
            onClick={lookupPhone}
            disabled={looking || !phone}
            className="btn-primary text-sm px-4"
          >
            {looking ? "Looking…" : "Lookup"}
          </button>
        </div>

        {/* Found customer */}
        {customerStatus === "found" && customer && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-800">
                  ✅ {customer.name}
                </p>
                <p className="text-sm text-green-600">{customer.phone}</p>
              </div>
              <button
                onClick={() => setCustomerStatus("")}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Change
              </button>
            </div>

            {/* Current measurements */}
            {customer.measurements &&
              Object.keys(customer.measurements).length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-green-700 mb-2">
                    📏 Saved Measurements (inches) — update if changed:
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {MEASUREMENT_FIELDS.map(([k, l]) => (
                      <div key={k}>
                        <label className="block text-xs text-gray-500 mb-1">
                          {l}
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          className="input text-xs text-center py-1"
                          value={measurements[k] || ""}
                          onChange={(e) => setM(k, Number(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Measurement history */}
            {customer.measurementHistory?.length > 0 && (
              <div>
                <button
                  onClick={() => setShowHistory((v) => !v)}
                  className="text-xs text-primary hover:underline"
                >
                  {showHistory ? "Hide" : "Show"} measurement history (
                  {customer.measurementHistory.length} records)
                </button>
                {showHistory && (
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                    {customer.measurementHistory.map((h, i) => (
                      <div
                        key={i}
                        className="bg-white border border-gray-100 rounded p-2 text-xs text-gray-600"
                      >
                        <p className="font-medium text-gray-700 mb-1">
                          {h.takenAt
                            ? new Date(h.takenAt).toLocaleDateString()
                            : "Unknown date"}
                          {h.takenBy?.name && ` — by ${h.takenBy.name}`}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {MEASUREMENT_FIELDS.map(([k, l]) =>
                            h[k] ? (
                              <span key={k}>
                                {l}: <b>{h[k]}"</b>
                              </span>
                            ) : null,
                          )}
                        </div>
                        {h.notes && <p className="mt-1 italic">{h.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* New customer */}
        {customerStatus === "new" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-blue-800">
              👤 New customer — will be created
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Customer Name *
              </label>
              <input
                className="input"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <p className="text-xs font-medium text-gray-600 mb-1">
              Measurements (inches) — optional but recommended:
            </p>
            <div className="grid grid-cols-5 gap-2">
              {MEASUREMENT_FIELDS.map(([k, l]) => (
                <div key={k}>
                  <label className="block text-xs text-gray-500 mb-1">
                    {l}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    className="input text-xs text-center py-1"
                    value={measurements[k] || ""}
                    onChange={(e) => setM(k, Number(e.target.value))}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Step 2: Order details ── */}
      {customerStatus && (
        <form onSubmit={handleSubmit} className="card space-y-4">
          <h2 className="font-semibold text-gray-700">
            Step 2 — Order Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Suit No
              </label>
              <input
                className="input"
                value={form.suitNo}
                onChange={(e) => set("suitNo", e.target.value)}
                placeholder="Shop's serial number for this order"
              />
              <p className="text-xs text-gray-400 mt-1">
                One serial for this whole order/customer visit.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Promised Date *
              </label>
              <input
                required
                type="date"
                min={todayStr}
                className="input"
                value={form.promisedDate}
                onChange={(e) => set("promisedDate", e.target.value)}
              />
            </div>
          </div>

          {/* ── Item lines — multiple items per order ── */}
          <hr className="border-gray-100" />
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700">Items</h3>
            <button
              type="button"
              onClick={addItem}
              className="btn-secondary text-xs"
            >
              + Add Item
            </button>
          </div>

          <div className="space-y-3">
            {items.map((it, idx) => (
              <div
                key={idx}
                className="border border-gray-200 rounded-lg p-3 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400">
                    Item {idx + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Item Type *
                    </label>
                    <select
                      required
                      className="input text-sm"
                      value={it.garmentType}
                      onChange={(e) =>
                        setItem(idx, "garmentType", e.target.value)
                      }
                    >
                      <option value="">Select item…</option>
                      {GARMENT_TYPES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Quantity *
                    </label>
                    <input
                      required
                      type="number"
                      min="1"
                      className="input text-sm"
                      value={it.quantity}
                      onChange={(e) => setItem(idx, "quantity", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Price per Unit (PKR) *
                    </label>
                    <input
                      required
                      type="number"
                      className="input text-sm"
                      value={it.basePrice}
                      onChange={(e) =>
                        setItem(idx, "basePrice", e.target.value)
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Fabric
                    </label>
                    <input
                      className="input text-sm"
                      value={it.fabric}
                      onChange={(e) => setItem(idx, "fabric", e.target.value)}
                      placeholder="Cotton, Silk…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Fabric Source
                    </label>
                    <select
                      className="input text-sm"
                      value={it.fabricSource}
                      onChange={(e) =>
                        setItem(idx, "fabricSource", e.target.value)
                      }
                    >
                      <option value="customer_provided">
                        Customer Provided
                      </option>
                      <option value="shop_supplied">Shop Supplied</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Fabric Amount (PKR)
                    </label>
                    <input
                      type="number"
                      className="input text-sm"
                      value={it.fabricAmount}
                      onChange={(e) =>
                        setItem(idx, "fabricAmount", e.target.value)
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  Line total:{" "}
                  <span className="font-semibold text-gray-700">
                    PKR {itemLineTotal(it).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Style Notes
            </label>
            <textarea
              className="input"
              rows={2}
              value={form.styleNotes}
              onChange={(e) => set("styleNotes", e.target.value)}
              placeholder="Design instructions…"
            />
          </div>

          <hr className="border-gray-100" />
          <h3 className="font-semibold text-gray-700">Billing</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Advance Payment (PKR)
              </label>
              <input
                type="number"
                className="input"
                value={form.advancePayment}
                onChange={(e) => set("advancePayment", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isRush}
                  onChange={(e) => set("isRush", e.target.checked)}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm font-medium text-gray-700">
                  Rush Order
                </span>
              </label>
            </div>
          </div>
          {form.isRush && (
            <input
              type="number"
              className="input"
              value={form.rushSurcharge}
              onChange={(e) => set("rushSurcharge", e.target.value)}
              placeholder="Rush surcharge (PKR)"
            />
          )}

          {/* Live total preview */}
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-500">
              <span>
                Items Subtotal ({items.length}{" "}
                {items.length === 1 ? "line" : "lines"})
              </span>
              <span>PKR {itemsSubtotal.toLocaleString()}</span>
            </div>
            {rushAmount > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Rush Surcharge</span>
                <span>PKR {rushAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-800 border-t border-gray-200 pt-1">
              <span>Estimated Total</span>
              <span>PKR {estimatedTotal.toLocaleString()}</span>
            </div>
          </div>

          <hr className="border-gray-100" />
          <h3 className="font-semibold text-gray-700">
            Staff Assignment (optional)
          </h3>
          <p className="text-xs text-gray-400 -mt-2">
            Leave all three blank to save this order as a draft — you can assign
            staff later from the order page.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STAFF_ROLES.map(([field, , label]) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {label}
                </label>
                <select
                  className="input"
                  value={assignment[field]}
                  onChange={(e) =>
                    setAssignment((a) => ({ ...a, [field]: e.target.value }))
                  }
                >
                  <option value="">Unassigned</option>
                  {(staffByRole[field] || []).map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                      {!s.hasLogin ? " (no login)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? "Creating…" : "Create Order"}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
