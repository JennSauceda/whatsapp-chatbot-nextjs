import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { verifyAdmin } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    await connectDB();

    // Eliminar índice problemático phone_1 si existe
    try {
      await User.collection.dropIndex("phone_1");
      console.log("Índice phone_1 eliminado");
    } catch (err) {
      console.log("Índice phone_1 no encontrado o ya eliminado");
    }

    // Eliminar índice phone si existe
    try {
      await User.collection.dropIndex("phone");
      console.log("Índice phone eliminado");
    } catch (err) {
      console.log("Índice phone no encontrado o ya eliminado");
    }

    // Asegurarse de que el índice correcto existe (whatsapp)
    await User.collection.dropIndex("whatsapp_1").catch(() => {});
    await User.collection.createIndex({ whatsapp: 1 }, { unique: true, sparse: true });

    // Eliminar documentos sin whatsapp
    await User.deleteMany({ whatsapp: { $exists: false } });
    await User.deleteMany({ whatsapp: null });
    await User.deleteMany({ whatsapp: "" });

    return NextResponse.json({ 
      success: true,
      message: "Índices corregidos correctamente" 
    });
  } catch (error) {
    console.error("Fix indexes error:", error);
    return NextResponse.json(
      { error: "Error al corregir índices: " + error },
      { status: 500 },
    );
  }
}
