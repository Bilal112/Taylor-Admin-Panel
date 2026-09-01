"use client";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import type { Branch, UserRole } from "@/types/user";

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
const ROLE_SECTIONS: { role: UserRole; title: string; doneLabel: string }[] = [
  { role: "cutting_master", title: "✂️ Cutting Masters", doneLabel: "Orders Cut" },
  { role: "stitcher", title: "🧵 Stitchers", doneLabel: "Orders Stitched" },
  { role: "presser", title: "🔥 Press Men", doneLabel: "Orders Pressed" },
  { role: "stock_manager", title: "📦 Stock Managers", doneLabel: "Orders Racked" },
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

  const showBranchCol = isSuperAdmin && !branchId;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
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
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
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
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
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
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : (
        <>
          {/* Period totals */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["Orders Completed", totals.orders.toLocaleString()],
              ["Pieces Completed", totals.pieces.toLocaleString()],
              ["Commission Payable", `PKR ${totals.commission.toLocaleString()}`],
              ["Checker Rejections", totals.rejections.toLocaleString()],
            ].map(([label, value]) => (
              <div key={label} className="card">
                <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                  {value}
                </p>
              </div>
            ))}
          </div>

          {ROLE_SECTIONS.map(({ role, title, doneLabel }) => {
            const staff = rows.filter((r) => r.role === role);
            if (!staff.length) return null;
            const isStock = role === "stock_manager";
            return (
              <div key={role} className="card p-0 overflow-hidden">
                <h2 className="font-semibold text-gray-700 dark:text-gray-300 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  {title}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-400 dark:text-gray-500">
                        <th className="px-4 py-2">Name</th>
                        {showBranchCol && <th className="px-4 py-2">Branch</th>}
                        <th className="px-4 py-2 text-right">{doneLabel}</th>
                        <th className="px-4 py-2 text-right">Pieces</th>
                        {isStock && <th className="px-4 py-2 text-right">Delivered</th>}
                        <th className="px-4 py-2 text-right">Rate (PKR)</th>
                        <th className="px-4 py-2 text-right">Commission (PKR)</th>
                        {!isStock && <th className="px-4 py-2 text-right">Rejections</th>}
                        <th className="px-4 py-2 text-right">Active Now</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staff.map((s) => (
                        <tr
                          key={s._id}
                          className="border-t border-gray-100 dark:border-gray-800"
                        >
                          <td className="px-4 py-2.5">
                            <span className="font-medium text-gray-800 dark:text-gray-200">
                              {s.name}
                            </span>
                            {!s.isActive && (
                              <span className="ml-2 text-xs text-red-500 dark:text-red-400">
                                inactive
                              </span>
                            )}
                            {s.specialization && (
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {s.specialization}
                              </p>
                            )}
                          </td>
                          {showBranchCol && (
                            <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                              {s.branch?.name || "—"}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-800 dark:text-gray-200">
                            {s.ordersCompleted.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                            {s.piecesCompleted.toLocaleString()}
                          </td>
                          {isStock && (
                            <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                              {s.delivered.toLocaleString()}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-right text-gray-500 dark:text-gray-400">
                            {s.commissionPerPiece.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-800 dark:text-gray-200">
                            {s.commissionEarned.toLocaleString()}
                          </td>
                          {!isStock && (
                            <td
                              className={`px-4 py-2.5 text-right ${
                                s.rejections
                                  ? "text-red-600 dark:text-red-400 font-medium"
                                  : "text-gray-400 dark:text-gray-500"
                              }`}
                            >
                              {s.rejections.toLocaleString()}
                            </td>
                          )}
                          <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
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
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No production staff found for this selection.
            </p>
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">
            An order counts for a staff member in the period their stage was
            finished (submitted for review or moved onward). Commission = pieces
            completed × that staff member&apos;s current rate per piece.
          </p>
        </>
      )}
    </div>
  );
}
