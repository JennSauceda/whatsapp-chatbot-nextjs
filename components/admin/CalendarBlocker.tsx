"use client";

import { useState, useEffect } from "react";
import Calendar from "react-calendar";

import "react-calendar/dist/Calendar.css";

type Value = Date | null;

type BlockedDate = {
  date: string;
};

interface CalendarBlockerProps {
  blockedDates?: BlockedDate[];
  onBlockedDatesChange?: (dates: BlockedDate[]) => void;
  onDateToggle?: () => void;
}

export default function CalendarBlocker({
  blockedDates: externalBlockedDates,
  onBlockedDatesChange,
  onDateToggle,
}: CalendarBlockerProps) {
  const [value, setValue] = useState<Value>(null);
  const [internalBlockedDates, setInternalBlockedDates] = useState<
    BlockedDate[]
  >([]);

  // Usar fechas externas si se proporcionan, si no usar internas
  const blockedDates = externalBlockedDates || internalBlockedDates;

  async function loadBlockedDates() {
    const res = await fetch("/api/admin/blocked-dates");
    const data = await res.json();

    if (onBlockedDatesChange) {
      // Si hay callback externo, actualizar padre
      onBlockedDatesChange(data);
    } else {
      // Si no, actualizar estado interno
      setInternalBlockedDates(data);
    }
  }

  useEffect(() => {
    loadBlockedDates();
  }, []);

  function formatDate(date: Date) {
    return date.toISOString().split("T")[0];
  }

  async function toggleBlock(date: Date) {
    const formatted = formatDate(date);
    const isBlocked = blockedDates.some((d) => d.date === formatted);

    if (isBlocked) {
      await fetch("/api/admin/blocked-dates", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: formatted }),
      });
    } else {
      await fetch("/api/admin/blocked-dates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: formatted }),
      });
    }

    await loadBlockedDates();

    // Llamar al callback de toggle si existe
    if (onDateToggle) {
      onDateToggle();
    }
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow space-y-4">
      <h2 className="text-lg font-semibold">Bloquear / Desbloquear días</h2>

      <Calendar
        onChange={(newValue) => {
          setValue(newValue as Date);

          if (newValue instanceof Date) {
            toggleBlock(newValue);
          }
        }}
        value={value}
        tileClassName={({ date, view }) => {
          if (view !== "month") return "";

          const formatted = formatDate(date);
          const isBlocked = blockedDates.some((d) => d.date === formatted);

          if (!isBlocked) return "";

          return "blocked-day";
        }}
      />
    </div>
  );
}
