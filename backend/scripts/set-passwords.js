// Replaces every account's password with a new random one and prints them ONCE.
// Run by deploy-db.ps1, because the sample passwords are public.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { sequelize, User } = require('../models');

function randomPassword() {
  // The prefix guarantees the upper case, lower case and number the app requires.
  return `Lib7${crypto.randomBytes(9).toString('base64url')}`;
}

async function main() {
  const users = await User.findAll({ order: [['id', 'ASC']] });
  console.log('\nSAVE THESE NOW. They are shown only once.\n');
  for (const user of users) {
    const password = randomPassword();
    await user.update({ password_hash: await bcrypt.hash(password, 10) });
    console.log(`${user.role.padEnd(10)} ${user.email.padEnd(28)} ${password}`);
  }
  await sequelize.close();
}

main().catch((err) => {
  console.error('Could not set passwords:', err.message);
  process.exit(1);
});
