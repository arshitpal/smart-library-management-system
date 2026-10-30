// Daily job: due-soon and overdue reminders. dedupe_key prevents repeat messages.
const cron = require('node-cron');
const { QueryTypes } = require('sequelize');
const { sequelize, Notification } = require('../models');

async function sendReminders() {
  const loans = await sequelize.query(
    `SELECT v.issue_id, v.book_title, v.loan_state, v.days_until_due, s.user_id
     FROM v_loan_status v JOIN students s ON s.id = v.student_id
     WHERE v.loan_state IN ('DUE_SOON', 'OVERDUE')`,
    { type: QueryTypes.SELECT },
  );

  const rows = loans.map((loan) => {
    const overdue = loan.loan_state === 'OVERDUE';
    return {
      user_id: loan.user_id,
      type: overdue ? 'OVERDUE' : 'DUE_REMINDER',
      title: overdue ? 'Book overdue' : 'Book due soon',
      message: overdue
        ? `${loan.book_title} is overdue. Please return it to avoid a higher fine.`
        : `${loan.book_title} is due in ${loan.days_until_due} day(s).`,
      issue_id: loan.issue_id,
      dedupe_key: `${overdue ? 'OVERDUE' : 'DUE_3D'}:issue:${loan.issue_id}`,
    };
  });
  if (rows.length) await Notification.bulkCreate(rows, { ignoreDuplicates: true });
  return rows.length;
}

function startReminderJob() {
  const run = () => sendReminders().catch((err) => console.error('Reminder job failed:', err.message));
  run();
  cron.schedule('0 8 * * *', run);
}

module.exports = { sendReminders, startReminderJob };
