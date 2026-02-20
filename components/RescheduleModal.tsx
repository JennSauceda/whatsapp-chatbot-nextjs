"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  appointmentId: string | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function RescheduleModal({
  open,
  appointmentId,
  onClose,
  onSuccess,
}: Props) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [available, setAvailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!date) return;

    const load = async () => {
      const res = await fetch(`/api/admin/appointments/available?date=${date}`);

      if (res.ok) {
        const data = await res.json();
        setAvailable(data.available);
      }
    };

    load();
  }, [date]);

  const submit = async () => {
    if (!appointmentId) return;

    setLoading(true);
    setError("");

    const res = await fetch(`/api/admin/appointments/${appointmentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, time }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Error al reprogramar");
      return;
    }

    onSuccess();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold">Reprogramar cita</h2>

        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

        <div className="mt-4 grid gap-4">
          <input
            type="date"
            className="input"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setTime("");
            }}
          />

          <select
            className="input"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            disabled={!available.length}
          >
            <option value="">Selecciona hora</option>
            {available.map((hour) => (
              <option key={hour} value={hour}>
                {hour}
              </option>
            ))}
          </select>

          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="rounded border px-4 py-2">
              Cancelar
            </button>

            <button
              onClick={submit}
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-white"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
