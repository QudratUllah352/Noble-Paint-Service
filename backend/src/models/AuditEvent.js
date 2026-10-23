import mongoose from 'mongoose';
import { auditActions, auditOutcomes } from '../services/audit.js';

const schema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  actorEmail: { type: String, maxlength: 254 },
  action: { type: String, enum: auditActions, required: true },
  target: { type: String, required: true, maxlength: 200 },
  fields: [{ type: String, maxlength: 100 }],
  outcome: { type: String, enum: auditOutcomes, required: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
  finishedAt: Date
}, { versionKey: false });
schema.index({ createdAt: -1, _id: -1 });
schema.index({ action: 1, createdAt: -1 });
export const AuditEvent = mongoose.model('AuditEvent', schema);
