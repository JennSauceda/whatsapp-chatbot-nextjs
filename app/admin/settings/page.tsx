"use client";

import { useState, useEffect } from "react";
import CalendarBlocker from "@/components/admin/CalendarBlocker";

export default function AdminSettingsPage() {
  const [date, setDate] = useState("");
  const [blockedDates, setBlockedDates] = useState<any[]>([]);

  async function loadBlockedDates() {
    const res = await fetch("/api/admin/blocked-dates");
    const data = await res.json();
    setBlockedDates(data);
  }

  useEffect(() => {
    loadBlockedDates();
  }, []);

  async function blockDate() {
    if (!date) return;

    const res = await fetch("/api/admin/blocked-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });

    if (res.ok) {
      setDate("");
      loadBlockedDates();
    } else {
      alert("Ese día ya está bloqueado");
    }
  }

  async function unblockDate(date: string) {
    await fetch("/api/admin/blocked-dates", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    });

    loadBlockedDates();
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Configuración</h1>

      <div className="bg-white p-4 rounded-xl shadow space-y-4">
        <h2 className="font-semibold">Bloquear día completo</h2>

        <div className="flex gap-2">
          
          <CalendarBlocker />
         
        </div>

        <div>
          <h3 className="mt-4 font-medium">Días bloqueados</h3>
          <ul className="space-y-2 mt-2">
            {blockedDates.map((d) => (
              <li
                key={d.date}
                className="flex justify-between items-center border p-2 rounded"
              >
                <span>{d.date}</span>
                <button
                  onClick={() => unblockDate(d.date)}
                  className="text-red-600"
                >
                  Desbloquear
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
