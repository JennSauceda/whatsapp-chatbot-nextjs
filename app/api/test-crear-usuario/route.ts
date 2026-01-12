import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await connectDB();

    const timestamp = Date.now();
    const phone = `+1000${String(timestamp).slice(-9)}`;
    const name = `Test User ${timestamp}`;
    const email = `test.user.${timestamp}@example.com`;

    const user = await User.create({ phone, name, email });

    return NextResponse.json(
      { message: "User created (test)", user },
      { status: 201 }
    );
  } catch (err: unknown) {
    const error = err as { code?: number; message?: string };
    if (error?.code === 11000) {
      return NextResponse.json({ error: "User already exists" }, { status: 409 });
    }
    return NextResponse.json(
      { error: error?.message ?? "Server error" },
      { status: 500 }
    );
  }
}
