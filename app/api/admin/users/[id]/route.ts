import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Appointment from "@/models/Appointment";
import { verifyAdmin } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await connectDB();

  const resolvedParams = await params;
  const user = await User.findById(resolvedParams.id).lean();

  if (!user) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const appointments = await Appointment.find({
    userWhatsapp: user.whatsapp,
  })
    .sort({ date: -1 })
    .lean();

  return NextResponse.json({
    user,
    appointments,
  });
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await connectDB();

  const resolvedParams = await params;
  const user = await User.findById(resolvedParams.id);

  if (!user) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  // Eliminar citas del usuario (por whatsapp)
  await Appointment.deleteMany({ userWhatsapp: user.whatsapp });

  // Eliminar usuario
  await User.findByIdAndDelete(resolvedParams.id);

  return NextResponse.json({ success: true });
}
