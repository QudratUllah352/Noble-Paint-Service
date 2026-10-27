import mongoose from 'mongoose';
import { createApp } from './app.js';
import { Consultation } from './models/Consultation.js';
import { Admin } from './models/Admin.js';
import MongoStore from 'connect-mongo';
import { createConsultationLister } from './services/listConsultations.js';
import { configureEnquiryEmail } from './services/enquiryEmail.js';
import { createOverviewReader } from './services/adminOverview.js';
import { Appointment } from './models/Appointment.js';
import { createAppointmentService } from './services/appointments.js';
import { configureAppointmentEmail } from './services/appointmentEmail.js';
import { TeamMember } from './models/TeamMember.js';
import { createTeamService } from './services/team.js';
import { OperationLock } from './models/OperationLock.js';
import { createSchedulingGuard } from './services/scheduling.js';
import { Project } from './models/Project.js';
import { createProjectService } from './services/projects.js';
import { Service } from './models/Service.js';
import { createCatalogueService, seedServices } from './services/catalogue.js';
import { createAccountService } from './services/accounts.js';
import { createRecoveryService } from './services/recovery.js';
import { RecoveryEvent } from './models/RecoveryEvent.js';
import { AuditEvent } from './models/AuditEvent.js';
import { createAuditService } from './services/audit.js';
import { createPasswordResetService } from './services/passwordResets.js';
import { configurePasswordResetEmail } from './services/passwordResetEmail.js';

async function start() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env before starting.');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await Admin.init();
  await Appointment.init();
  await Project.init();
  await Service.init();
  await AuditEvent.init();
  await seedServices(Service);
  const catalogue = createCatalogueService(Service);
  const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:5000';
  const sendPasswordResetEmail = configurePasswordResetEmail(process.env, siteUrl);
  const team = createTeamService(TeamMember);
  const projects = createProjectService(Project, Consultation, TeamMember);
  const appointments = createAppointmentService(Appointment, Consultation, configureAppointmentEmail(process.env), TeamMember, createSchedulingGuard(OperationLock));
  const readOverview = createOverviewReader(Consultation);
  const admin = process.env.SESSION_SECRET ? {
    secret: process.env.SESSION_SECRET,
    store: MongoStore.create({ client: mongoose.connection.getClient(), collectionName: 'admin_sessions' }),
    secure: process.env.NODE_ENV === 'production',
    siteUrl,
    findAdmin: email => Admin.findOne({ email }).select('+passwordHash').lean(),
    appointments,
    team,
    projects,
    catalogue,
    accounts: createAccountService(Admin),
    passwordResets: sendPasswordResetEmail ? createPasswordResetService(Admin, sendPasswordResetEmail) : undefined,
    recovery: createRecoveryService(Appointment, OperationLock, RecoveryEvent),
    audit: createAuditService(AuditEvent),
    getOverview: async () => {
      const [overview, upcomingAppointments, projectSummary] = await Promise.all([readOverview(), appointments.upcoming(), projects.summary()]);
      return { ...overview, upcomingAppointments, projectSummary };
    },
    updateConsultationNotes: (id, adminNotes) => Consultation.findByIdAndUpdate(
      id, { $set: { adminNotes } }, { new: true, runValidators: true }
    ).select('_id adminNotes').lean(),
    updateConsultationStatus: (id, status) => Consultation.findByIdAndUpdate(
      id, { $set: { status } }, { new: true, runValidators: true }
    ).select('_id status').lean(),
    listConsultations: createConsultationLister(Consultation)
  } : undefined;
  const app = createApp({ saveConsultation: value => Consultation.create(value), admin, catalogue, teamDirectory: team,
    notifyEnquiry: configureEnquiryEmail(process.env) });
  const port = Number(process.env.PORT || 5000);
  const server = app.listen(port, () => console.log(`Contact page: http://localhost:${port}/contact/`));
  server.on('error', async error => {
    console.error('Server startup failed:', error.message);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    }));
  }
}

start().catch(error => {
  console.error('Startup failed:', error.message);
  process.exitCode = 1;
});
