import { connectDB } from "@/lib/mongodb";
import User from "@/models/User";
import { NextResponse } from "next/server";
import {sendMessage} from "@/lib/whatsapp";

export async function GET() {
 

 
 const response= await sendMessage(
  "52tu_numero_de_prueba",
  "🚀 Prueba de envío desde lib/whatsapp"
);



  return NextResponse.json({
    message: response

  });
}

