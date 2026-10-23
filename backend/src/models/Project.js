import mongoose from 'mongoose';
import { projectStatuses } from '../validators/project.js';

const schema = new mongoose.Schema({
  consultation: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, unique: true },
  customerName: { type: String, required: true, maxlength: 120 },
  title: { type: String, required: true, maxlength: 160 },
  scope: { type: String, maxlength: 5000, default: '' },
  assignedMember: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember', required: true },
  assignedTo: { type: String, required: true, maxlength: 120 },
  startDate: { type: String, default: '' },
  targetDate: { type: String, default: '' },
  status: { type: String, required: true, enum: projectStatuses, default: 'Planned' }
}, { timestamps: true });

export const Project = mongoose.model('Project', schema);
