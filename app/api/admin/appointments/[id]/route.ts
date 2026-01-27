import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Appointment from "@/models/Appointment";
import { verifyAdmin } from "@/lib/auth";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const admin = await verifyAdmin();
  if (!admin) {
  return NextResponse.json([], { status: 401 });
}

  await connectDB();
  await Appointment.findByIdAndDelete(params.id);

  return NextResponse.json({ success: true });
}
