import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  sessionVersion: { type: String, default: '' }
}, { timestamps: true });

export const Admin = mongoose.model('Admin', schema);
