"use client";

import { useState, useEffect } from "react";
import Calendar from "react-calendar";

import "react-calendar/dist/Calendar.css";

type BlockedDate = {
  date: string;
};
interface CalendarBlockerProps {
  onDatesChange?: () => void;
}

export default function CalendarBlocker({
  onDatesChange,
}: CalendarBlockerProps) {
  const [value, setValue] = useState<Value>(null);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);

  async function loadBlockedDates() {
    const res = await fetch("/api/admin/blocked-dates");
    const data = await res.json();
    setBlockedDates(data);
    if (onDatesChange) {
      onDatesChange();
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

    loadBlockedDates();
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow space-y-4">
      <h2 className="text-lg font-semibold">Bloquear / Desbloquear días</h2>

      <Calendar
        onChange={(newValue) => {
          setValue(newValue);

          if (newValue instanceof Date) {
            toggleBlock(newValue);
          }
        }}
        value={value}
        tileClassName={({ date }) => {
          const formatted = formatDate(date);
          const isBlocked = blockedDates.some((d) => d.date === formatted);

          return isBlocked ? "bg-red-500 text-white rounded-lg" : "";
        }}
      />
    </div>
  );
}
