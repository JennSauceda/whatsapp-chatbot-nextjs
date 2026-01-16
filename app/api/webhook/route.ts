import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";

type Session = {
  step: string;
  name?: string;
  email?: string;
};

const sessions = new Map<string, Session>();

/* =========================
   VERIFICACIÓN DEL WEBHOOK
========================= */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  console.log(req);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}
console.log("servidor listo");
/* =========================
   POST SIMPLE (PASO 5.2)
========================= */
export async function POST(req: NextRequest) {
  await connectDB();

  console.log("WEBHOOK HIT");

  const body = await req.json();

  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  // Si no es un mensaje (por ejemplo status), salimos

  if (!message) {
    return NextResponse.json({ ok: true });
  }
  let from = message.from;
  let session = sessions.get(from);
  if (!session) {
    session = { step: "MENU" };
    sessions.set(from, session);
  }

  const text = message.text?.body?.toLowerCase();

  if (text === "menu") {
    session.step = "MENU";
  }

  // Remove extra 1 after country code 52 if present (e.g., 5214646540222 -> 524646540222)
  if (from.startsWith("5214")) {
    from = "52" + from.substring(3);
  }

  let reply = "";

  if (session.step === "MENU") {
    reply =
      "👋 Menú principal\n\n" +
      "1️⃣ Registrarme\n" +
      "2️⃣ Agendar cita\n\n" +
      "Escribe 1 o 2\n" +
      "Escribe *menu* en cualquier momento";

    session.step = "AWAITING_MENU";
  } else if (session.step === "AWAITING_MENU") {
    if (message.text?.body === "1") {
      reply = "📛 ¿Cuál es tu nombre?";
      session.step = "REGISTER_NAME";
    } else if (message.text?.body === "2") {
      reply = "📅 ¿Qué día deseas la cita?";
      session.step = "SCHEDULE_DATE";
    } else {
      reply = "❌ Opción inválida. Escribe 1 o 2.";
    }
  } else if (session.step === "REGISTER_NAME") {
    session.name = text;
    reply = "📧 ¿Cuál es tu correo?\n\n" + "✳️ Escribe *menu* para volver al menú";
    session.step = "REGISTER_EMAIL";
  } else if (session.step === "REGISTER_EMAIL") {
    session.email = text;

    const existingUser = await User.findOne({
      whatsapp: from,
    });

    if (existingUser) {
      reply = "⚠️ Ya estás registrado con este número.";
    } else {
      await User.create({
        whatsapp: from,
        name: session.name,
        email: session.email,
      });

      reply =
        "✅ Registro completo\n\n" +
        `Nombre: ${session.name}\n` +
        `Correo: ${session.email}\n\n` +
        "Gracias 🙌";
    }

    session.step = "DONE";
  } else if (session.step === "DONE") {
    reply = "👋 ¡Hola!\n\n" + "Si deseas otra opción escribe *menu*";
  }

  await sendMessage(from, reply);

  return NextResponse.json({ ok: true });
}

/* =========================
   FUNCIÓN PARA ENVIAR MENSAJES
========================= */
async function sendMessage(telephone: string, bodyText: string) {
  const res = await fetch(
    `https://graph.facebook.com/v22.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: telephone,
        type: "text",
        text: {
          preview_url: false,
          body: bodyText,
        },
      }),
    }
  );

  const data = await res.json();
  console.log("WHATSAPP RESPONSE:", data);
}
