import mongoose from 'mongoose';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { Admin } from '../src/models/Admin.js';
import { Appointment } from '../src/models/Appointment.js';
import { OperationLock } from '../src/models/OperationLock.js';
import { RecoveryEvent } from '../src/models/RecoveryEvent.js';
import { createRecoveryService } from '../src/services/recovery.js';
import { verifyPassword } from '../src/services/passwords.js';
import { AuditEvent } from '../src/models/AuditEvent.js';
import { createAuditService } from '../src/services/audit.js';

const [command, ...args] = process.argv.slice(2);
const usage = 'Usage: node --env-file=.env scripts/recovery.js report | unlock <token> | email <appointmentId> <attemptId> <received|retry>';
let prompt;
try {
  if (!['report', 'unlock', 'email'].includes(command) || args.length !== ({ report: 0, unlock: 1, email: 3 })[command]) throw new Error(usage);
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  const recovery = createRecoveryService(Appointment, OperationLock, RecoveryEvent);
  if (command === 'report') console.log(JSON.stringify(await recovery.inspect(), null, 2));
  else {
    if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run recovery interactively in a terminal.');
    let hidden = false;
    const output = new Writable({ write(chunk, encoding, done) { if (!hidden) process.stdout.write(chunk); done(); } });
    prompt = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
    console.log('Stop ALL backend instances and workers before continuing. This tool cannot verify remote processes are stopped.');
    const confirmation = await prompt.question('Type ALL BACKENDS STOPPED to confirm: ');
    if (confirmation !== 'ALL BACKENDS STOPPED') throw new Error('Cancelled. No changes made.');
    if (command === 'email') {
      console.log(args[2] === 'received' ? 'Use received only after verifying receipt with the customer or provider.' : 'Retry can duplicate delivery. Check the customer inbox and provider logs first.');
      if (await prompt.question('Type INBOX CHECKED to confirm: ') !== 'INBOX CHECKED') throw new Error('Cancelled. No changes made.');
    }
    const email = (await prompt.question('Current admin email: ')).trim().toLowerCase();
    process.stdout.write('Current admin password (hidden): ');
    hidden = true;
    let password;
    try { password = await prompt.question(''); } finally { hidden = false; process.stdout.write('\n'); }
    const admin = await Admin.findOne({ email }).select('+passwordHash').lean();
    const dummy = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const matches = await verifyPassword(password, admin?.passwordHash || dummy);
    password = undefined;
    if (!admin || !matches) throw new Error('Invalid admin credentials. No changes made.');
    await createAuditService(AuditEvent).run({ id: admin._id, email: admin.email },
      command === 'unlock' ? 'recovery.unlock' : `recovery.${args[2]}`, args[0], [], async () => {
        if (command === 'unlock') await recovery.releaseLock(args[0], admin._id);
        else await recovery.resolveEmail(...args, admin._id);
      });
    console.log('Recovery recorded. No email was sent. Restart the backend and review the appointment before any further action.');
  }
} catch (error) {
  console.error(error instanceof mongoose.Error ? 'Database recovery failed. Check database availability and inspect the report before retrying.' : error.message);
  process.exitCode = 1;
} finally { prompt?.close(); await mongoose.disconnect(); }
