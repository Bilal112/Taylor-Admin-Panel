"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";

const MEASUREMENT_FIELDS = [
  ["chest", "Chest"],
  ["waist", "Waist"],
  ["hips", "Hips"],
  ["shoulder", "Shoulder"],
  ["sleeveLength", "Sleeve Length"],
  ["neck", "Neck"],
  ["inseam", "Inseam"],
  ["outseam", "Outseam"],
  ["thigh", "Thigh"],
  ["height", "Height"],
];

export default function CustomerDetailPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [measurements, setMeasurements] = useState({});
  const [editInfo, setEditInfo] = useState(false);
  const [info, setInfo] = useState({});

  useEffect(() => {
    Promise.all([
      api.get(`/customers/${id}`),
      api.get("/orders", { params: { customer: id, limit: 50 } }),
    ])
      .then(([cRes, oRes]) => {
        setCustomer(cRes.data.data);
        setInfo({
          name: cRes.data.data.name,
          phone: cRes.data.data.phone,
          email: cRes.data.data.email || "",
          address: cRes.data.data.address || "",
        });
        setMeasurements(cRes.data.data.measurements || {});
        setOrders(oRes.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const saveMeasurements = async () => {
    try {
      await api.put(`/customers/${id}/measurements`, measurements);
      toast.success("Measurements saved!");
    } catch {
      toast.error("Failed");
    }
  };

  const saveInfo = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.put(`/customers/${id}`, info);
      setCustomer(data.data);
      setEditInfo(false);
      toast.success("Updated!");
    } catch {
      toast.error("Failed");
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  if (!customer)
    return (
      <div className="text-center py-20 text-gray-400">Customer not found</div>
    );

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
        {customer.name}
      </h1>

      {/* Info card */}
      <div className="card space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-gray-700">Customer Info</h2>
          <button
            onClick={() => setEditInfo((v) => !v)}
            className="text-xs text-primary hover:underline"
          >
            {editInfo ? "Cancel" : "Edit"}
          </button>
        </div>
        {editInfo ? (
          <form
            onSubmit={saveInfo}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {[
              ["name", "Name"],
              ["phone", "Phone"],
              ["email", "Email"],
              ["address", "Address"],
            ].map(([k, l]) => (
              <div key={k}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {l}
                </label>
                <input
                  className="input text-sm"
                  value={info[k] || ""}
                  onChange={(e) => setInfo({ ...info, [k]: e.target.value })}
                />
              </div>
            ))}
            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" className="btn-primary text-sm">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditInfo(false)}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-400">Phone:</span> {customer.phone}
            </div>
            <div>
              <span className="text-gray-400">Email:</span>{" "}
              {customer.email || "—"}
            </div>
            <div>
              <span className="text-gray-400">Gender:</span>{" "}
              {customer.gender || "—"}
            </div>
            <div>
              <span className="text-gray-400">Branch:</span>{" "}
              {customer.branch?.name}
            </div>
            <div className="sm:col-span-2">
              <span className="text-gray-400">Address:</span>{" "}
              {customer.address || "—"}
            </div>
          </div>
        )}
      </div>

      {/* Measurements */}
      <div className="card space-y-3">
        <h2 className="font-semibold text-gray-700">Measurements (inches)</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {MEASUREMENT_FIELDS.map(([k, l]) => (
            <div key={k}>
              <label className="block text-xs text-gray-500 mb-1">{l}</label>
              <input
                type="number"
                step="0.5"
                className="input text-sm text-center"
                value={measurements[k] || ""}
                onChange={(e) =>
                  setMeasurements({
                    ...measurements,
                    [k]: Number(e.target.value),
                  })
                }
              />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Notes</label>
          <textarea
            className="input text-sm"
            rows={2}
            value={measurements.notes || ""}
            onChange={(e) =>
              setMeasurements({ ...measurements, notes: e.target.value })
            }
          />
        </div>
        <button onClick={saveMeasurements} className="btn-primary text-sm">
          Save Measurements
        </button>
      </div>

      {/* Orders history */}
      <div className="card">
        <h2 className="font-semibold text-gray-700 mb-3">
          Order History ({orders.length})
        </h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-400">No orders yet</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o) => (
              <div
                key={o._id}
                className="flex items-center justify-between flex-wrap gap-2 bg-gray-50 rounded-lg px-3 py-2"
              >
                <div className="min-w-0">
                  <span className="font-mono text-sm text-primary">
                    {o.orderNumber}
                  </span>
                  <span className="text-gray-500 text-xs ml-2">
                    {o.items?.map((it) => it.garmentType).join(", ") ||
                      o.garmentType}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-gray-400 capitalize">
                    {o.status?.replace(/_/g, " ")}
                  </span>
                  <Link
                    href={`/orders/${o._id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
