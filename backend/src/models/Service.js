import mongoose from 'mongoose';
import { serviceCategories, serviceStatuses } from '../validators/service.js';

const schema = new mongoose.Schema({
  seedKey: { type: String, unique: true, sparse: true },
  title: { type: String, required: true, maxlength: 160 },
  description: { type: String, required: true, maxlength: 2000 },
  categories: [{ type: String, enum: serviceCategories }],
  features: [{ type: String, maxlength: 200 }],
  imageUrl: { type: String, maxlength: 2048, default: '' },
  imageAlt: { type: String, maxlength: 500, default: '' },
  badge: { type: String, maxlength: 60, default: '' },
  sortOrder: { type: Number, min: 0, max: 10000, required: true },
  status: { type: String, enum: serviceStatuses, default: 'Active', required: true }
}, { timestamps: true });

export const Service = mongoose.model('Service', schema);
