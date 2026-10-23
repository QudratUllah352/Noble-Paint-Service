import mongoose from 'mongoose';
import { Admin } from '../src/models/Admin.js';
import { hashPassword } from '../src/services/passwords.js';

try {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Set a valid ADMIN_EMAIL in backend/.env.');
  if (!password || password.length < 12 || password.length > 256) throw new Error('Set ADMIN_PASSWORD to 12–256 characters in backend/.env.');
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Admin.init();
  if (await Admin.exists({ email })) throw new Error('This admin already exists. No changes made.');
  await Admin.create({ email, passwordHash: await hashPassword(password) });
  console.log('Admin created. Remove ADMIN_PASSWORD from .env now.');
} catch (error) {
  console.error(error.code === 11000 ? 'Admin already exists. No changes made.' : error.message);
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
