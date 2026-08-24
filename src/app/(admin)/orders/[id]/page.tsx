"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";
import type { AxiosError } from "axios";
import { errorMessage } from "@/lib/errorMessage";
import { isValidObjectId } from "@/lib/validate";
import type { Order, OrderStatus, PaymentMethod } from "@/types/order";
import type { Measurement } from "@/types/customer";
import type { User, UserRole } from "@/types/user";

// 'draft' isn't part of the visual progress bar — it's a pre-flow state where
// admin hasn't finished assigning staff yet. '*_review' stages are where the
// Checker approves/rejects a finished stage before it moves on.
const STATUS_FLOW: OrderStatus[] = [
  "received",
  "cutting",
  "cutting_review",
  "stitching",
  "stitching_review",
  "pressing",
  "pressing_review",
  "quality_check",
  "ready",
  "delivered",
];

const STATUS_COLORS: Partial<Record<OrderStatus, string>> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  received: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  cutting: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  cutting_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  stitching: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  stitching_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  pressing: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  pressing_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  quality_check: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  ready: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  delivered: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  rework: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  cancelled: "bg-gray-200 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  cutting_review: "Awaiting Checker (Cutting)",
  stitching_review: "Awaiting Checker (Stitching)",
  pressing_review: "Awaiting Checker (Pressing)",
};

type StaffField = "cuttingMaster" | "stitcher" | "presser";

const STAFF_ROLES: [StaffField, string, string][] = [
  ["cuttingMaster", "cutting_master", "✂️ Cutting Master"],
  ["stitcher", "stitcher", "🧵 Stitcher"],
  ["presser", "presser", "🔥 Press Man"],
];

// Staff submit their finished work for review — Checker then approves/rejects
// via the separate /review endpoint, not this table.
const ROLE_TRANSITIONS: Partial<Record<UserRole, Partial<Record<OrderStatus, OrderStatus>>>> = {
  cutting_master: { received: "cutting", cutting: "cutting_review" },
  stitcher: { stitching: "stitching_review" },
  presser: { pressing: "pressing_review" },
  stock_manager: { quality_check: "ready", ready: "delivered" },
  // Checker can also push received/cutting/stitching/pressing forward
  // themselves (override power), same moves as the working staff make.
  // Approving/rejecting a *_review status is handled by the Review card below.
  checker: {
    received: "cutting",
    cutting: "cutting_review",
    stitching: "stitching_review",
    pressing: "pressing_review",
  },
};

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

const PAYMENT_METHODS: PaymentMethod[] = ["cash", "card", "bank_transfer", "mobile_money"];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payment, setPayment] = useState<{ amount: string; method: PaymentMethod }>({ amount: "", method: "cash" });
  const [paying, setPaying] = useState(false);
  // Marking Ready requires a rack number entered right there — separate from
  // the "Save Rack" button on the Rack card below, which is just a plain save.
  const [readyRackNum, setReadyRackNum] = useState("");
  const [markingReady, setMarkingReady] = useState(false);

  // Draft-only staff assignment
  const [staffByRole, setStaffByRole] = useState<Partial<Record<StaffField, User[]>>>({});
  const [assignment, setAssignment] = useState<Record<StaffField, string>>({
    cuttingMaster: "",
    stitcher: "",
    presser: "",
  });
  const [assigning, setAssigning] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);

  const fetchOrder = ({ silent = false }: { silent?: boolean } = {}) => {
    if (!isValidObjectId(id)) {
      setLoading(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);
    api
      .get(`/orders/${id}`)
      .then((r) => {
        setOrder(r.data.data);
        if (silent) toast.success("Order refreshed");
      })
      .catch((err) => toast.error(errorMessage(err, "Failed to load")))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Pre-fill the Ready rack-number field from any rack number already saved,
  // as a convenience — it still has to be submitted with the Ready action.
  useEffect(() => {
    if (order?.rackNumber) setReadyRackNum(order.rackNumber);
  }, [order?.rackNumber]);

  // Load assignable staff once we know this order is a draft
  useEffect(() => {
    if (order?.status !== "draft") return;
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
  }, [order?.status]);

  const saveAssignment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAssigning(true);
    try {
      const { data } = await api.put(`/orders/${id}/assign`, {
        cuttingMaster: assignment.cuttingMaster || null,
        stitcher: assignment.stitcher || null,
        presser: assignment.presser || null,
      });
      setOrder(data.data);
      toast.success(
        data.data.status === "draft"
          ? "Assignment saved"
          : "Staff assigned — order is now active",
      );
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(axiosErr.response?.data?.message || "Failed to assign");
    } finally {
      setAssigning(false);
    }
  };

  const autoAssign = async () => {
    setAutoAssigning(true);
    try {
      const { data } = await api.put(`/orders/${id}/assign`, { auto: true });
      setOrder(data.data);
      setAssignment({
        cuttingMaster: data.data.cuttingMaster?._id || "",
        stitcher: data.data.stitcher?._id || "",
        presser: data.data.presser?._id || "",
      });
      if (data.data.status === "draft") {
        toast(
          "Auto Assign only picks staff with login access — no eligible cutting master found, still in draft",
          { icon: "⚠️" },
        );
      } else {
        toast.success("Auto assigned — order is now active");
      }
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(axiosErr.response?.data?.message || "Auto assign failed");
    } finally {
      setAutoAssigning(false);
    }
  };

  // Checker approve/reject
  const [remark, setRemark] = useState("");
  const [reviewing, setReviewing] = useState(false);

  const submitReview = async (decision: "approve" | "reject") => {
    setReviewing(true);
    try {
      const { data } = await api.put(`/orders/${id}/review`, {
        decision,
        remark: remark.trim() || undefined,
      });
      setOrder(data.data);
      setRemark("");
      toast.success(
        decision === "approve"
          ? "Approved — moved to next stage"
          : "Sent back with your remark",
      );
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(axiosErr.response?.data?.message || "Failed to submit review");
    } finally {
      setReviewing(false);
    }
  };

  const advanceStatus = async (nextStatus: OrderStatus, extra: Record<string, unknown> = {}) => {
    try {
      await api.put(`/orders/${id}/status`, { status: nextStatus, ...extra });
      toast.success(`Status → ${nextStatus.replace(/_/g, " ")}`);
      fetchOrder();
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(axiosErr.response?.data?.message || "Failed");
    }
  };

  const markReady = async () => {
    if (!readyRackNum.trim()) {
      toast.error("Enter a rack number first");
      return;
    }
    setMarkingReady(true);
    try {
      await api.put(`/orders/${id}/status`, {
        status: "ready",
        rackNumber: readyRackNum.trim(),
      });
      toast.success("Marked as Ready");
      setReadyRackNum("");
      fetchOrder();
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      toast.error(axiosErr.response?.data?.message || "Failed to mark as ready");
    } finally {
      setMarkingReady(false);
    }
  };

  const addPayment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPaying(true);
    try {
      await api.put(`/orders/${id}/payment`, {
        amount: Number(payment.amount),
        method: payment.method,
      });
      toast.success("Payment recorded");
      setPayment({ amount: "", method: "cash" });
      fetchOrder();
    } catch {
      toast.error("Failed");
    } finally {
      setPaying(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  if (!order)
    return (
      <div className="text-center text-gray-400 dark:text-gray-500 py-20">
        Order not found or not assigned to you
      </div>
    );

  const role = user?.role;
  const isAdmin = !!role && ["super_admin", "admin"].includes(role);
  const isChecker = role === "checker";
  const isReviewStage = order.status?.endsWith("_review");

  // What each role can see
  const canSeeCustomerInfo = isAdmin; // name, phone — admin only
  const canSeeMeasurements =
    isAdmin || isChecker || !role || role !== "stock_manager"; // cutting/stitching/presser + admin/checker need it
  const canSeePricing = isAdmin;
  const canSeeStaffAssignment = isAdmin || isChecker;
  const canAddPayment = isAdmin;

  const currentIdx = STATUS_FLOW.indexOf(order.status);

  // Status advance button — draft orders leave draft only via the assignment
  // card above (assigning a cutting master). Review stages are handled by the
  // Checker's approve/reject card below, never by this generic advance button
  // (even for admin, so the checker's remark flow stays the single path).
  const getNextStatus = (): OrderStatus | null => {
    if (order.status === "draft" || isReviewStage) return null;
    if (isAdmin) return STATUS_FLOW[currentIdx + 1] || null;
    return (role && ROLE_TRANSITIONS[role]?.[order.status]) || null;
  };
  const nextStatus = getNextStatus();

  // Measurements — from order snapshot, fallback to customer's saved measurements
  const orderCustomer = typeof order.customer === "object" ? order.customer : null;
  const customerMeasurements =
    orderCustomer && "measurements" in orderCustomer
      ? (orderCustomer as { measurements?: Measurement }).measurements
      : undefined;
  const measurements: Measurement | undefined =
    (order.measurements as Measurement | undefined) || customerMeasurements;
  const hasMeasurements =
    !!measurements && MEASUREMENT_FIELDS.some(([k]) => measurements[k]);

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 font-mono break-all">
            {order.orderNumber}
          </h1>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span
              className={`badge ${STATUS_COLORS[order.status] || "bg-gray-100 dark:bg-gray-800"}`}
            >
              {STATUS_LABELS[order.status] || order.status?.replace(/_/g, " ")}
            </span>
            {order.isRush && (
              <span className="badge bg-red-500 dark:bg-red-600 text-white">RUSH</span>
            )}
            {order.isPickedUp && (
              <span className="badge bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                Picked Up ✓
              </span>
            )}
            {order.rackNumber && (
              <span className="badge bg-blue-600 dark:bg-blue-700 text-white text-base font-bold px-3 py-1">
                📦 Rack {order.rackNumber}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchOrder({ silent: true })}
            disabled={refreshing}
            className="btn-secondary text-sm"
            title="Refresh order"
          >
            {refreshing ? "⏳ Refreshing…" : "🔄 Refresh"}
          </button>
          {nextStatus === "ready" ? (
            <div className="flex items-center gap-2">
              <input
                className="input text-sm w-32"
                placeholder="Rack #"
                value={readyRackNum}
                onChange={(e) => setReadyRackNum(e.target.value)}
              />
              <button
                onClick={markReady}
                disabled={markingReady}
                className="btn-primary text-sm whitespace-nowrap"
              >
                {markingReady ? "Saving…" : "Mark as Ready →"}
              </button>
            </div>
          ) : (
            nextStatus && (
              <button
                onClick={() => advanceStatus(nextStatus)}
                className="btn-primary text-sm"
              >
                Mark as {nextStatus.replace(/_/g, " ")} →
              </button>
            )
          )}
        </div>
      </div>
      {nextStatus === "ready" && (
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-4">
          A rack number is required to mark this order as Ready.
        </p>
      )}

      {/* Progress bar — not shown for drafts, they haven't entered the flow yet */}
      {order.status !== "draft" && (
        <div className="card p-4">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STATUS_FLOW.map((s, i) => (
              <div
                key={s}
                className="flex flex-col items-center gap-1 shrink-0"
              >
                <div
                  className={`h-2 w-10 rounded-full transition-colors ${i <= currentIdx ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"}`}
                />
                <span
                  className="hidden lg:block text-gray-400 dark:text-gray-500 text-center capitalize"
                  style={{ fontSize: "10px" }}
                >
                  {s.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Draft: assign staff to activate the order — admin only ── */}
      {isAdmin && order.status === "draft" && (
        <div className="card space-y-4 border-2 border-dashed border-primary/30">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-700 dark:text-gray-300">
              📝 Assign Staff to Activate
            </h2>
            <button
              type="button"
              onClick={autoAssign}
              disabled={autoAssigning}
              className="btn-secondary text-xs"
            >
              {autoAssigning ? "Assigning…" : "⚡ Auto Assign"}
            </button>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 -mt-2">
            This order is a draft and won't show up for staff until a Cutting
            Master is assigned. Auto Assign only picks staff with login access.
          </p>
          <form
            onSubmit={saveAssignment}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
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
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={assigning}
                className="btn-primary text-sm"
              >
                {assigning ? "Saving…" : "Save Assignment"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Checker sent this back with a remark — visible to everyone once set ── */}
      {order.checkerRemark && !isReviewStage && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-4 text-sm">
          <p className="font-semibold text-red-800 dark:text-red-300 mb-1">
            🔁 Sent back by Checker for rework
          </p>
          <p className="text-red-700 dark:text-red-400 italic">{order.checkerRemark}</p>
        </div>
      )}

      {/* ── Checker: approve or reject a stage submitted for review ── */}
      {(isChecker || isAdmin) && isReviewStage && (
        <div className="card space-y-3 border-2 border-dashed border-amber-300 dark:border-amber-700">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">🔍 Review Required</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {STATUS_LABELS[order.status]} — inspect the work for this stage,
            then approve to pass it on or reject to send it back for rework.
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Remark (optional)
            </label>
            <textarea
              className="input text-sm"
              rows={2}
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="e.g. Sleeve length is off by half an inch — please redo"
            />
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={reviewing}
              onClick={() => submitReview("approve")}
              className="btn-primary text-sm"
            >
              ✅ Approve — Pass to Next Stage
            </button>
            <button
              type="button"
              disabled={reviewing}
              onClick={() => submitReview("reject")}
              className="btn-secondary text-sm text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              ↩️ Reject — Send Back
            </button>
          </div>
        </div>
      )}

      {/* ── Customer info — admin only ── */}
      {canSeeCustomerInfo && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">Customer</h2>
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">{orderCustomer?.name}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              {orderCustomer && "phone" in orderCustomer ? String(orderCustomer.phone ?? "") : ""}
            </p>
            {orderCustomer && "address" in orderCustomer && (orderCustomer as { address?: string }).address && (
              <p className="text-sm text-gray-400 dark:text-gray-500">{(orderCustomer as { address?: string }).address}</p>
            )}
          </div>
        </div>
      )}

      {/* ── Order details — everyone sees this ── */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">Order Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p>
            <span className="text-gray-400 dark:text-gray-500">Suit No:</span>{" "}
            {order.suitNo || "—"}
          </p>
          <p>
            <span className="text-gray-400 dark:text-gray-500">Promised:</span>{" "}
            <span
              className={
                order.promisedDate &&
                new Date(order.promisedDate) < new Date() &&
                order.status !== "delivered"
                  ? "text-red-600 dark:text-red-400 font-semibold"
                  : "font-medium"
              }
            >
              {order.promisedDate
                ? format(new Date(order.promisedDate), "dd MMM yyyy")
                : "—"}
            </span>
          </p>
        </div>
        {order.styleNotes && (
          <div className="bg-yellow-50 dark:bg-yellow-950/40 border border-yellow-100 dark:border-yellow-900 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300 italic">
            📝 {order.styleNotes}
          </div>
        )}
      </div>

      {/* ── Items — one order can have multiple item lines ── */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300">Items</h2>
        <div className="space-y-2">
          {(order.items || []).map((it, i) => (
            <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {it.garmentType}
                </span>
                <span className="text-gray-500 dark:text-gray-400">Qty: {it.quantity || 1}</span>
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Fabric: {it.fabric || "—"} · Source:{" "}
                {it.fabricSource?.replace(/_/g, " ") || "—"}
                {it.fabricAmount > 0 &&
                  ` · Fabric Amount: PKR ${it.fabricAmount.toLocaleString()}`}
              </div>
              {canSeePricing && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  PKR {it.basePrice?.toLocaleString()} × {it.quantity || 1} ={" "}
                  <span className="font-medium">
                    PKR{" "}
                    {(
                      (it.basePrice || 0) * (it.quantity || 1)
                    ).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Measurements — shown to cutting master, stitcher, presser, admin ── */}
      {canSeeMeasurements && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">
            📏 Customer Measurements (inches)
          </h2>
          {hasMeasurements && measurements ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {MEASUREMENT_FIELDS.map(([k, label]) =>
                measurements[k] ? (
                  <div
                    key={k}
                    className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center"
                  >
                    <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                    <p className="font-bold text-gray-800 dark:text-gray-200">
                      {String(measurements[k])}"
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              No measurements recorded for this customer.
            </p>
          )}
          {measurements?.notes && (
            <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded p-2">
              📝 {measurements.notes}
            </p>
          )}
        </div>
      )}

      {/* ── Billing — admin only ── */}
      {canSeePricing && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300">Billing</h2>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500">Items Subtotal</span>
              <span>
                PKR{" "}
                {(
                  order.items?.reduce(
                    (s, it) =>
                      s +
                      (it.basePrice || 0) * (it.quantity || 1) +
                      (it.fabricAmount || 0),
                    0,
                  ) || 0
                ).toLocaleString()}
              </span>
            </div>
            {!!order.rushSurcharge && order.rushSurcharge > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-gray-500">Rush Surcharge</span>
                <span className="text-red-500 dark:text-red-400">
                  +PKR {order.rushSurcharge?.toLocaleString()}
                </span>
              </div>
            )}
            {!!order.discountAmount && order.discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-gray-500">Discount</span>
                <span className="text-green-600 dark:text-green-400">
                  -PKR {order.discountAmount?.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-gray-100 dark:border-gray-800 pt-1">
              <span>Total</span>
              <span>PKR {order.totalPrice?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500">Paid</span>
              <span className="text-green-600 dark:text-green-400">
                PKR {order.amountPaid?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Balance Due</span>
              <span
                className={
                  order.balanceDue > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                }
              >
                PKR {order.balanceDue?.toLocaleString()}
              </span>
            </div>
          </div>
          {order.payments?.length > 0 && (
            <div className="text-xs space-y-1 bg-gray-50 dark:bg-gray-800 rounded p-2">
              {order.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-gray-500 dark:text-gray-400">
                  <span>{p.method?.replace(/_/g, " ")}</span>
                  <span>PKR {p.amount?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
          {canAddPayment && order.balanceDue > 0 && (
            <form onSubmit={addPayment} className="flex gap-2 flex-wrap">
              <input
                type="number"
                required
                className="input flex-1 min-w-[120px] text-sm"
                placeholder="Amount"
                value={payment.amount}
                onChange={(e) =>
                  setPayment({ ...payment, amount: e.target.value })
                }
              />
              <select
                className="input w-full sm:w-32 text-sm"
                value={payment.method}
                onChange={(e) =>
                  setPayment({ ...payment, method: e.target.value as PaymentMethod })
                }
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={paying}
                className="btn-primary text-sm px-3"
              >
                Pay
              </button>
            </form>
          )}
        </div>
      )}

      {/* ── Staff Assignment — admin only ── */}
      {canSeeStaffAssignment && (
        <div className="card">
          <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Staff Assignment</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {(
              [
                ["✂️ Cutting Master", order.cuttingMaster],
                ["🧵 Stitcher", order.stitcher],
                ["🔥 Press Man", order.presser],
                ["📦 Stock Manager", order.stockManager],
              ] as [string, Order["cuttingMaster"]][]
            ).map(([r, s]) => (
              <div key={r} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{r}</p>
                <p className="font-medium">
                  {(typeof s === "object" && s?.name) || (
                    <span className="text-gray-300 dark:text-gray-600 text-xs">Unassigned</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Status History — everyone sees ── */}
      <div className="card">
        <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Status History</h2>
        <div className="space-y-2">
          {order.statusHistory?.map((h, i) => (
            <div
              key={i}
              className="flex flex-wrap gap-x-3 gap-y-1 text-sm items-start"
            >
              <span className="text-gray-400 dark:text-gray-500 text-xs w-28 sm:w-32 shrink-0 mt-0.5">
                {h.changedAt
                  ? format(new Date(h.changedAt), "dd MMM HH:mm")
                  : ""}
              </span>
              <span className="font-medium capitalize">
                {h.status?.replace(/_/g, " ")}
              </span>
              {/* Only show who changed it to admin */}
              {isAdmin && (
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  {(typeof h.changedBy === "object" && h.changedBy?.name) || ""}
                </span>
              )}
              {h.note && (
                <span className="text-gray-400 dark:text-gray-500 italic text-xs">{h.note}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
