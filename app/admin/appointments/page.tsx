"use client";

import { useEffect, useState } from "react";

type Appointment = {
  _id: string;
  date: string;
  time: string;
  name: string;
  email: string;
  whatsapp: string;
};

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    const res = await fetch("/api/admin/appointments");

    if (!res.ok) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const data = await res.json();

    if (Array.isArray(data)) {
      setAppointments(data);
    } else {
      setAppointments([]);
    }

    setLoading(false);
  };

  const cancel = async (id: string) => {
    if (!confirm("¿Cancelar esta cita?")) return;

    await fetch(`/api/admin/appointments/${id}`, {
      method: "DELETE",
    });

    load();
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p className="p-6">Cargando citas…</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Citas</h1>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Fecha</th>
              <th className="p-3">Hora</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Correo</th>
              <th className="p-3">WhatsApp</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {appointments.map((a) => (
              <tr key={a._id} className="border-t">
                <td className="p-3">{a.date}</td>
                <td className="p-3">{a.time}</td>
                <td className="p-3">{a.name}</td>
                <td className="p-3">{a.email}</td>
                <td className="p-3">{a.whatsapp}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => cancel(a._id)}
                    className="text-red-600 hover:underline"
                  >
                    Cancelar
                  </button>
                </td>
              </tr>
            ))}

            {appointments.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-400">
                  No hay citas registradas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
