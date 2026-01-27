"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // useEffect(() => {
  //   fetch("/api/auth/me").then((res) => {
  //     if (res.ok) router.replace("/admin/dashboard");
  //   });
  // }, []);

  const login = async () => {
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      try {
        const errorData = await res.json();
        setError(errorData.error || "Error desconocido");
      } catch {
        setError("Error al conectar con el servidor");
      }
      return;
    }
    console.log("Login exitoso");
    router.push("/admin/dashboard");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-2 text-center text-2xl font-bold">
          Panel Administrativo
        </h1>

        <p className="mb-6 text-center text-sm text-gray-500">
          Acceso exclusivo para administradores
        </p>

        {error && (
          <div className="mb-4 rounded bg-red-100 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Correo electrónico
            </label>
            <input
              type="email"
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:border-black focus:outline-none"
              placeholder="admin@correo.com"
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded-lg border px-3 py-2 focus:border-black focus:outline-none"
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            onClick={login}
            disabled={loading}
            className="w-full rounded-lg bg-black py-2 text-white transition hover:bg-gray-900 disabled:opacity-50"
          >
            {loading ? "Ingresando…" : "Entrar"}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Sistema de Citas
        </p>
      </div>
    </div>
  );
}
