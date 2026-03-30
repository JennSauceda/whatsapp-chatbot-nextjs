"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

type UserDetail = {
  user: {
    _id: string;
    name: string;
    whatsapp: string;
    email?: string;
  };
  appointments: {
    _id: string;
    date: string;
    time: string;
  }[];
};

export default function UserDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState<UserDetail | null>(null);
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoData, setInfoData] = useState<{ title?: string; description?: string } | null>(null);

  useEffect(() => {
    console.log(id);
    fetch(`/api/admin/users/${id}`)
      .then((res) => res.json())
      .then(setData);
  }, [id]);
  const handleDelete = async () => {
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!data) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${data.user._id}`, {
        method: "DELETE",
      });

      setLoading(false);
      setConfirmOpen(false);

      if (res.ok) {
        router.push("/admin/users");
      } else {
        setInfoData({ title: "Error", description: `Error al eliminar el usuario: ${res.statusText}` });
        setInfoOpen(true);
      }
    } catch (err) {
      setLoading(false);
      setConfirmOpen(false);
      setInfoData({ title: "Error", description: "Error al eliminar el usuario." });
      setInfoOpen(true);
    }
  };

  if (!data) return <p className="p-6">Cargando...</p>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{data.user.name}</h1>
        <button
          onClick={handleDelete}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
        >
          Eliminar usuario
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <p>
          <strong>WhatsApp:</strong> {data.user.whatsapp}
        </p>
        <p>
          <strong>Email:</strong> {data.user.email || "—"}
        </p>
        <p>
          <strong>Total citas:</strong> {data.appointments.length}
        </p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="font-semibold mb-4">Historial de citas</h2>

        <ul className="space-y-2">
          {data.appointments.map((a: any) => (
            <li key={a._id} className="border p-2 rounded flex justify-between">
              <span>{a.date}</span>
              <span>{a.time}</span>
            </li>
          ))}
        </ul>
      </div>
        <ConfirmModal
          open={confirmOpen}
          title="¿Seguro que deseas eliminar este usuario?"
          description="Esta acción no se puede deshacer."
          confirmText="Eliminar"
          cancelText="Cancelar"
          loading={loading}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmOpen(false)}
        />

        <ConfirmModal
          open={infoOpen}
          title={infoData?.title}
          description={infoData?.description}
          confirmText="Cerrar"
          cancelText=""
          onConfirm={() => setInfoOpen(false)}
          onCancel={() => setInfoOpen(false)}
        />
    </div>
  );
}
