import User from "@/models/User";

type CreateUserInput = {
  whatsapp: string;
  name: string;
  email?: string;
};

export async function findOrCreateUser({
  whatsapp,
  name,
  email,
}: CreateUserInput) {
  let user = await User.findOne({ whatsapp });

  if (!user) {
    user = await User.create({
      whatsapp,
      name,
      email,
    });
  }

  return user;
}
