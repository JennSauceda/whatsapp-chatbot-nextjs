"use client";

import { useEffect, useState } from "react";

type User = {
  _id: string;
  name: string;
  whatsapp: string;
  email?: string;
  createdAt: string;
  totalAppointments: number;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");

  async function loadUsers() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = users.filter((u) =>
    `${u.name} ${u.whatsapp}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Usuarios</h1>

      <input
        type="text"
        placeholder="Buscar por nombre o WhatsApp"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="border p-2 rounded w-full md:w-1/3"
      />

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-3">Nombre</th>
              <th className="p-3">WhatsApp</th>
              <th className="p-3">Email</th>
              <th className="p-3">Registro</th>
              <th className="p-3">Citas</th>
              <th className="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user._id} className="border-t">
                <td className="p-3">{user.name}</td>
                <td className="p-3">{user.whatsapp}</td>
                <td className="p-3">{user.email || "—"}</td>
                <td className="p-3">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>

                {/* NUEVA COLUMNA */}
                <td className="p-3 font-semibold">{user.totalAppointments}</td>

                {/* BOTÓN DETALLE */}
                <td className="p-3">
                  <button
                    onClick={() =>
                      (window.location.href = `/admin/users/${user._id}`)
                    }
                    className="text-blue-600 hover:underline"
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
