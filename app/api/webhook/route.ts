import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import Appointment from "@/models/Appointment";
import { isValidDate } from "@/lib/validators";
import { isValidTime } from "@/lib/validators";
import { BASE_HOURS } from "@/lib/availableHours";

type Session = {
  step: string;
  name?: string;
  email?: string;
  date?: string;
  time?: string;
  available?: string[];
  selectedTime?: string;
  cancelAppointmentId?: string;
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
    reply = await buildMenu(from);
    session.step = "AWAITING_MENU";
  } else if (session.step === "AWAITING_MENU") {
    reply = await accionesMenu(from, text, session);
  } else if (session.step === "EDIT_INFO") {
    reply = await accionesEditarInfo(text, session);
  } else if (session.step === "EDIT_EMAIL") {
    reply = await editarCorreo(from, text, session);
  }
  else if (session.step === "EDIT_NAME") {
    reply = await editarNombre(from, text, session);
  } else if (text === "cancelar") {
    session.step = "DONE";
    reply = "❌ Acción cancelada.\n\nEscribe *menu* para comenzar de nuevo.";
  } else if (session.step === "AWAITING_MENU") {
    if (message.text?.body === "1") {
      reply = "📛 ¿Cuál es tu nombre?";
      session.step = "REGISTER_NAME";
    } else if (message.text?.body === "2") {
      const user = await User.findOne({ whatsapp: from });

      if (!user) {
        reply =
          "❌ Debes registrarte primero.\n\n" + "Escribe *menu* y elige 1️⃣";
        session.step = "DONE";
      } else {
        session.step = "APPOINTMENT_DATE";
        reply = "📅 ¿Qué fecha deseas? (YYYY-MM-DD)";
      }
    } else if (message.text?.body === "3") {
      const appointment = await Appointment.findOne({
        userWhatsapp: from,
      }).sort({ createdAt: -1 });

      if (!appointment) {
        await sendMessage(
          from,
          "❌ No tienes ninguna cita agendada.\nEscribe *menu* para volver.",
        );
        return NextResponse.json({ ok: true });
      }

      await sendMessage(
        from,
        `📋 *Tu cita*

📅 Fecha: ${appointment.date}
⏰ Hora: ${appointment.time}`,
      );

      return NextResponse.json({ ok: true });
    } else if (message.text?.body === "4") {
      const appointment = await Appointment.findOne({
        userWhatsapp: from,
      }).sort({ createdAt: -1 });

      if (!appointment) {
        await sendMessage(
          from,
          "❌ No tienes citas para cancelar.\nEscribe *menu*.",
        );
        return NextResponse.json({ ok: true });
      }

      session.cancelAppointmentId = appointment._id.toString();
      session.step = "CONFIRM_CANCEL";

      await sendMessage(
        from,
        `⚠️ *Cancelar cita*

📅 Fecha: ${appointment.date}
⏰ Hora: ${appointment.time}

1️⃣ Confirmar cancelación
2️⃣ Volver al menú`,
      );

      return NextResponse.json({ ok: true });
    } else {
      reply = "❌ Opción inválida. Escribe 1, 2, 3 o 4.";
    }
  } else if (session.step === "REGISTER_NAME") {
    session.name = text;
    reply =
      "📧 ¿Cuál es tu correo?\n\n" + "✳️ Escribe *menu* para volver al menú";
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
  } else if (session.step === "APPOINTMENT_DATE") {
    if (!isValidDate(text)) {
      reply =
        "❌ Fecha inválida.\n\n" +
        "Usa el formato *YYYY-MM-DD*\n" +
        "Ejemplo: 2026-01-20\n\n" +
        "O escribe *cancelar*";
      console.log("Fecha inválida recibida:", text);
      await sendMessage(from, reply);
      return NextResponse.json({ ok: true });
    }

    session.date = text;
    session.step = "APPOINTMENT_TIME";

    const appointments = await Appointment.find({ date: session.date });
    const occupied = appointments.map((a) => a.time);
    const available = BASE_HOURS.filter((hour) => !occupied.includes(hour));

    if (available.length === 0) {
      await sendMessage(
        from,
        `❌ No hay horarios disponibles para esta fecha.

Escribe *menu* para volver al menú`,
      );
      return NextResponse.json({ ok: true });
    }

    let message = `⏰ Horarios disponibles para ${session.date}\n\n`;

    available.forEach((hour, index) => {
      message += `${index + 1}️⃣ ${hour}\n`;
    });

    message += `\nResponde con el número del horario\nEscribe *menu* para cancelar`;

    session.available = available;
    await sendMessage(from, message);
    return NextResponse.json({ ok: true });
  } else if (session.step === "APPOINTMENT_TIME") {
    const option = parseInt(text);

    if (
      isNaN(option) ||
      option < 1 ||
      option > (session.available?.length || 0)
    ) {
      await sendMessage(from, "❌ Opción inválida. Elige un número válido.");
      return NextResponse.json({ ok: true });
    }

    const selectedTime = session.available![option - 1];
    session.time = selectedTime;
    session.selectedTime = selectedTime;
    session.step = "CONFIRM_APPOINTMENT";

    await sendMessage(
      from,
      `📋 *Resumen de tu cita*

📅 Fecha: ${session.date}
⏰ Hora: ${session.selectedTime}

1️⃣ Confirmar
2️⃣ Cancelar`,
    );

    return NextResponse.json({ ok: true });
  } else if (session.step === "CONFIRM_APPOINTMENT") {
    if (message.text?.body === "1") {
      try {
        await Appointment.create({
          userWhatsapp: from,
          date: session.date,
          time: session.selectedTime,
        });

        await sendMessage(
          from,
          `✅ *Cita confirmada*

📅 ${session.date}
⏰ ${session.selectedTime}

Gracias 🙌`,
        );
      } catch (error: any) {
        if (error.code === 11000) {
          await sendMessage(
            from,
            `❌ Ese horario ya fue ocupado.
Intenta con otro horario.`,
          );
        } else {
          await sendMessage(from, `⚠️ Ocurrió un error al guardar tu cita`);
        }
      }

      session.step = "DONE";
      return NextResponse.json({ ok: true });
    }

    if (message.text?.body === "2") {
      session.step = "DONE";
      await sendMessage(
        from,
        `❌ Cita cancelada.
Escribe *menu* para volver al inicio.`,
      );
      return NextResponse.json({ ok: true });
    }

    await sendMessage(from, "❌ Opción inválida. Responde 1 o 2.");
    return NextResponse.json({ ok: true });
  } else if (session.step === "CONFIRM_CANCEL") {
    if (message.text?.body === "1") {
      await Appointment.findByIdAndDelete(session.cancelAppointmentId);

      await sendMessage(from, "✅ Tu cita ha sido cancelada.");

      session.step = "DONE";
      return NextResponse.json({ ok: true });
    }

    if (message.text?.body === "2") {
      session.step = "DONE";
      await sendMessage(from, "Volviendo al menú…");
      return NextResponse.json({ ok: true });
    }

    await sendMessage(from, "❌ Opción inválida. Responde 1 o 2.");
    return NextResponse.json({ ok: true });
  } else if (session.step === "DONE") {
    reply = "👋 ¡Hola!\n\n" + "Si deseas otra opción escribe *menu*";
  }

  await sendMessage(from, reply);

  return NextResponse.json({ ok: true });
}
async function buildMenu(from: string) {
  const user = await User.findOne({ whatsapp: from });
  const appointment = await Appointment.findOne({ userWhatsapp: from });

  let menu = "👋 *Menú principal*\n\n";

  if (!user) {
    menu += "1️⃣ Registrarme\n";
  } else {
    menu += "1️⃣ Editar mi información ✏️\n";
  }

  if (user) {
    menu += "2️⃣ Agendar cita\n";
  }

  if (appointment) {
    menu += "3️⃣ Ver mi cita\n";
    menu += "4️⃣ Cancelar mi cita\n";
  }

  menu += "\nEscribe el número de la opción";

  return menu;
}

async function accionesMenu(from: string, text: string, session: Session) {
  const user = await User.findOne({ whatsapp: from });
  const appointment = await Appointment.findOne({ userWhatsapp: from });

  let reply = "accion no valida";
  if (!user && text === "1") {
    session.step = "REGISTER_NAME";
    reply = "📛 ¿Cuál es tu nombre?";
  } else if (user && text === "1") {
    session.step = "EDIT_INFO";

    reply = "1️⃣ Editar mi nombre ✏️\n";
    reply += "2️⃣ Editar correo ✏️";
  } else if (user && text === "2") {
    session.step = "APPOINTMENT_DATE";
    reply = "📅 ¿Qué fecha deseas? (YYYY-MM-DD)";
  } else if (appointment && text === "3") {
    reply = `📋 Tu cita\n\n 📅 ${appointment.date}\n⏰ ${appointment.time}`;
  } else if (appointment && text === "4") {
    session.cancelAppointmentId = appointment._id.toString();
    session.step = "CONFIRM_CANCEL";
    reply = "⚠️ ¿Confirmas cancelar?\n1️⃣ Sí\n2️⃣ No";
  } else {
    reply = "❌ Opción inválida";
  }
  return reply;
}
async function accionesEditarInfo(text: string, session: Session) {

  let reply = "accion no valida";

  if (text === "1") {
    session.step = "EDIT_NAME";
    reply = "Introduce nuevo nombre";
  } else if (text === "2") {
    session.step = "EDIT_EMAIL";
    reply = "Introduce nuevo correo";
  } else {
    reply = "❌ Opción inválida";
  }
  return reply;
}
async function editarNombre(from: string, text: string, session: Session) {
  let reply = "accion no valida";

  await User.updateOne({ whatsapp: from }, { name: text });

  reply = "✅ Nombre actualizado\n\n ";
  reply += await buildMenu(from);
  session.step = "AWAITING_MENU";
  return reply;
}
async function editarCorreo(from: string, text: string, session: Session) {
  let reply = "accion no valida";

  await User.updateOne({ whatsapp: from }, { email: text });

  reply = "✅ Correo actualizado\n\n ";
  reply += await buildMenu(from);
  session.step = "AWAITING_MENU";
  return reply;
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
    },
  );

  const data = await res.json();
  console.log("WHATSAPP RESPONSE:", data);
}
