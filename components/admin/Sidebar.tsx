import Link from "next/link";

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white shadow-lg">
      <div className="p-6 font-bold text-xl border-b">
        WhatsApp Admin
      </div>

      <nav className="p-4 space-y-2">
        <Link href="/admin/dashboard" className="block p-2 rounded hover:bg-gray-100">
          📊 Dashboard
        </Link>

        <Link href="/admin/appointments" className="block p-2 rounded hover:bg-gray-100">
          📅 Citas
        </Link>

        <Link href="/admin/users" className="block p-2 rounded hover:bg-gray-100">
          👤 Usuarios
        </Link>
      </nav>
    </aside>
  );
}
