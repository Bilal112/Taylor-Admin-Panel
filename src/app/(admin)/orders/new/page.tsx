"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import { useDialog } from "@/context/DialogContext";
import { normalizePkMobile, PHONE_ERROR } from "@/lib/phone";
import { hasFeature } from "@/lib/features";
import type { GarmentType, FabricSource, PaymentMethod } from "@/types/order";
import type { Customer, Measurement } from "@/types/customer";
import type { User } from "@/types/user";

const GARMENT_TYPES: GarmentType[] = [
  "Simple Suit",
  "4 Part & Fancy Button",
  "Designing Suit",
  "Selling Suit with Press",
  "Embroidery Suit",
];

const MEASUREMENT_FIELDS: [keyof Measurement, string][] = [
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

type StaffField = "cuttingMaster" | "stitcher" | "presser";

const STAFF_ROLES: [StaffField, string, string][] = [
  ["cuttingMaster", "cutting_master", "Cutting Master"],
  ["stitcher", "stitcher", "Stitcher"],
  ["presser", "presser", "Press Man"],
];

interface ItemForm {
  garmentType: GarmentType | "";
  quantity: string;
  basePrice: string;
  fabric: string;
  fabricSource: FabricSource;
  fabricAmount: string;
}

const emptyItem = (): ItemForm => ({
  garmentType: "",
  quantity: "1",
  basePrice: "",
  fabric: "",
  fabricSource: "customer_provided",
  fabricAmount: "0",
});

const itemLineTotal = (it: ItemForm) =>
  (Number(it.basePrice) || 0) * (Number(it.quantity) || 1) +
  (Number(it.fabricAmount) || 0);

interface OrderForm {
  suitNo: string;
  styleNotes: string;
  promisedDate: string;
  isRush: boolean;
  rushSurcharge: string;
  notes: string;
  advancePayment: string;
  paymentMethod: PaymentMethod;
}

export default function NewOrderPage() {
  const router = useRouter();
  const { user } = useAuth();
  const dialog = useDialog();
  const [loading, setLoading] = useState(false);

  // Branch settings (set on the Settings page): whether item prices are
  // required here, and whether the server auto-assigns a cutting master when
  // none is picked. Defaults match the backend's for branches without a
  // settings object; super_admin (no branch of their own) just gets defaults.
  const [branchSettings, setBranchSettings] = useState({
    requireOrderPrice: true,
    autoAssignOrders: false,
  });
  // Branch price list (priceList feature) — garmentType -> default PKR price.
  const [garmentPrices, setGarmentPrices] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!user || user.role !== "admin") return;
    api
      .get("/branches")
      .then(({ data }) => {
        const own = data.data[0]; // an admin's list is exactly their own branch
        if (own) {
          setBranchSettings({
            requireOrderPrice: own.settings?.requireOrderPrice !== false,
            autoAssignOrders: own.settings?.autoAssignOrders === true,
          });
          if (own.features?.priceList !== false) {
            setGarmentPrices(own.settings?.garmentPrices || {});
          }
        }
      })
      .catch(() => {}); // fall back to defaults silently
  }, [user]);
  const [staffByRole, setStaffByRole] = useState<Partial<Record<StaffField, User[]>>>({});
  const [assignment, setAssignment] = useState<Record<StaffField, string>>({
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
        const map: Partial<Record<StaffField, User[]>> = {};
        STAFF_ROLES.forEach(([field], i) => {
          map[field] = results[i].data.data.filter((s: User) => s.isActive);
        });
        setStaffByRole(map);
      })
      .catch((err) => toast.error(errorMessage(err, "Failed to load staff list")));
  }, []);

  // Phone lookup state
  const [phone, setPhone] = useState("");
  const [looking, setLooking] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null); // found customer
  const [customerStatus, setCustomerStatus] = useState<"found" | "new" | "">(""); // 'found' | 'new' | ''
  const [newCustomerName, setNewCustomerName] = useState("");
  const [measurements, setMeasurements] = useState<Measurement>({});
  const [showHistory, setShowHistory] = useState(false);

  // Suit No is a standing customer attribute now (persists across visits),
  // not a fresh order-level field — see backend Customer.suitNo. For a FOUND
  // customer with a number already on file, the field starts locked so it
  // can't be changed by accident; editing requires an explicit confirm.
  // `originalSuitNo` is what's on the customer record right now — comparing
  // form.suitNo against it at submit time is how we know whether to sync.
  const [originalSuitNo, setOriginalSuitNo] = useState("");
  const [suitNoLocked, setSuitNoLocked] = useState(false);
  const requestEditSuitNo = async () => {
    const message = originalSuitNo
      ? `"${originalSuitNo}" is ${customer?.name || "this customer"}'s current number — changing it updates their record (the old number is kept as a backup).`
      : "Are you sure you want to edit the Suit No?";
    const ok = await dialog.confirm({
      title: "Edit Suit No",
      message,
      confirmText: "Edit",
    });
    if (ok) setSuitNoLocked(false);
  };

  // One order can have several items — e.g. 1 Simple Suit + 2 Designing Suits
  // for the same customer visit. Suit No is a single serial for the whole
  // order (the shop's own tag for this customer/visit), not per item.
  const [items, setItems] = useState<ItemForm[]>([emptyItem()]);

  const [form, setForm] = useState<OrderForm>({
    suitNo: "",
    styleNotes: "",
    promisedDate: "",
    isRush: false,
    rushSurcharge: "0",
    notes: "",
    advancePayment: "",
    paymentMethod: "cash",
  });

  const set = <K extends keyof OrderForm>(k: K, v: OrderForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const setM = (k: keyof Measurement, v: number) =>
    setMeasurements((m) => ({ ...m, [k]: v }));

  const setItem = <K extends keyof ItemForm>(idx: number, k: K, v: ItemForm[K]) =>
    setItems((list) =>
      list.map((it, i) => (i === idx ? { ...it, [k]: v } : it)),
    );
  // Selecting a garment type syncs the price to ITS default from the branch
  // price list (priceList feature). Always syncs on every change — not just
  // when the field was empty — so switching from one type to another
  // updates the price too, instead of leaving the previous type's price
  // behind. Falls back to blank when the newly picked type has no default
  // (or the type is cleared back to "Select item…"), since a stale price
  // from a different garment is worse than an empty field asking to be filled.
  const pickGarment = (idx: number, g: ItemForm["garmentType"]) =>
    setItems((list) =>
      list.map((it, i) => {
        if (i !== idx) return it;
        const def = g ? garmentPrices[g] : undefined;
        return {
          ...it,
          garmentType: g,
          basePrice: def !== undefined ? String(def) : "",
        };
      }),
    );

  const addItem = () => setItems((list) => [...list, emptyItem()]);
  const removeItem = (idx: number) =>
    setItems((list) =>
      list.length > 1 ? list.filter((_, i) => i !== idx) : list,
    );

  // Promised date can't be backdated — earliest allowed is today (current server date's local day).
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local timezone

  // ----- Phone lookup -----
  const lookupPhone = async (phoneOverride?: string) => {
    // Guard the override type: this is also used directly as an onClick
    // handler, where the click event must not be mistaken for a phone.
    const target = typeof phoneOverride === "string" ? phoneOverride : phone;
    const normalized = normalizePkMobile(target);
    if (!normalized) {
      toast.error(PHONE_ERROR);
      return;
    }
    setPhone(normalized); // reflect the canonical form in the input
    setLooking(true);
    setCustomer(null);
    setCustomerStatus("");
    try {
      const { data } = await api.get("/customers/lookup", {
        params: { phone: normalized },
      });
      if (data.found) {
        setCustomer(data.data);
        setMeasurements(data.data.measurements || {});
        setCustomerStatus("found");
        // Pre-fill from the customer's standing suit no; lock it only when
        // there's an actual number to protect from accidental edits.
        const existingSuitNo = data.data.suitNo || "";
        setOriginalSuitNo(existingSuitNo);
        setSuitNoLocked(!!existingSuitNo);
        set("suitNo", existingSuitNo);
        toast.success(`Customer found: ${data.data.name}`);
      } else {
        setCustomerStatus("new");
        setMeasurements({});
        setOriginalSuitNo("");
        setSuitNoLocked(false);
        toast("New customer — fill in name & measurements", { icon: "👤" });
      }
    } catch {
      toast.error("Lookup failed");
    } finally {
      setLooking(false);
    }
  };

  // Deep links: /orders/new?phone=03XX… auto-runs the lookup (used by the
  // appointments "Start Order" button), and ?repeat=<orderId> copies a past
  // order's items (repeatOrder feature). window.location.search instead of
  // useSearchParams keeps this page statically renderable.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qPhone = params.get("phone");
    if (qPhone) {
      const normalized = normalizePkMobile(qPhone);
      if (normalized) {
        setPhone(normalized);
        lookupPhone(normalized);
      }
    }
    const repeatId = params.get("repeat");
    if (repeatId && user && hasFeature(user, "repeatOrder")) {
      api
        .get(`/orders/${repeatId}`)
        .then(({ data }) => {
          const o = data.data;
          // Only finished orders may be repeated — same rule as the button.
          if (!["ready", "delivered"].includes(o.status)) {
            toast.error("Only ready or delivered orders can be repeated");
            return;
          }
          if (Array.isArray(o.items) && o.items.length) {
            setItems(
              o.items.map((it: any) => ({
                garmentType: it.garmentType || "",
                quantity: String(it.quantity || 1),
                basePrice: String(it.basePrice || 0),
                fabric: it.fabric || "",
                fabricSource: it.fabricSource || "customer_provided",
                fabricAmount: String(it.fabricAmount || 0),
              })),
            );
          }
          if (o.styleNotes) set("styleNotes", o.styleNotes);
          const custPhone =
            typeof o.customer === "object" && o.customer && "phone" in o.customer
              ? String(o.customer.phone || "")
              : "";
          if (!qPhone && custPhone) {
            const n = normalizePkMobile(custPhone);
            if (n) {
              setPhone(n);
              lookupPhone(n);
            } else {
              setPhone(custPhone); // legacy format — admin can adjust
            }
          }
          toast.success("Items copied from the previous order");
        })
        .catch(() => toast.error("Could not load the previous order"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Submit -----
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
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
    if (
      branchSettings.requireOrderPrice &&
      items.some((it) => !(Number(it.basePrice) > 0))
    ) {
      toast.error("Enter a price for every item");
      return;
    }
    // Belt-and-suspenders: the inputs carry min="0"/max={estimatedTotal},
    // but this form calls preventDefault() and never checks native HTML5
    // validity, so those attributes are visual only — the real gate is here
    // (and again on the server, which is the true source of truth).
    if (items.some((it) => Number(it.basePrice) < 0 || Number(it.fabricAmount) < 0)) {
      toast.error("Prices cannot be negative");
      return;
    }
    if (Number(form.rushSurcharge) < 0) {
      toast.error("Rush surcharge cannot be negative");
      return;
    }
    if (Number(form.advancePayment) < 0) {
      toast.error("Advance payment cannot be negative");
      return;
    }
    if (Number(form.advancePayment) > estimatedTotal) {
      toast.error(
        `Advance payment cannot exceed the order total (PKR ${estimatedTotal.toLocaleString()})`,
      );
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
          phone: normalizePkMobile(phone) || phone.trim(),
          // First-time assignment — nothing to back up yet, so this goes
          // straight into the create call rather than the suit-no endpoint.
          suitNo: form.suitNo.trim() || undefined,
        });
        customerId = data.data._id;
        setCustomer(data.data);
      } else if (customerId && form.suitNo.trim() !== originalSuitNo) {
        // Existing customer whose suit no was actually changed (confirmed
        // via the edit button) — sync it back, which backs up the old value.
        await api.put(`/customers/${customerId}/suit-no`, {
          suitNo: form.suitNo.trim(),
        });
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
        measurements: hasMeasurement ? measurements : undefined,
        // Advance goes as explicit fields — the server records the payment
        // itself (date + who recorded it) and recalculates the balance.
        advancePayment: Number(form.advancePayment) || 0,
        paymentMethod: form.paymentMethod,
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
      toast.error(errorMessage(err, "Failed to create order"));
    } finally {
      setLoading(false);
    }
  };

  const itemsSubtotal = items.reduce((sum, it) => sum + itemLineTotal(it), 0);
  const rushAmount = form.isRush ? Number(form.rushSurcharge) || 0 : 0;
  const estimatedTotal = itemsSubtotal + rushAmount;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">New Order</h1>

      {/* ── Step 1: Phone lookup ── */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">Step 1 — Customer</h2>
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
            onClick={() => lookupPhone()}
            disabled={looking || !phone}
            className="btn-primary text-sm px-4"
          >
            {looking ? "Looking…" : "Lookup"}
          </button>
        </div>

        {/* Found customer */}
        {customerStatus === "found" && customer && (
          <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-800 dark:text-green-300">
                  ✅ {customer.name}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">{customer.phone}</p>
                {customer.suitNo && (
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Suit No: <span className="font-semibold">{customer.suitNo}</span>
                  </p>
                )}
              </div>
              <button
                onClick={() => setCustomerStatus("")}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Change
              </button>
            </div>

            {/* Current measurements */}
            {customer.measurements &&
              Object.keys(customer.measurements).length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
                    📏 Saved Measurements (inches) — update if changed:
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {MEASUREMENT_FIELDS.map(([k, l]) => (
                      <div key={k}>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                          {l}
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          className="input text-xs text-center py-1"
                          value={(measurements[k] as number) || ""}
                          onChange={(e) => setM(k, Number(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Measurement history */}
            {!!customer.measurementHistory?.length && (
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
                        className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded p-2 text-xs text-gray-600 dark:text-gray-400"
                      >
                        <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
                          {h.takenAt
                            ? new Date(h.takenAt).toLocaleDateString()
                            : "Unknown date"}
                          {typeof h.takenBy === "object" && h.takenBy?.name && ` — by ${h.takenBy.name}`}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {MEASUREMENT_FIELDS.map(([k, l]) =>
                            h[k] ? (
                              <span key={k}>
                                {l}: <b>{String(h[k])}"</b>
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
          <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg p-4 space-y-3">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
              👤 New customer — will be created
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Customer Name *
              </label>
              <input
                className="input"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Measurements (inches) — optional but recommended:
            </p>
            <div className="grid grid-cols-5 gap-2">
              {MEASUREMENT_FIELDS.map(([k, l]) => (
                <div key={k}>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {l}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    className="input text-xs text-center py-1"
                    value={(measurements[k] as number) || ""}
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
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">
            Step 2 — Order Details
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Suit No
              </label>
              <div className="flex gap-2">
                <input
                  className="input disabled:opacity-60 disabled:cursor-not-allowed"
                  value={form.suitNo}
                  onChange={(e) => set("suitNo", e.target.value)}
                  placeholder="Customer's suit/locker number"
                  disabled={suitNoLocked}
                />
                {suitNoLocked && (
                  <button
                    type="button"
                    onClick={requestEditSuitNo}
                    className="btn-secondary text-sm px-3 shrink-0"
                    title="Change this customer's suit no"
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {suitNoLocked
                  ? "Auto-filled from the customer's record — click Edit to change it."
                  : originalSuitNo
                    ? `Editing — was "${originalSuitNo}". The old number is kept as a backup.`
                    : "Saved to the customer's record for next time."}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
          <hr className="border-gray-100 dark:border-gray-800" />
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-700 dark:text-gray-300">Items</h3>
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
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
                    Item {idx + 1}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="text-xs text-red-500 dark:text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Item Type *
                    </label>
                    <select
                      required
                      className="input text-sm"
                      value={it.garmentType}
                      onChange={(e) =>
                        pickGarment(idx, e.target.value as GarmentType)
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
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
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
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Price per Unit (PKR){branchSettings.requireOrderPrice && " *"}
                    </label>
                    <input
                      required={branchSettings.requireOrderPrice}
                      type="number"
                      min="0"
                      className="input text-sm"
                      value={it.basePrice}
                      onChange={(e) =>
                        setItem(idx, "basePrice", e.target.value)
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
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
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Fabric Source
                    </label>
                    <select
                      className="input text-sm"
                      value={it.fabricSource}
                      onChange={(e) =>
                        setItem(idx, "fabricSource", e.target.value as FabricSource)
                      }
                    >
                      <option value="customer_provided">
                        Customer Provided
                      </option>
                      <option value="shop_supplied">Shop Supplied</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Fabric Amount (PKR)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="input text-sm"
                      value={it.fabricAmount}
                      onChange={(e) =>
                        setItem(idx, "fabricAmount", e.target.value)
                      }
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                  Line total:{" "}
                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                    PKR {itemLineTotal(it).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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

          <hr className="border-gray-100 dark:border-gray-800" />
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">Billing</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Advance Payment (PKR)
              </label>
              <input
                type="number"
                min="0"
                max={estimatedTotal}
                className="input"
                value={form.advancePayment}
                onChange={(e) => set("advancePayment", e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Cannot exceed the order total (PKR {estimatedTotal.toLocaleString()}).
              </p>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isRush}
                  onChange={(e) => set("isRush", e.target.checked)}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Rush Order
                </span>
              </label>
            </div>
          </div>
          {form.isRush && (
            <input
              type="number"
              min="0"
              className="input"
              value={form.rushSurcharge}
              onChange={(e) => set("rushSurcharge", e.target.value)}
              placeholder="Rush surcharge (PKR)"
            />
          )}

          {/* Live total preview */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-gray-500 dark:text-gray-400">
              <span>
                Items Subtotal ({items.length}{" "}
                {items.length === 1 ? "line" : "lines"})
              </span>
              <span>PKR {itemsSubtotal.toLocaleString()}</span>
            </div>
            {rushAmount > 0 && (
              <div className="flex justify-between text-gray-500 dark:text-gray-400">
                <span>Rush Surcharge</span>
                <span>PKR {rushAmount.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-800 dark:text-gray-200 border-t border-gray-200 dark:border-gray-700 pt-1">
              <span>Estimated Total</span>
              <span>PKR {estimatedTotal.toLocaleString()}</span>
            </div>
          </div>

          <hr className="border-gray-100 dark:border-gray-800" />
          <h3 className="font-semibold text-gray-700 dark:text-gray-300">
            Staff Assignment (optional)
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
            {branchSettings.autoAssignOrders
              ? "Auto-assign is on — any role left blank is filled automatically (least busy first) so the order starts right away."
              : "The order starts right away only when all three roles are picked — otherwise it's saved as a draft and activated from the order page."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STAFF_ROLES.map(([field, , label]) => (
              <div key={field}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
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
