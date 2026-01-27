import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import Admin from "@/models/Admin";

export async function POST(req: Request) {
  if (req.headers.get("x-setup-key") !== process.env.SETUP_KEY) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await connectDB();

  // 1️⃣ Verificar si ya existe un admin
  const existingAdmin = await Admin.findOne();

  if (existingAdmin) {
    return NextResponse.json(
      { error: "Ya existe un administrador" },
      { status: 403 },
    );
  }

  // 2️⃣ Leer datos
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Faltan datos requeridos" },
      { status: 400 },
    );
  }

  // 3️⃣ Hashear password
  const passwordHash = await bcrypt.hash(password, 10);

  // 4️⃣ Crear superadmin
  await Admin.create({
    name,
    email,
    passwordHash,
    role: "superadmin",
  });

  return NextResponse.json({
    success: true,
    message: "Administrador creado correctamente",
  });
}
