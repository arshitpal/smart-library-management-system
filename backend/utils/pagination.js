const MAX_LIMIT = 100;

function getPagination(query) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 10, 1), MAX_LIMIT);
  return { page, limit, offset: (page - 1) * limit };
}

const paged = (items, total, { page, limit }) => ({
  items,
  total,
  page,
  limit,
  pages: Math.max(Math.ceil(total / limit), 1),
});

module.exports = { getPagination, paged };
