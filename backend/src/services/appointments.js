import { randomUUID } from 'node:crypto';
import { schedulingConflictFilter } from './scheduling.js';

export function createAppointmentService(Appointment, Consultation, sendAppointmentEmail, TeamMember, withSchedulingLock) {
  const sending = new Set();
  function reject(status, message, details = {}) { const error = new Error(message); Object.assign(error, { status }, details); throw error; }
  return {
    async sendNotice(id, expectedVersion) {
      if (!sendAppointmentEmail) reject(503, 'Appointment email is not configured. Check SMTP settings.');
      if (sending.has(id)) reject(409, 'An email is already being sent for this appointment.');
      sending.add(id);
      try {
        const appointment = await Appointment.findOne({ consultation: id }).populate('consultation', 'fullName emailAddr').lean();
        if (!appointment) return null;
        if (!appointment.consultation) reject(409, 'The linked enquiry is unavailable.');
        if (new Date(appointment.updatedAt).toISOString() !== expectedVersion) reject(409, 'Appointment details changed. Refresh and review before sending.');
        if (!['Scheduled', 'Cancelled', 'Completed'].includes(appointment.status)) reject(409, 'This appointment status cannot be emailed.');
        if (appointment.status === 'Scheduled' && new Date(appointment.startsAt) <= new Date()) reject(409, 'This visit is in the past. Reschedule before sending confirmation.');
        const attemptId = randomUUID();
        const attempt = { attemptId, version: expectedVersion, type: appointment.status,
          recipient: appointment.consultation.emailAddr, startedAt: new Date(), status: 'Sending' };
        const claimed = await Appointment.findOneAndUpdate({
          _id: appointment._id, updatedAt: new Date(expectedVersion), emailState: { $ne: 'Sending' },
          $nor: [{ emailVersion: expectedVersion, emailState: 'Accepted' }]
        }, {
          $set: { emailState: 'Sending', emailVersion: expectedVersion, emailAttemptId: attemptId },
          $push: { emailHistory: { $each: [attempt], $slice: -50 } }
        }, { new: true, runValidators: true, timestamps: false }).lean();
        if (!claimed) reject(409, 'This version was already emailed, is being emailed, or has changed. Refresh to check its history.');
        let failure;
        try { await sendAppointmentEmail(appointment); } catch (error) { failure = error || new Error('SMTP failure'); }
        const state = failure ? 'Failed' : 'Accepted';
        const knownCodes = ['EAUTH', 'ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'EDNS', 'EENVELOPE', 'EMESSAGE', 'ESTREAM', 'ETLS'];
        const errorCode = failure ? (knownCodes.includes(failure.code) ? failure.code : 'UNKNOWN') : '';
        const finishedAt = new Date();
        const emailHistory = claimed.emailHistory.map(entry => entry.attemptId === attemptId
          ? { ...entry, status: state, finishedAt, errorCode } : entry);
        const details = { emailState: state, emailVersion: expectedVersion, emailHistory };
        try {
          const recorded = await Appointment.updateOne({ _id: appointment._id, emailAttemptId: attemptId, 'emailHistory.attemptId': attemptId }, {
            $set: { emailState: state, 'emailHistory.$.status': state, 'emailHistory.$.finishedAt': finishedAt, 'emailHistory.$.errorCode': errorCode }
          }, { timestamps: false, runValidators: true });
          if (recorded.matchedCount !== 1) throw new Error('History was not updated');
        } catch {
          reject(503, 'Email may have been sent, but its outcome could not be recorded. Check the inbox and history before retrying.');
        }
        if (failure) reject(502, 'Email delivery was not confirmed. The appointment remains saved. Check the inbox before retrying.', details);
        return { message: 'Email accepted by the SMTP provider. Check the customer inbox for delivery.', ...details };
      } finally { sending.delete(id); }
    },
    get: id => Appointment.findOne({ consultation: id }).lean(),
    async save(id, value) {
      if (!await Consultation.exists({ _id: id })) return null;
      if (!withSchedulingLock) reject(503, 'Scheduling protection is not configured.');
      return withSchedulingLock(async () => {
      if (!TeamMember) reject(503, 'Team management is not configured.');
      const member = await TeamMember.findById(value.assignedMember).lean();
      if (!member) reject(409, 'Team member not found. Choose an active team member.');
      if (member.status !== 'Active' && (value.status === 'Scheduled' || !await Appointment.exists({ consultation: id, assignedMember: value.assignedMember }))) {
        reject(409, 'Choose an active team member for this appointment.');
      }
      const existing = await Appointment.exists({ consultation: id });
      if (!existing && value.status !== 'Scheduled') {
        const error = new Error('Create a scheduled appointment before marking it completed or cancelled.');
        error.status = 409;
        throw error;
      }
      if (value.status === 'Scheduled') {
        const conflict = await Appointment.findOne(schedulingConflictFilter(id, { ...member, _id: value.assignedMember }, value.startsAt, value.durationMinutes))
          .select('_id').lean();
        if (conflict) reject(409, 'This team member already has an overlapping scheduled visit. Choose a different time or member.', {
          errors: { startsAt: 'This time overlaps another visit for the selected team member.' }
        });
      }
      return Appointment.findOneAndUpdate({ consultation: id, emailState: { $ne: 'Sending' } }, { $set: { ...value, assignedTo: member.name } }, {
        upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true
      }).lean();
      });
    },
    async list({ page, limit, status }) {
      const filter = status ? { status } : {};
      const [items, total] = await Promise.all([
        Appointment.find(filter).sort({ startsAt: 1, _id: 1 }).skip((page - 1) * limit).limit(limit)
          .populate('consultation', 'fullName emailAddr phoneNumber').lean(),
        Appointment.countDocuments(filter)
      ]);
      return { items, total, page, pageSize: limit };
    },
    upcoming: () => Appointment.find({ status: 'Scheduled', startsAt: { $gte: new Date() } })
      .sort({ startsAt: 1, _id: 1 }).limit(5).populate('consultation', 'fullName').lean()
  };
}
