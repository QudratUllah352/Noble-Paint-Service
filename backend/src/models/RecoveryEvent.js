import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  action: { type: String, enum: ['release-lock'], required: true },
  target: { type: String, required: true },
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  outcome: { type: String, enum: ['Pending', 'Applied', 'Unchanged'], required: true }
}, { timestamps: true });

export const RecoveryEvent = mongoose.model('RecoveryEvent', schema);
