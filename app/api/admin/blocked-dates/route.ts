import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import BlockedDate from "@/models/BlockedDate";
import { verifyAdmin } from "@/lib/auth";

export async function GET() {
  await connectDB();
  const blocked = await BlockedDate.find().lean();
  return NextResponse.json(blocked);
}

export async function POST(req: Request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await connectDB();

  const { date, reason } = await req.json();

  try {
    const blocked = await BlockedDate.create({ date, reason });
    return NextResponse.json(blocked);
  } catch (error) {
    return NextResponse.json(
      { error: "Ese día ya está bloqueado" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  await connectDB();

  const { date } = await req.json();
  await BlockedDate.deleteOne({ date });

  return NextResponse.json({ success: true });
}
