// The ONLY place the fine formula exists. Actual fines never come from the ML model.
const { QueryTypes } = require('sequelize');
const { sequelize, Fine, Payment, Notification } = require('../models');
const ApiError = require('../utils/ApiError');
const { diffDays, today } = require('../utils/dates');

const round2 = (value) => Math.round(value * 100) / 100;

function calculateFine({ dueDate, returnDate, rule }) {
  const lateDays = Math.max(diffDays(returnDate, dueDate), 0);
  const chargeableDays = Math.max(lateDays - rule.grace_days, 0);
  const uncapped = chargeableDays * Number(rule.daily_rate);
  const amount = rule.max_fine === null ? uncapped : Math.min(uncapped, Number(rule.max_fine));
  return { lateDays, chargeableDays, amount: round2(amount) };
}

// Live amount for a book still out; becomes the actual fine only at return.
const accruedFine = (dueDate, rule) => calculateFine({ dueDate, returnDate: today(), rule }).amount;

async function findFineForUpdate(fineId, transaction) {
  const fine = await Fine.findByPk(fineId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!fine) throw new ApiError(404, 'Fine not found');
  const paid = (await Payment.sum('amount', { where: { fine_id: fineId }, transaction })) || 0;
  const balance = round2(Number(fine.amount) - Number(fine.waived_amount) - paid);
  return { fine, paid, balance };
}

function nextStatus(paid, balance) {
  if (balance === 0) return paid > 0 ? 'PAID' : 'WAIVED';
  return paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID';
}

async function studentUserOfFine(fineId, transaction) {
  const [row] = await sequelize.query(
    `SELECT s.user_id, br.issue_id FROM fines f
     JOIN book_returns br ON br.id = f.return_id
     JOIN book_issues bi ON bi.id = br.issue_id
     JOIN students s ON s.id = bi.student_id
     WHERE f.id = ?`,
    { replacements: [fineId], type: QueryTypes.SELECT, transaction },
  );
  return row;
}

function recordPayment({ fineId, amount, method, transactionRef, receivedBy }) {
  return sequelize.transaction(async (transaction) => {
    const { fine, paid, balance } = await findFineForUpdate(fineId, transaction);
    if (balance <= 0) throw new ApiError(409, 'This fine is already settled');
    if (amount > balance) throw new ApiError(422, `Amount exceeds the balance of Rs ${balance.toFixed(2)}`);

    const payment = await Payment.create(
      { fine_id: fineId, amount, method, transaction_ref: transactionRef || null, received_by: receivedBy },
      { transaction },
    );
    const status = nextStatus(round2(paid + amount), round2(balance - amount));
    await fine.update({ status }, { transaction });

    const owner = await studentUserOfFine(fineId, transaction);
    await Notification.create({
      user_id: owner.user_id,
      type: 'PAYMENT',
      title: 'Payment received',
      message: `Rs ${amount.toFixed(2)} received by ${method}. Fine status: ${status.replace('_', ' ')}.`,
      issue_id: owner.issue_id,
    }, { transaction });
    return { payment, status };
  });
}

function waiveFine({ fineId, amount, reason, waivedBy }) {
  return sequelize.transaction(async (transaction) => {
    const { fine, paid, balance } = await findFineForUpdate(fineId, transaction);
    if (balance <= 0) throw new ApiError(409, 'This fine is already settled');
    const waiver = amount === undefined ? balance : amount;
    if (waiver > balance) throw new ApiError(422, `Waiver exceeds the balance of Rs ${balance.toFixed(2)}`);

    const status = nextStatus(paid, round2(balance - waiver));
    await fine.update({
      waived_amount: round2(Number(fine.waived_amount) + waiver),
      waived_by: waivedBy,
      waiver_reason: reason,
      status,
    }, { transaction });
    return { waived: waiver, status };
  });
}

module.exports = { calculateFine, accruedFine, recordPayment, waiveFine };
