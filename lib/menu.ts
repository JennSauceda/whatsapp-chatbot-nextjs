import User from "@/models/User"

export async function isRegistered(whatsapp: string) {
  const user = await User.findOne({ whatsapp })
  return user
}
