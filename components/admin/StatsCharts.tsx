"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type Props = {
  perDay: { _id: string; count: number }[];
  topHours: { _id: string; count: number }[];
};

export default function StatsCharts({ perDay, topHours }: Props) {
  const formattedPerDay = perDay.map((d) => ({
    date: d._id,
    citas: d.count,
  }));

  const formattedHours = topHours.map((h) => ({
    hora: h._id,
    citas: h.count,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
      {/* Gráfica línea - Últimos 7 días */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4">Citas últimos 7 días</h2>

        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formattedPerDay}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="citas" stroke="#2563eb" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Gráfica barras - Horas más usadas */}
      <div className="bg-white p-4 rounded-xl shadow">
        <h2 className="text-lg font-semibold mb-4">Horas más solicitadas</h2>

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={formattedHours}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hora" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="citas" fill="#16a34a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
