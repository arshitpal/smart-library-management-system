const app = require('./app');
const { port } = require('./config/env');
const { sequelize } = require('./models');
const { startReminderJob } = require('./services/reminderService');

async function start() {
  await sequelize.authenticate();
  console.log('Connected to MySQL');
  startReminderJob();
  app.listen(port, () => console.log(`API running on http://localhost:${port}`));
}

start().catch((err) => {
  console.error('Could not start the server:', err.message);
  process.exit(1);
});
