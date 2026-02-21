"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewAppointmentPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    whatsapp: "",
    name: "",
    email: "",
    date: "",
    time: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableHours, setAvailableHours] = useState<string[]>([]);

  const submit = async () => {
    setError("");
    setLoading(true);

    console.log(form);
    const res = await fetch("/api/admin/appointments/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    const text = await res.text();

    if (!res.ok) {
      try {
        const data = JSON.parse(text);
        setError(data.error || "Error al crear cita");
      } catch {
        setError("Error al crear cita");
      }
      return;
    }

    router.push("/admin/appointments");
  };

  return (
    <div className="p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-4">Nueva cita</h1>

      {error && (
        <div className="mb-4 rounded bg-red-100 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        <input
          placeholder="WhatsApp (52...)"
          className="input"
          onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          required
        />
        <input
          placeholder="Nombre"
          className="input"
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          placeholder="Correo electrónico"
          className="input"
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="date"
          className="input"
          onChange={async (e) => {
            const date = e.target.value;
            setForm({ ...form, date, time: "" });
            setAvailableHours([]);

            if (!date) return;
            const blockedDates = await fetch("/api/admin/blocked-dates").then(
              (res) => res.json(),
            );
            const isBlocked = blockedDates.some(
              (d: any) => d.date === date,
            );

            if (isBlocked) {
              setAvailableHours([]);
              return;
            }

            const res = await fetch(
              `/api/admin/appointments/available?date=${date}`,
            );

            if (res.ok) {
              const data = await res.json();
              setAvailableHours(data.available);
            }
          }}
          required
        />

        <select
          className="input"
          value={form.time}
          onChange={(e) => setForm({ ...form, time: e.target.value })}
          disabled={availableHours.length === 0}
          required
        >
          <option value="">Selecciona una hora</option>

          {availableHours.map((hour) => (
            <option key={hour} value={hour}>
              {hour}
            </option>
          ))}
        </select>
        {form.date && availableHours.length === 0 && (
          <p className="text-sm text-red-600">
            No hay horarios disponibles para esta fecha
          </p>
        )}

        <button
          onClick={submit}
          disabled={loading}
          className="rounded-lg bg-black py-2 text-white"
        >
          {loading ? "Guardando..." : "Crear cita"}
        </button>
      </div>
    </div>
  );
}
