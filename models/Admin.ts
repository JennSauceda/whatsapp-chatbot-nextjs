import { Schema, model, models } from 'mongoose'

const AdminSchema = new Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: {
    type: String,
    enum: ['admin', 'superadmin'],
    default: 'admin',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

export default models.Admin || model('Admin', AdminSchema)
