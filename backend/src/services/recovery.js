// Mutations are for the offline recovery script only, never HTTP routes.
export function createRecoveryService(Appointment, OperationLock, RecoveryEvent) {
  return {
    async inspect() {
      const [lock, emails] = await Promise.all([
        OperationLock.findById('appointment-scheduling').select('token createdAt').lean(),
        Appointment.find({ emailState: 'Sending' }).select('consultation emailAttemptId emailHistory updatedAt')
          .sort({ _id: 1 }).limit(100).lean()
      ]);
      return { lock, emails: emails.map(item => ({
        id: String(item._id), consultation: String(item.consultation), attemptId: item.emailAttemptId,
        startedAt: item.emailHistory?.find(entry => entry.attemptId === item.emailAttemptId)?.startedAt
      })), limit: 100 };
    },
    async releaseLock(token, adminId) {
      if (typeof token !== 'string' || !token || token.length > 200) throw new Error('Provide the exact lock token from the report.');
      const event = await RecoveryEvent.create({ action: 'release-lock', target: token, admin: adminId, outcome: 'Pending' });
      const result = await OperationLock.deleteOne({ _id: 'appointment-scheduling', token });
      await RecoveryEvent.updateOne({ _id: event._id }, { $set: { outcome: result.deletedCount === 1 ? 'Applied' : 'Unchanged' } });
      if (result.deletedCount !== 1) throw new Error('Lock changed or no longer exists. Nothing was released.');
    },
    async resolveEmail(id, attemptId, resolution, adminId) {
      if (!/^[a-f\d]{24}$/i.test(id) || typeof attemptId !== 'string' || !attemptId || attemptId.length > 200 || !['received', 'retry'].includes(resolution)) {
        throw new Error('Provide an appointment ID, exact attempt ID, and received or retry.');
      }
      const state = resolution === 'received' ? 'Accepted' : 'Failed';
      const result = await Appointment.updateOne({ _id: id, emailState: 'Sending', emailAttemptId: attemptId,
        emailHistory: { $elemMatch: { attemptId, status: 'Sending' } } }, {
        $set: { emailState: state, 'emailHistory.$.status': state, 'emailHistory.$.finishedAt': new Date(),
          'emailHistory.$.recovery': { resolution, admin: adminId, at: new Date() } }
      }, { timestamps: false, runValidators: true });
      if (result.matchedCount !== 1) throw new Error('Email attempt changed or is no longer Sending. Nothing was resolved.');
    }
  };
}
