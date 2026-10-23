import mongoose from 'mongoose';
import { teamStatuses } from '../validators/teamMember.js';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  role: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, trim: true, maxlength: 254, default: '' },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  status: { type: String, enum: teamStatuses, default: 'Active', required: true }
}, { timestamps: true });

export const TeamMember = mongoose.model('TeamMember', schema);
