import mongoose from 'mongoose';
import { appointmentStatuses } from '../validators/appointment.js';

const schema = new mongoose.Schema({
  consultation: { type: mongoose.Schema.Types.ObjectId, ref: 'Consultation', required: true, unique: true },
  startsAt: { type: Date, required: true, index: true },
  durationMinutes: { type: Number, min: 15, max: 480, default: 60, validate: value => Number.isInteger(value) && value % 15 === 0 },
  timeZone: { type: String, required: true, maxlength: 100 },
  address: { type: String, required: true, maxlength: 500 },
  assignedTo: { type: String, required: true, maxlength: 120 },
  assignedMember: { type: mongoose.Schema.Types.ObjectId, ref: 'TeamMember' },
  emailState: { type: String, enum: ['Idle', 'Sending', 'Accepted', 'Failed'], default: 'Idle' },
  emailVersion: String,
  emailAttemptId: String,
  emailHistory: [{
    _id: false,
    attemptId: String,
    version: String,
    type: { type: String, enum: appointmentStatuses },
    recipient: String,
    startedAt: Date,
    finishedAt: Date,
    status: { type: String, enum: ['Sending', 'Accepted', 'Failed'] },
    errorCode: String,
    recovery: {
      resolution: { type: String, enum: ['received', 'retry'] },
      admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      at: Date
    }
  }],
  status: { type: String, enum: appointmentStatuses, default: 'Scheduled', required: true }
}, { timestamps: true });
schema.index({ assignedMember: 1, status: 1, startsAt: 1 });

export const Appointment = mongoose.model('Appointment', schema);
