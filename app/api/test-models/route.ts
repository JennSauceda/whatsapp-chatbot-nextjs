import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { NextResponse } from "next/server";

export async function GET() {
  await connectDB();

  const count = await User.countDocuments();

  return NextResponse.json({
    message: "Models working",
    users: count,
  });
}

