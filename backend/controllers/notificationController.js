const { Notification } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, paged } = require('../utils/pagination');

async function list(req, res) {
  const pagination = getPagination(req.query);
  const where = { user_id: req.user.id };
  if (req.query.unread === 'true') where.is_read = false;
  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [['created_at', 'DESC'], ['id', 'DESC']],
    limit: pagination.limit,
    offset: pagination.offset,
  });
  const unread = await Notification.count({ where: { user_id: req.user.id, is_read: false } });
  res.json({ success: true, data: { ...paged(rows, count, pagination), unread } });
}

async function markRead(req, res) {
  const note = await Notification.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!note) throw new ApiError(404, 'Notification not found');
  await note.update({ is_read: true, read_at: new Date() });
  res.json({ success: true, message: 'Marked as read' });
}

async function markAllRead(req, res) {
  await Notification.update(
    { is_read: true, read_at: new Date() },
    { where: { user_id: req.user.id, is_read: false } },
  );
  res.json({ success: true, message: 'All marked as read' });
}

module.exports = { list, markRead, markAllRead };
