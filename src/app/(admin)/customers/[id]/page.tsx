"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { errorMessage } from "@/lib/errorMessage";
import { isValidObjectId } from "@/lib/validate";
import type { Customer, Measurement } from "@/types/customer";
import type { Order } from "@/types/order";

const MEASUREMENT_FIELDS: [keyof Measurement, string][] = [
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

interface InfoForm {
  name: string;
  phone: string;
  email: string;
  address: string;
}

const INFO_FIELDS: [keyof InfoForm, string][] = [
  ["name", "Name"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["address", "Address"],
];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [measurements, setMeasurements] = useState<Measurement>({});
  const [editInfo, setEditInfo] = useState(false);
  const [info, setInfo] = useState<InfoForm>({ name: "", phone: "", email: "", address: "" });

  useEffect(() => {
    if (!isValidObjectId(id)) {
      setLoading(false);
      return;
    }
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
      .catch((err) => toast.error(errorMessage(err, "Failed to load customer")))
      .finally(() => setLoading(false));
  }, [id]);

  const saveMeasurements = async () => {
    try {
      await api.put(`/customers/${id}/measurements`, measurements);
      toast.success("Measurements saved!");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to save measurements"));
    }
  };

  const saveInfo = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const { data } = await api.put(`/customers/${id}`, info);
      setCustomer(data.data);
      setEditInfo(false);
      toast.success("Updated!");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update customer"));
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
            {INFO_FIELDS.map(([k, l]) => (
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
              {typeof customer.branch === "object" ? customer.branch?.name : ""}
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
                value={(measurements[k] as number) ?? ""}
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
                    {o.items?.map((it) => it.garmentType).join(", ")}
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
