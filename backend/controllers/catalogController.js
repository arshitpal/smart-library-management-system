const { Op } = require('sequelize');
const { sequelize, Author, Book, BookAuthor, BookIssue, Category } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, paged } = require('../utils/pagination');

const bookIncludes = [
  { model: Category, as: 'category', attributes: ['id', 'name'] },
  { model: Author, as: 'authors', attributes: ['id', 'name'], through: { attributes: [] } },
];

async function listBooks(req, res) {
  const pagination = getPagination(req.query);
  const { search, categoryId, availability, status } = req.query;
  const where = {};
  // Students only ever see active titles.
  if (req.user.role === 'STUDENT' || status === 'active') where.is_active = true;
  if (status === 'inactive' && req.user.role !== 'STUDENT') where.is_active = false;
  if (categoryId) where.category_id = categoryId;
  if (availability === 'available') where.available_copies = { [Op.gt]: 0 };
  if (availability === 'unavailable') where.available_copies = 0;
  if (search) {
    const like = `%${search}%`;
    const authored = sequelize.literal(
      `books.id IN (SELECT ba.book_id FROM book_authors ba JOIN authors a ON a.id = ba.author_id
                    WHERE a.name LIKE ${sequelize.escape(like)})`,
    );
    where[Op.or] = [{ title: { [Op.like]: like } }, { isbn: { [Op.like]: like } }, authored];
  }

  const count = await Book.count({ where });
  const rows = await Book.findAll({
    where,
    include: bookIncludes,
    order: [['title', 'ASC']],
    limit: pagination.limit,
    offset: pagination.offset,
  });
  res.json({ success: true, data: paged(rows, count, pagination) });
}

async function getBook(req, res) {
  const book = await Book.findByPk(req.params.id, { include: bookIncludes });
  if (!book) throw new ApiError(404, 'Book not found');
  res.json({ success: true, data: book });
}

const bookFields = (b) => ({
  isbn: b.isbn,
  title: b.title,
  publisher: b.publisher || null,
  publication_year: b.publicationYear || null,
  category_id: b.categoryId,
  total_copies: b.totalCopies,
  shelf_location: b.shelfLocation || null,
});

const authorLinks = (bookId, authorIds) => [...new Set(authorIds)].map((id) => ({ book_id: bookId, author_id: id }));

async function createBook(req, res) {
  const book = await sequelize.transaction(async (transaction) => {
    const created = await Book.create(
      { ...bookFields(req.body), available_copies: req.body.totalCopies },
      { transaction },
    );
    await BookAuthor.bulkCreate(authorLinks(created.id, req.body.authorIds), { transaction });
    return created;
  });
  res.status(201).json({ success: true, data: { id: book.id } });
}

async function updateBook(req, res) {
  await sequelize.transaction(async (transaction) => {
    const book = await Book.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!book) throw new ApiError(404, 'Book not found');

    const onLoan = book.total_copies - book.available_copies;
    if (req.body.totalCopies < onLoan) {
      throw new ApiError(409, `${onLoan} copies are on loan, so the total cannot be lower`);
    }
    await book.update(
      { ...bookFields(req.body), available_copies: req.body.totalCopies - onLoan },
      { transaction },
    );
    await BookAuthor.destroy({ where: { book_id: book.id }, transaction });
    await BookAuthor.bulkCreate(authorLinks(book.id, req.body.authorIds), { transaction });
  });
  res.json({ success: true, message: 'Book updated' });
}

async function setBookStatus(req, res) {
  const book = await Book.findByPk(req.params.id);
  if (!book) throw new ApiError(404, 'Book not found');
  if (!req.body.isActive) {
    const open = await BookIssue.count({ where: { book_id: book.id, status: 'ISSUED' } });
    if (open) throw new ApiError(409, 'This book has copies on loan');
  }
  await book.update({ is_active: req.body.isActive });
  res.json({ success: true, message: `Book ${req.body.isActive ? 'activated' : 'deactivated'}` });
}

const makeSimpleCrud = (Model, label, fields) => ({
  async list(req, res) {
    const { search } = req.query;
    const where = search ? { name: { [Op.like]: `%${search}%` } } : {};
    const data = await Model.findAll({ where, order: [['name', 'ASC']] });
    res.json({ success: true, data });
  },
  async create(req, res) {
    const record = await Model.create(fields(req.body));
    res.status(201).json({ success: true, data: record });
  },
  async update(req, res) {
    const record = await Model.findByPk(req.params.id);
    if (!record) throw new ApiError(404, `${label} not found`);
    await record.update(fields(req.body));
    res.json({ success: true, data: record });
  },
  async remove(req, res) {
    const record = await Model.findByPk(req.params.id);
    if (!record) throw new ApiError(404, `${label} not found`);
    await record.destroy();
    res.json({ success: true, message: `${label} deleted` });
  },
});

module.exports = {
  listBooks, getBook, createBook, updateBook, setBookStatus,
  categories: makeSimpleCrud(Category, 'Category', (b) => ({ name: b.name, description: b.description || null })),
  authors: makeSimpleCrud(Author, 'Author', (b) => ({ name: b.name, biography: b.biography || null })),
};
