import mongoose from 'mongoose';
import { areas, projectTypes, windows } from '../validators/consultation.js';
import { enquiryStatuses } from '../validators/enquiryStatus.js';

const schema = new mongoose.Schema({
  fullName: { type: String, required: true, maxlength: 120 },
  emailAddr: { type: String, required: true, maxlength: 254 },
  phoneNumber: { type: String, required: true, maxlength: 40 },
  source: { type: String, enum: ['contact', 'homepage'], default: 'contact' },
  sqft: { type: String, required() { return this.source !== 'homepage'; }, enum: areas },
  selectedProjectType: { type: String, required: true, enum: projectTypes },
  consultDate: String,
  consultTime: { type: String, required() { return this.source !== 'homepage'; }, enum: windows },
  projectDetails: { type: String, maxlength: 5000 },
  adminNotes: { type: String, maxlength: 5000, default: '' },
  status: { type: String, enum: ['pending', ...enquiryStatuses], default: 'New' }
}, { timestamps: true });

export const Consultation = mongoose.model('Consultation', schema);
