"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/context/AuthContext";
import type { Branch } from "@/types/user";

// Collections (feature flag `collections`): every order still owing money.
interface CollectionRow {
  _id: string;
  orderNumber: string;
  suitNo?: string;
  status: string;
  totalPrice: number;
  amountPaid: number;
  balanceDue: number;
  promisedDate?: string;
  customer: { _id: string; name: string; phone?: string } | string;
  branch: { _id: string; name: string } | string;
}

export default function CollectionsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === "super_admin";
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rows, setRows] = useState<CollectionRow[]>([]);
  const [totals, setTotals] = useState({ count: 0, receivable: 0 });
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
      .get("/dashboard/collections", {
        params: branchId ? { branch: branchId } : {},
      })
      .then(({ data }) => {
        setRows(data.data);
        setTotals(data.totals);
      })
      .catch((err) => toast.error(errorMessage(err, "Failed to load collections")))
      .finally(() => setLoading(false));
  }, [branchId]);

  useEffect(load, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
          Collections
        </h1>
        {isSuperAdmin && (
          <select
            className="input text-sm w-auto"
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
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="card">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Total Receivable
          </p>
          <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
            PKR {totals.receivable.toLocaleString()}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Orders With Balance
          </p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {totals.count.toLocaleString()}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 dark:text-gray-500">
          🎉 Nothing outstanding — everything is paid up
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-gray-400 dark:text-gray-500">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  {isSuperAdmin && !branchId && <th className="px-4 py-3">Branch</th>}
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const cust = typeof r.customer === "object" ? r.customer : null;
                  return (
                    <tr
                      key={r._id}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${r._id}`}
                          className="font-mono text-primary hover:underline"
                        >
                          {r.suitNo ? `Suit ${r.suitNo}` : r.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {cust?.name || "—"}
                        </span>
                        {cust?.phone && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {cust.phone}
                          </p>
                        )}
                      </td>
                      {isSuperAdmin && !branchId && (
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                          {(typeof r.branch === "object" && r.branch?.name) || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 capitalize">
                        {r.status?.replace(/_/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {r.totalPrice?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">
                        {r.amountPaid?.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">
                        PKR {r.balanceDue?.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
