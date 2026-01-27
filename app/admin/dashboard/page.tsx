"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/admin/StatCard";

type Stats = {
  totalUsers: number;
  totalAppointments: number;
  todayAppointments: number;
  nextAppointment?: {
    date: string;
    time: string;
  };
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return <p className="p-6">Cargando estadísticas…</p>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <Link href="/admin/appointments">Ver citas</Link>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Usuarios registrados" value={stats.totalUsers} />

        <StatCard title="Citas totales" value={stats.totalAppointments} />

        <StatCard title="Citas hoy" value={stats.todayAppointments} />

        <StatCard
          title="Próxima cita"
          value={
            stats.nextAppointment
              ? `${stats.nextAppointment.date} ${stats.nextAppointment.time}`
              : "—"
          }
          subtitle="Fecha más cercana"
        />
      </div>
    </div>
  );
}
