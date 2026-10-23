import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  _id: String,
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });

export const OperationLock = mongoose.model('OperationLock', schema);
