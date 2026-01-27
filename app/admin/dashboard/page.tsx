import StatCard from "@/components/admin/StatCard";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Usuarios registrados" value="—" />
        <StatCard title="Citas activas" value="—" />
        <StatCard title="Citas hoy" value="—" />
      </div>
    </div>
  );
}
