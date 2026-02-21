"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatCard from "@/components/admin/StatCard";
import StatsCharts from "@/components/admin/StatsCharts";

type Stats = {
  totalUsers: number;
  totalAppointments: number;
  todayAppointments: number;
  weekAppointments: number;
  nextAppointment?: {
    date: string;
    time: string;
  };
  topHours: { _id: string; count: number }[];
  perDay: { _id: string; count: number }[];
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
        <StatCard title="Citas esta semana" value={stats.weekAppointments} />

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
      <StatsCharts perDay={stats.perDay} topHours={stats.topHours} />
      <div className="rounded-xl bg-white p-5 shadow-sm border">
        <h2 className="text-lg font-semibold mb-2">Horas más solicitadas</h2>
        <ul className="space-y-1">
          {stats.topHours.map((h) => (
            <li key={h._id} className="flex justify-between">
              <span>{h._id}</span>
              <span>{h.count} citas</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm border">
        <h2 className="text-lg font-semibold mb-2">Últimos 7 días</h2>
        <ul className="space-y-1">
          {stats.perDay.map((d) => (
            <li key={d._id} className="flex justify-between">
              <span>{d._id}</span>
              <span>{d.count}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
