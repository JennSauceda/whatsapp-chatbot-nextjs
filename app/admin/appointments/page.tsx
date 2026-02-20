"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";
import RescheduleModal from "@/components/RescheduleModal";

type Appointment = {
  _id: string;
  date: string;
  time: string;
  name: string;
  email: string;
  whatsapp: string;
};

export default function AdminAppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  // const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [openReschedule, setOpenReschedule] = useState(false);

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

  const cancelAppointment = async () => {
    if (!selectedId) return;

    setLoading(true);

    const res = await fetch(`/api/admin/appointments/${selectedId}`, {
      method: "DELETE",
    });

    setLoading(false);
    setOpenModal(false);
    setSelectedId(null);
    load();

    if (res.ok) {
      router.refresh(); // recarga server components
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p className="p-6">Cargando citas…</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Citas</h1>
      <Link
        href="/admin/appointments/new"
        className="mb-4 inline-block rounded bg-black px-4 py-2 text-white"
      >
        + Nueva cita
      </Link>
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
                    onClick={() => {
                      setSelectedId(a._id);
                      setOpenReschedule(true);
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    Reprogramar
                  </button>
                  <button
                    onClick={() => {
                      setSelectedId(a._id);
                      setOpenModal(true);
                    }}
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
      <ConfirmModal
        open={openModal}
        title="Cancelar cita"
        description="¿Seguro que deseas cancelar esta cita? Esta acción no se puede deshacer."
        confirmText="Sí, cancelar"
        cancelText="No"
        loading={loading}
        onConfirm={cancelAppointment}
        onCancel={() => {
          setOpenModal(false);
          setSelectedId(null);
        }}
      />

      <RescheduleModal
        open={openReschedule}
        appointmentId={selectedId}
        onClose={() => {
          setOpenReschedule(false);
          setSelectedId(null);
        }}
        onSuccess={() => {
          router.refresh();
          load();
        }}
      />
    </div>
  );
}
