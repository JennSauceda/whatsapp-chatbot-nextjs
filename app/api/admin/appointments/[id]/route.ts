import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import { verifyAdmin } from "@/lib/auth";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
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
