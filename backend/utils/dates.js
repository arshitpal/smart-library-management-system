// Loans work in whole days, so dates are plain 'YYYY-MM-DD' strings.
const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = (date) => Date.parse(`${date}T00:00:00Z`);

function today() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

const addDays = (date, days) => new Date(toUtc(date) + days * DAY_MS).toISOString().slice(0, 10);

const diffDays = (later, earlier) => Math.round((toUtc(later) - toUtc(earlier)) / DAY_MS);

module.exports = { today, addDays, diffDays };
