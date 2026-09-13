"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import toast from "react-hot-toast";
import clsx from "clsx";
import type { AxiosError } from "axios";
import { errorMessage } from "@/lib/errorMessage";
import { isValidObjectId } from "@/lib/validate";
import { hasFeature } from "@/lib/features";
import { waLink } from "@/lib/whatsapp";
import { statusLabel, statusBadgeClass } from "@/lib/orderStatus";
import {
  ScissorsIcon,
  Squares2X2Icon,
  FireIcon,
  ArchiveBoxIcon,
  ArrowPathRoundedSquareIcon,
  PencilSquareIcon,
  PrinterIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ArrowUturnLeftIcon,
  DocumentTextIcon,
  BoltIcon,
  ChatBubbleLeftRightIcon,
  ScaleIcon,
} from "@heroicons/react/24/outline";
import type {
  Order,
  OrderStatus,
  PaymentMethod,
  StaffRef,
} from "@/types/order";
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

type StaffField = "cuttingMaster" | "stitcher" | "presser";

const STAFF_ROLES: [StaffField, string, string][] = [
  ["cuttingMaster", "cutting_master", "Cutting Master"],
  ["stitcher", "stitcher", "Stitcher"],
  ["presser", "presser", "Press Man"],
];

// Icon for each staff-assignment field — shared by the draft-activation
// form, the Edit Order form, the Staff Assignment card, and Assignment
// History. Covers cuttingMaster/stitcher/presser (STAFF_ROLES above) plus
// stockManager, which isn't part of the draft-activation trio.
const STAFF_FIELD_ICONS: Record<string, typeof ScissorsIcon> = {
  cuttingMaster: ScissorsIcon,
  stitcher: Squares2X2Icon,
  presser: FireIcon,
  stockManager: ArchiveBoxIcon,
};

// Assignment History card — field/source labels for the audit trail of
// every staff (re)assignment on this order (backend: assignmentHistory).
const ASSIGNMENT_FIELD_LABELS: Record<string, string> = {
  cuttingMaster: "Cutting Master",
  stitcher: "Stitcher",
  presser: "Press Man",
  stockManager: "Stock Manager",
};
const ASSIGNMENT_SOURCE_LABELS: Record<string, string> = {
  create: "set at order creation",
  assign: "assigned",
  edit: "reassigned",
  auto: "auto-assigned",
};

// Staff submit their finished work for review — Checker then approves/rejects
// via the separate /review endpoint, not this table.
const ROLE_TRANSITIONS: Partial<
  Record<UserRole, Partial<Record<OrderStatus, OrderStatus>>>
> = {
  cutting_master: { received: "cutting", cutting: "cutting_review" },
  stitcher: { stitching: "stitching_review" },
  presser: { pressing: "pressing_review" },
  stock_manager: { quality_check: "ready", ready: "delivered" },
  delivery_staff: { ready: "delivered" },
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

const PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "card",
  "bank_transfer",
  "mobile_money",
];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);

  // Inline order editing (orderEdit feature) — items' prices/quantities plus
  // the order-level fields the backend's EDIT_FIELDS whitelist accepts.
  // Totals are recalculated server-side on save.
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    suitNo: string;
    promisedDate: string;
    rushSurcharge: string;
    discountAmount: string;
    styleNotes: string;
    items: { quantity: string; basePrice: string; fabricAmount: string }[];
    // Staff reassignment — editable here regardless of order status (unlike
    // the draft-only activation form below, which only ever sets these once).
    cuttingMaster: string;
    stitcher: string;
    presser: string;
    stockManager: string;
  } | null>(null);
  // Active stock managers for the Edit form's dropdown — kept separate from
  // `staffByRole` (cutting/stitcher/presser only) since stock manager isn't
  // part of the draft-activation trio that state was originally built for.
  const [stockManagerStaff, setStockManagerStaff] = useState<User[]>([]);

  // Extract the id string from a possibly-populated staff ref — matches the
  // populated-vs-raw-id handling used throughout this file.
  const staffRefId = (ref: StaffRef | undefined): string =>
    typeof ref === "object" && ref ? ref._id : (ref as string) || "";

  const startEdit = () => {
    if (!order) return;
    setEditForm({
      suitNo: order.suitNo || "",
      promisedDate: order.promisedDate
        ? String(order.promisedDate).slice(0, 10)
        : "",
      rushSurcharge: String(order.rushSurcharge || 0),
      discountAmount: String(order.discountAmount || 0),
      styleNotes: order.styleNotes || "",
      items: (order.items || []).map((it) => ({
        quantity: String(it.quantity || 1),
        basePrice: String(it.basePrice || 0),
        fabricAmount: String(it.fabricAmount || 0),
      })),
      cuttingMaster: staffRefId(order.cuttingMaster),
      stitcher: staffRefId(order.stitcher),
      presser: staffRefId(order.presser),
      stockManager: staffRefId(order.stockManager),
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!order || !editForm) return;
    // min="0" on these inputs is visual only (spinner-only, doesn't block a
    // typed negative) — this is the real client-side gate; the API enforces
    // it too.
    if (
      editForm.items.some(
        (it) => Number(it.basePrice) < 0 || Number(it.fabricAmount) < 0,
      )
    ) {
      toast.error("Prices cannot be negative");
      return;
    }
    if (
      Number(editForm.rushSurcharge) < 0 ||
      Number(editForm.discountAmount) < 0
    ) {
      toast.error("Rush surcharge and discount cannot be negative");
      return;
    }
    try {
      await api.put(`/orders/${order._id}`, {
        suitNo: editForm.suitNo || undefined,
        ...(editForm.promisedDate
          ? { promisedDate: editForm.promisedDate }
          : {}),
        rushSurcharge: Number(editForm.rushSurcharge) || 0,
        discountAmount: Number(editForm.discountAmount) || 0,
        styleNotes: editForm.styleNotes,
        items: (order.items || []).map((it, i) => ({
          ...it,
          quantity: Number(editForm.items[i]?.quantity) || 1,
          basePrice: Number(editForm.items[i]?.basePrice) || 0,
          fabricAmount: Number(editForm.items[i]?.fabricAmount) || 0,
        })),
        // Staff reassignment — empty string un-assigns; the API validates
        // any id against role + branch + active status.
        cuttingMaster: editForm.cuttingMaster || null,
        stitcher: editForm.stitcher || null,
        presser: editForm.presser || null,
        stockManager: editForm.stockManager || null,
      });
      setEditing(false);
      toast.success("Order updated — totals recalculated");
      fetchOrder({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update order"));
    }
  };
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [payment, setPayment] = useState<{
    amount: string;
    method: PaymentMethod;
  }>({ amount: "", method: "cash" });
  const [paying, setPaying] = useState(false);
  // Marking Ready requires a rack number entered right there — separate from
  // the "Save Rack" button on the Rack card below, which is just a plain save.
  const [readyRackNum, setReadyRackNum] = useState("");
  const [markingReady, setMarkingReady] = useState(false);

  // Draft-only staff assignment
  const [staffByRole, setStaffByRole] = useState<
    Partial<Record<StaffField, User[]>>
  >({});
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

  // Assignable staff lists — needed by the draft-only activation form below
  // AND by the Edit Order form's staff-reassignment fields (which apply to
  // an order in any status, not just draft), so this loads for any admin
  // viewing any order rather than gating on order.status.
  useEffect(() => {
    if (!order || !user || !["super_admin", "admin"].includes(user.role))
      return;
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
      .catch((err) =>
        toast.error(errorMessage(err, "Failed to load staff list")),
      );
    api
      .get("/staff", { params: { role: "stock_manager" } })
      .then(({ data }) =>
        setStockManagerStaff(data.data.filter((s: User) => s.isActive)),
      )
      .catch(() => {});
  }, [order?._id, user?.role]);

  const saveAssignment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Activation needs the full trio — same rule as the backend.
    if (
      !assignment.cuttingMaster ||
      !assignment.stitcher ||
      !assignment.presser
    ) {
      toast.error(
        "Select all three — Cutting Master, Stitcher and Press Man — to activate this order",
      );
      return;
    }
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
          "Auto Assign only picks staff with login access — not every role could be filled, still in draft",
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
      toast.error(
        axiosErr.response?.data?.message || "Failed to submit review",
      );
    } finally {
      setReviewing(false);
    }
  };

  const advanceStatus = async (
    nextStatus: OrderStatus,
    extra: Record<string, unknown> = {},
  ) => {
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
      toast.error(
        axiosErr.response?.data?.message || "Failed to mark as ready",
      );
    } finally {
      setMarkingReady(false);
    }
  };

  const addPayment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const amount = Number(payment.amount);
    if (!(amount > 0)) {
      toast.error("Enter a valid amount");
      return;
    }
    // `max` on the input only limits the spinner — a typed value can still
    // exceed it, so this is the real client-side gate (the API enforces it too).
    if (order && amount > order.balanceDue) {
      toast.error(
        `Cannot exceed the balance due (PKR ${order.balanceDue.toLocaleString()})`,
      );
      return;
    }
    setPaying(true);
    try {
      await api.put(`/orders/${id}/payment`, {
        amount,
        method: payment.method,
      });
      toast.success("Payment recorded");
      setPayment({ amount: "", method: "cash" });
      fetchOrder();
    } catch (err) {
      toast.error(errorMessage(err, "Failed to record payment"));
    } finally {
      setPaying(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
      </div>
    );
  if (!order)
    return (
      <div className="text-center text-faint py-20">
        Order not found or not assigned to you
      </div>
    );

  const role = user?.role;
  const isAdmin = !!role && ["super_admin", "admin"].includes(role);
  const isChecker = role === "checker";
  const isDeliveryStaff = role === "delivery_staff";
  const isReviewStage = order.status?.endsWith("_review");

  // What each role can see
  const canSeeCustomerInfo = isAdmin || isDeliveryStaff; // name, phone — who they're handing the order to
  const canSeeMeasurements =
    isAdmin || isChecker || !role || role !== "stock_manager"; // cutting/stitching/presser + admin/checker need it
  const canSeePricing = isAdmin;
  const canSeeStaffAssignment = isAdmin || isChecker;
  const canAddPayment = isAdmin || isDeliveryStaff;

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
  const orderCustomer =
    typeof order.customer === "object" ? order.customer : null;
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
          <h1 className="text-xl sm:text-2xl font-extrabold text-ink font-mono break-all">
            {order.orderNumber}
          </h1>
          <div className="flex gap-2 mt-1 flex-wrap">
            <span className={statusBadgeClass(order.status)}>
              {statusLabel(order.status)}
            </span>
            {order.isRush && <span className="badge-danger">RUSH</span>}
            {order.isPickedUp && (
              <span className="badge-success">
                <CheckCircleIcon className="h-3 w-3" aria-hidden="true" />
                Picked Up
              </span>
            )}
            {order.rackNumber && (
              <span className="badge-accent">
                <ArchiveBoxIcon className="h-3 w-3" aria-hidden="true" />
                Rack {order.rackNumber}
              </span>
            )}
          </div>
          {order.status === "delivered" && order.deliveredBy && (
            <p className="text-xs text-muted mt-1.5">
              Delivered by{" "}
              <span className="font-semibold text-ink">
                {(typeof order.deliveredBy === "object" && order.deliveredBy.name) || "—"}
              </span>
              {order.deliveredDate &&
                ` on ${new Date(order.deliveredDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Repeat only finished work — an in-progress or draft order isn't
              a proven template yet. */}
          {isAdmin &&
            hasFeature(user, "repeatOrder") &&
            ["ready", "delivered"].includes(order.status) && (
              <Link
                href={`/orders/new?repeat=${order._id}`}
                className="btn-secondary text-sm"
                title="Start a new order for this customer with the same items"
              >
                <ArrowPathRoundedSquareIcon className="h-4 w-4" aria-hidden="true" />
                Repeat
              </Link>
            )}
          {order.status != "ready" &&
            isAdmin &&
            hasFeature(user, "orderEdit") &&
            !editing && (
              <button onClick={startEdit} className="btn-secondary text-sm">
                <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                Edit
              </button>
            )}
          {isAdmin && hasFeature(user, "receiptPrinting") && (
            <Link
              href={`/orders/${order._id}/receipt`}
              className="btn-secondary text-sm"
            >
              <PrinterIcon className="h-4 w-4" aria-hidden="true" />
              Receipt
            </Link>
          )}
          <button
            onClick={() => fetchOrder({ silent: true })}
            disabled={refreshing}
            className="btn-secondary text-sm"
            title="Refresh order"
          >
            <ArrowPathIcon className={clsx("h-4 w-4", refreshing && "animate-spin")} aria-hidden="true" />
            {refreshing ? "Refreshing…" : "Refresh"}
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
        <p className="text-xs text-faint -mt-4">
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
                  className={`h-2 w-10 rounded-full transition-colors ${i <= currentIdx ? "bg-accent" : "bg-border"}`}
                />
                <span
                  className="hidden lg:block text-faint text-center capitalize"
                  style={{ fontSize: "10px" }}
                >
                  {s.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Draft: assign staff to activate the order — admin only. Always
          shown (manual dropdowns + Assign & Activate); only the ⚡ Auto
          Assign shortcut below is feature-gated (draftAutoAssign,
          super_admin toggle, Settings → Features). ── */}
      {isAdmin && order.status === "draft" && (
        <div className="card space-y-4 border-2 border-dashed border-accent/30">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink flex items-center gap-1.5">
              <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
              Assign Staff to Activate
            </h2>
            {hasFeature(user, "draftAutoAssign") && (
              <button
                type="button"
                onClick={autoAssign}
                disabled={autoAssigning}
                className="btn-secondary text-xs"
              >
                {autoAssigning ? (
                  "Assigning…"
                ) : (
                  <>
                    <BoltIcon className="h-3.5 w-3.5" aria-hidden="true" />
                    Auto Assign
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-xs text-faint -mt-2">
            This order is a draft and won&apos;t show up for staff until all
            three roles — Cutting Master, Stitcher and Press Man — are
            assigned.
            {hasFeature(user, "draftAutoAssign") &&
              " Auto Assign only picks staff with login access."}
          </p>
          <form
            onSubmit={saveAssignment}
            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
          >
            {STAFF_ROLES.map(([field, , label]) => {
              const Icon = STAFF_FIELD_ICONS[field];
              return (
                <div key={field}>
                  <label className="flex items-center gap-1 text-sm font-semibold text-ink mb-1">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
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
              );
            })}
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={
                  assigning ||
                  !assignment.cuttingMaster ||
                  !assignment.stitcher ||
                  !assignment.presser
                }
                className="btn-primary text-sm"
              >
                {assigning ? "Saving…" : "Assign & Activate"}
              </button>
              {(!assignment.cuttingMaster ||
                !assignment.stitcher ||
                !assignment.presser) && (
                <p className="text-xs text-faint mt-1">
                  Select all three roles to activate.
                </p>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── Checker sent this back with a remark — visible to everyone once set ── */}
      {order.checkerRemark && !isReviewStage && (
        <div className="card border-l-4 border-l-danger bg-danger-soft text-sm">
          <p className="font-semibold text-danger mb-1 flex items-center gap-1.5">
            <ArrowPathRoundedSquareIcon className="h-4 w-4" aria-hidden="true" />
            Sent back by Checker for rework
          </p>
          <p className="text-danger italic">{order.checkerRemark}</p>
        </div>
      )}

      {/* ── Checker: approve or reject a stage submitted for review ── */}
      {(isChecker || isAdmin) && isReviewStage && (
        <div className="card space-y-3 border-2 border-dashed border-warning/40">
          <h2 className="font-semibold text-ink flex items-center gap-1.5">
            <MagnifyingGlassIcon className="h-4 w-4" aria-hidden="true" />
            Review Required
          </h2>
          <p className="text-sm text-muted">
            {statusLabel(order.status)} — inspect the work for this stage,
            then approve to pass it on or reject to send it back for rework.
          </p>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
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
              <CheckCircleIcon className="h-4 w-4" aria-hidden="true" />
              Approve — Pass to Next Stage
            </button>
            <button
              type="button"
              disabled={reviewing}
              onClick={() => submitReview("reject")}
              className="btn-secondary text-sm text-danger border-danger/30 hover:bg-danger-soft"
            >
              <ArrowUturnLeftIcon className="h-4 w-4" aria-hidden="true" />
              Reject — Send Back
            </button>
          </div>
        </div>
      )}

      {/* ── Edit order (orderEdit feature) ── */}
      {editing && editForm && (
        <div className="card space-y-4">
          <h2 className="font-semibold text-ink flex items-center gap-1.5">
            <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
            Edit Order
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Suit No
              </label>
              <input
                className="input text-sm"
                value={editForm.suitNo}
                onChange={(e) =>
                  setEditForm((f) => f && { ...f, suitNo: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Promised Date
              </label>
              <input
                type="date"
                className="input text-sm"
                value={editForm.promisedDate}
                onChange={(e) =>
                  setEditForm(
                    (f) => f && { ...f, promisedDate: e.target.value },
                  )
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Rush Surcharge
              </label>
              <input
                type="number"
                min="0"
                className="input text-sm"
                value={editForm.rushSurcharge}
                onChange={(e) =>
                  setEditForm(
                    (f) => f && { ...f, rushSurcharge: e.target.value },
                  )
                }
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Discount
              </label>
              <input
                type="number"
                min="0"
                className="input text-sm"
                value={editForm.discountAmount}
                onChange={(e) =>
                  setEditForm(
                    (f) => f && { ...f, discountAmount: e.target.value },
                  )
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            {(order.items || []).map((it, i) => (
              <div
                key={i}
                className="grid grid-cols-4 gap-2 items-end border border-border rounded-lg p-2"
              >
                <p className="text-sm text-ink col-span-4 sm:col-span-1 font-medium">
                  {it.garmentType}
                </p>
                {(["quantity", "basePrice", "fabricAmount"] as const).map(
                  (field) => (
                    <div key={field}>
                      <label className="block text-[10px] uppercase text-faint mb-0.5">
                        {field === "quantity"
                          ? "Qty"
                          : field === "basePrice"
                            ? "Price"
                            : "Fabric"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input text-xs py-1"
                        value={editForm.items[i]?.[field] ?? ""}
                        onChange={(e) =>
                          setEditForm(
                            (f) =>
                              f && {
                                ...f,
                                items: f.items.map((row, ri) =>
                                  ri === i
                                    ? { ...row, [field]: e.target.value }
                                    : row,
                                ),
                              },
                          )
                        }
                      />
                    </div>
                  ),
                )}
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Style Notes
            </label>
            <textarea
              rows={2}
              className="input text-sm"
              value={editForm.styleNotes}
              onChange={(e) =>
                setEditForm((f) => f && { ...f, styleNotes: e.target.value })
              }
            />
          </div>

          <hr className="border-border" />
          <h3 className="font-semibold text-ink">Staff Assignment</h3>
          <p className="text-xs text-faint -mt-2">
            Reassign who&apos;s responsible for this order — e.g. if the
            assigned staff member is unavailable. Doesn&apos;t change the
            order&apos;s status.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STAFF_ROLES.map(([field, , label]) => {
              const Icon = STAFF_FIELD_ICONS[field];
              return (
                <div key={field}>
                  <label className="flex items-center gap-1 text-sm font-semibold text-ink mb-1">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {label}
                  </label>
                  <select
                    className="input"
                    value={editForm[field]}
                    onChange={(e) =>
                      setEditForm((f) => f && { ...f, [field]: e.target.value })
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
              );
            })}
            <div>
              <label className="flex items-center gap-1 text-sm font-semibold text-ink mb-1">
                <ArchiveBoxIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Stock Manager
              </label>
              <select
                className="input"
                value={editForm.stockManager}
                onChange={(e) =>
                  setEditForm(
                    (f) => f && { ...f, stockManager: e.target.value },
                  )
                }
              >
                <option value="">Unassigned</option>
                {stockManagerStaff.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                    {!s.hasLogin ? " (no login)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={saveEdit} className="btn-primary text-sm">
              Save Changes
            </button>
            <button
              onClick={() => setEditing(false)}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Customer info — admin only ── */}
      {canSeeCustomerInfo && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-ink">Customer</h2>
          <div>
            <p className="font-medium text-ink">{orderCustomer?.name}</p>
            <p className="text-sm text-faint">
              {orderCustomer && "phone" in orderCustomer
                ? String(orderCustomer.phone ?? "")
                : ""}
            </p>
            {orderCustomer &&
              "address" in orderCustomer &&
              (orderCustomer as { address?: string }).address && (
                <p className="text-sm text-faint">
                  {(orderCustomer as { address?: string }).address}
                </p>
              )}
            {/* One-click "order ready" WhatsApp message (whatsappNotify feature).
                Kept as WhatsApp's own brand green rather than a theme token —
                it's a recognizable affordance for "this opens WhatsApp", not a
                semantic status color. */}
            {hasFeature(user, "whatsappNotify") &&
              order.status === "ready" &&
              orderCustomer &&
              "phone" in orderCustomer &&
              orderCustomer.phone && (
                <a
                  href={waLink(
                    String(orderCustomer.phone),
                    `Assalam o Alaikum ${orderCustomer.name}! Your order ${order.orderNumber}` +
                      `${order.suitNo ? ` (Suit No ${order.suitNo})` : ""} is ready for pickup.` +
                      `${order.rackNumber ? ` Rack ${order.rackNumber}.` : ""}` +
                      `${(order.balanceDue ?? 0) > 0 ? ` Balance due: PKR ${(order.balanceDue ?? 0).toLocaleString()}.` : ""}`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium"
                >
                  <ChatBubbleLeftRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  WhatsApp: Order Ready
                </a>
              )}
          </div>
        </div>
      )}

      {/* ── Order details — everyone sees this ── */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-ink">Order Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
          <p>
            <span className="text-faint">Suit No:</span>{" "}
            {order.suitNo || "—"}
          </p>
          <p>
            <span className="text-faint">Promised:</span>{" "}
            <span
              className={
                order.promisedDate &&
                new Date(order.promisedDate) < new Date() &&
                order.status !== "delivered"
                  ? "text-danger font-semibold"
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
          <div className="bg-warning-soft rounded-lg p-3 text-sm text-muted italic flex items-start gap-1.5">
            <DocumentTextIcon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            {order.styleNotes}
          </div>
        )}
      </div>

      {/* ── Items — one order can have multiple item lines ── */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-ink">Items</h2>
        <div className="space-y-2">
          {(order.items || []).map((it, i) => (
            <div key={i} className="bg-surface-hover rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-ink">{it.garmentType}</span>
                <span className="text-muted">Qty: {it.quantity || 1}</span>
              </div>
              <div className="text-xs text-faint mt-1">
                Fabric: {it.fabric || "—"} · Source:{" "}
                {it.fabricSource?.replace(/_/g, " ") || "—"}
                {it.fabricAmount > 0 &&
                  ` · Fabric Amount: PKR ${it.fabricAmount.toLocaleString()}`}
              </div>
              {canSeePricing && (
                <div className="text-xs text-muted mt-1">
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
          <h2 className="font-semibold text-ink flex items-center gap-1.5">
            <ScaleIcon className="h-4 w-4" aria-hidden="true" />
            Customer Measurements (inches)
          </h2>
          {hasMeasurements && measurements ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {MEASUREMENT_FIELDS.map(([k, label]) =>
                measurements[k] ? (
                  <div
                    key={k}
                    className="bg-surface-hover rounded-lg p-2 text-center"
                  >
                    <p className="text-xs text-faint">{label}</p>
                    <p className="font-bold text-ink">
                      {String(measurements[k])}"
                    </p>
                  </div>
                ) : null,
              )}
            </div>
          ) : (
            <p className="text-sm text-faint italic">
              No measurements recorded for this customer.
            </p>
          )}
          {measurements?.notes && (
            <p className="text-sm text-muted bg-surface-hover rounded p-2 flex items-start gap-1.5">
              <DocumentTextIcon className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              {measurements.notes}
            </p>
          )}
        </div>
      )}

      {/* ── Billing — admin only ── */}
      {canSeePricing && (
        <div className="card space-y-3">
          <h2 className="font-semibold text-ink">Billing</h2>
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-faint">Items Subtotal</span>
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
                <span className="text-faint">Rush Surcharge</span>
                <span className="text-danger">
                  +PKR {order.rushSurcharge?.toLocaleString()}
                </span>
              </div>
            )}
            {!!order.discountAmount && order.discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-faint">Discount</span>
                <span className="text-success">
                  -PKR {order.discountAmount?.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-border pt-1">
              <span>Total</span>
              <span>PKR {order.totalPrice?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-faint">Paid</span>
              <span className="text-success">
                PKR {order.amountPaid?.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Balance Due</span>
              <span
                className={
                  order.balanceDue > 0 ? "text-danger" : "text-success"
                }
              >
                PKR {order.balanceDue?.toLocaleString()}
              </span>
            </div>
          </div>
          {order.payments?.length > 0 && (
            <div className="text-xs space-y-1 bg-surface-hover rounded p-2">
              {order.payments.map((p, i) => (
                <div key={i} className="flex justify-between text-muted">
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
                min="1"
                max={order.balanceDue}
                className="input flex-1 min-w-[120px] text-sm"
                placeholder={`Amount (max ${order.balanceDue.toLocaleString()})`}
                value={payment.amount}
                onChange={(e) =>
                  setPayment({ ...payment, amount: e.target.value })
                }
              />
              <select
                className="input w-full sm:w-32 text-sm"
                value={payment.method}
                onChange={(e) =>
                  setPayment({
                    ...payment,
                    method: e.target.value as PaymentMethod,
                  })
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
          <h2 className="font-semibold text-ink mb-3">Staff Assignment</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {(
              [
                ["cuttingMaster", "Cutting Master", order.cuttingMaster],
                ["stitcher", "Stitcher", order.stitcher],
                ["presser", "Press Man", order.presser],
                ["stockManager", "Stock Manager", order.stockManager],
              ] as [string, string, Order["cuttingMaster"]][]
            ).map(([field, r, s]) => {
              const Icon = STAFF_FIELD_ICONS[field];
              return (
                <div key={field} className="bg-surface-hover rounded-lg p-3">
                  <p className="text-xs text-faint mb-1 flex items-center gap-1">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {r}
                  </p>
                  <p className="font-medium">
                    {(typeof s === "object" && s?.name) || (
                      <span className="text-faint text-xs">Unassigned</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Status History — everyone sees ── */}
      <div className="card">
        <h2 className="font-semibold text-ink mb-3">Status History</h2>
        <div className="space-y-2">
          {order.statusHistory?.map((h, i) => (
            <div
              key={i}
              className="flex flex-wrap gap-x-3 gap-y-1 text-sm items-start"
            >
              <span className="text-faint text-xs w-28 sm:w-32 shrink-0 mt-0.5">
                {h.changedAt
                  ? format(new Date(h.changedAt), "dd MMM HH:mm")
                  : ""}
              </span>
              <span className="font-medium capitalize">
                {h.status?.replace(/_/g, " ")}
              </span>
              {/* Only show who changed it to admin */}
              {isAdmin && (
                <span className="text-faint text-xs">
                  {(typeof h.changedBy === "object" && h.changedBy?.name) || ""}
                </span>
              )}
              {h.note && (
                <span className="text-faint italic text-xs">{h.note}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Assignment History — same audience as the Staff Assignment card ── */}
      {canSeeStaffAssignment && !!order.assignmentHistory?.length && (
        <div className="card">
          <h2 className="font-semibold text-ink mb-3">Assignment History</h2>
          <div className="space-y-2">
            {[...order.assignmentHistory]
              .reverse()
              .map((h, i) => {
                const nameOf = (ref: typeof h.fromStaff) =>
                  (typeof ref === "object" && ref?.name) || null;
                const from = nameOf(h.fromStaff);
                const to = nameOf(h.toStaff);
                const FieldIcon = STAFF_FIELD_ICONS[h.field];
                return (
                  <div
                    key={i}
                    className="flex flex-wrap gap-x-3 gap-y-1 text-sm items-start"
                  >
                    <span className="text-faint text-xs w-28 sm:w-32 shrink-0 mt-0.5">
                      {h.changedAt
                        ? format(new Date(h.changedAt), "dd MMM HH:mm")
                        : ""}
                    </span>
                    <span className="font-medium flex items-center gap-1">
                      {FieldIcon && (
                        <FieldIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {ASSIGNMENT_FIELD_LABELS[h.field] || h.field}
                    </span>
                    <span className="text-muted">
                      {from ? `${from} → ` : ""}
                      {to || "Unassigned"}
                    </span>
                    <span className="text-faint text-xs">
                      {ASSIGNMENT_SOURCE_LABELS[h.source] || h.source}
                      {(typeof h.changedBy === "object" && h.changedBy?.name &&
                        ` by ${h.changedBy.name}`) ||
                        ""}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
