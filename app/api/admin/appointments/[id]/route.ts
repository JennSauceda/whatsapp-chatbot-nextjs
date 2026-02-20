import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import { verifyAdmin } from "@/lib/auth";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;

  await connectDB();
  await Appointment.findByIdAndDelete(id);

  return NextResponse.json({ success: true });
}
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await context.params;
  const { date, time } = await req.json();

  if (!date || !time) {
    return NextResponse.json(
      { error: "Fecha y hora requeridas" },
      { status: 400 },
    );
  }

  await connectDB();

  // Verificar conflicto
  const conflict = await Appointment.findOne({ date, time });

  if (conflict && conflict._id.toString() !== id) {
    return NextResponse.json({ error: "Horario ya ocupado" }, { status: 409 });
  }

  await Appointment.findByIdAndUpdate(id, { date, time });

  return NextResponse.json({ success: true });
}
