// import { connectDB } from "@/lib/mongodb";
// import { NextResponse } from "next/server";

// export async function GET() {
//   await connectDB();
//   return NextResponse.json({ status: "DB connected" });
// }
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Appointment from "@/models/Appointment";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await connectDB();
    const total = await User.countDocuments();
    const appointments = await Appointment.countDocuments();
    return NextResponse.json({
      ok: true,
      users: total,
      appointments,
    });

    return NextResponse.json({
      ok: true,
      users: total,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: "Error con el modelo User",
    });
  }
}
