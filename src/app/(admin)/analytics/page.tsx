"use client";
import { useCallback, useEffect, useState, type ComponentType, type SVGProps } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import {
  ScissorsIcon,
  SwatchIcon,
  FireIcon,
  ArchiveBoxIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { Branch, UserRole } from "@/types/user";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

// Mirrors the response of GET /api/dashboard/staff-performance.
interface StaffPerf {
  _id: string;
  name: string;
  role: UserRole;
  specialization?: string;
  isActive: boolean;
  branch: { _id: string; name: string } | null;
  commissionPerPiece: number;
  ordersCompleted: number;
  piecesCompleted: number;
  rejections: number;
  delivered: number;
  activeOrders: number;
  commissionEarned: number;
}

// One section per production role. "doneLabel" names what a completed order
// means for that role (cut / stitched / pressed / put on the rack).
const ROLE_SECTIONS: { role: UserRole; title: string; doneLabel: string; icon: Icon }[] = [
  { role: "cutting_master", title: "Cutting Masters", doneLabel: "Orders Cut", icon: ScissorsIcon },
  { role: "stitcher", title: "Stitchers", doneLabel: "Orders Stitched", icon: SwatchIcon },
  { role: "presser", title: "Press Men", doneLabel: "Orders Pressed", icon: FireIcon },
  { role: "stock_manager", title: "Stock Managers", doneLabel: "Orders Racked", icon: ArchiveBoxIcon },
];

const day = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local

export default function AnalyticsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";

  const [from, setFrom] = useState(() => day(new Date(Date.now() - 29 * 86400000)));
  const [to, setTo] = useState(() => day(new Date()));
  const [branchId, setBranchId] = useState(""); // super_admin only; "" = all branches
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<StaffPerf[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api
      .get("/branches")
      .then(({ data }) => setBranches(data.data))
      .catch(() => {});
  }, [isSuperAdmin]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/dashboard/staff-performance", {
        params: { from, to, ...(branchId ? { branch: branchId } : {}) },
      })
      .then(({ data }) => setRows(data.data))
      .catch((err) => toast.error(errorMessage(err, "Failed to load analytics")))
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  useEffect(load, [load]);

  const preset = (p: 7 | 30 | "month") => {
    const now = new Date();
    setFrom(
      p === "month"
        ? day(new Date(now.getFullYear(), now.getMonth(), 1))
        : day(new Date(Date.now() - (p - 1) * 86400000)),
    );
    setTo(day(now));
  };

  const totals = rows.reduce(
    (acc, r) => ({
      pieces: acc.pieces + r.piecesCompleted,
      orders: acc.orders + r.ordersCompleted,
      commission: acc.commission + r.commissionEarned,
      rejections: acc.rejections + r.rejections,
    }),
    { pieces: 0, orders: 0, commission: 0, rejections: 0 },
  );

  const totalTiles: { label: string; value: string; icon: Icon }[] = [
    { label: "Orders Completed", value: totals.orders.toLocaleString(), icon: ClipboardDocumentListIcon },
    { label: "Pieces Completed", value: totals.pieces.toLocaleString(), icon: CubeIcon },
    { label: "Commission Payable", value: `PKR ${totals.commission.toLocaleString()}`, icon: BanknotesIcon },
    { label: "Checker Rejections", value: totals.rejections.toLocaleString(), icon: ExclamationTriangleIcon },
  ];

  const showBranchCol = isSuperAdmin && !branchId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-extrabold text-ink">
          Staff Performance
        </h1>
        <div className="flex gap-2">
          <button onClick={() => preset(7)} className="btn-secondary text-xs">
            Last 7 days
          </button>
          <button onClick={() => preset(30)} className="btn-secondary text-xs">
            Last 30 days
          </button>
          <button onClick={() => preset("month")} className="btn-secondary text-xs">
            This month
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-ink mb-1">
            From
          </label>
          <input
            type="date"
            className="input text-sm"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink mb-1">
            To
          </label>
          <input
            type="date"
            className="input text-sm"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        {isSuperAdmin && (
          <div>
            <label className="block text-xs font-semibold text-ink mb-1">
              Branch
            </label>
            <select
              className="input text-sm"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : (
        <>
          {/* Period totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {totalTiles.map(({ label, value, icon: TileIcon }) => (
              <div key={label} className="stat-card">
                <div className="stat-card-label flex items-center gap-1.5">
                  <TileIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {label}
                </div>
                <p className="stat-card-value">{value}</p>
              </div>
            ))}
          </div>

          {ROLE_SECTIONS.map(({ role, title, doneLabel, icon: RoleIcon }) => {
            const staff = rows.filter((r) => r.role === role);
            if (!staff.length) return null;
            const isStock = role === "stock_manager";
            return (
              <div key={role} className="card p-0 overflow-hidden">
                <h2 className="font-semibold text-ink px-4 py-3 border-b border-border flex items-center gap-1.5">
                  <RoleIcon className="h-4 w-4 text-accent shrink-0" aria-hidden="true" />
                  {title}
                </h2>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        {showBranchCol && <th>Branch</th>}
                        <th className="text-right">{doneLabel}</th>
                        <th className="text-right">Pieces</th>
                        {isStock && <th className="text-right">Delivered</th>}
                        <th className="text-right">Rate (PKR)</th>
                        <th className="text-right">Commission (PKR)</th>
                        {!isStock && <th className="text-right">Rejections</th>}
                        <th className="text-right">Active Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((s) => (
                        <tr key={s._id}>
                          <td>
                            <span className="font-medium text-ink">
                              {s.name}
                            </span>
                            {!s.isActive && (
                              <span className="ml-2 text-xs text-faint">
                                inactive
                              </span>
                            )}
                            {s.specialization && (
                              <p className="text-xs text-faint">
                                {s.specialization}
                              </p>
                            )}
                          </td>
                          {showBranchCol && (
                            <td className="text-muted">
                              {s.branch?.name || "—"}
                            </td>
                          )}
                          <td className="text-right font-semibold text-ink">
                            {s.ordersCompleted.toLocaleString()}
                          </td>
                          <td className="text-right text-muted">
                            {s.piecesCompleted.toLocaleString()}
                          </td>
                          {isStock && (
                            <td className="text-right text-muted">
                              {s.delivered.toLocaleString()}
                            </td>
                          )}
                          <td className="text-right text-muted">
                            {s.commissionPerPiece.toLocaleString()}
                          </td>
                          <td className="text-right font-semibold text-ink">
                            {s.commissionEarned.toLocaleString()}
                          </td>
                          {!isStock && (
                            <td
                              className={`text-right ${
                                s.rejections
                                  ? "text-danger font-medium"
                                  : "text-faint"
                              }`}
                            >
                              {s.rejections.toLocaleString()}
                            </td>
                          )}
                          <td className="text-right text-muted">
                            {s.activeOrders.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {!rows.length && (
            <p className="text-sm text-muted">
              No production staff found for this selection.
            </p>
          )}

          <p className="text-xs text-faint">
            An order counts for a staff member in the period their stage was
            finished (submitted for review or moved onward). Commission = pieces
            completed × that staff member&apos;s current rate per piece.
          </p>
        </>
      )}
    </div>
  );
}
