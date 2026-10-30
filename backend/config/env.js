require('dotenv').config();

const required = ['DB_NAME', 'DB_USER', 'JWT_SECRET'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  throw new Error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env.`);
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5180',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    timezone: process.env.DB_TIMEZONE || '+05:30',
    ssl: process.env.DB_SSL === 'true',
    sslCa: process.env.DB_SSL_CA || '',
  },
  jwt: { secret: process.env.JWT_SECRET, expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  ml: {
    url: process.env.ML_SERVICE_URL || 'http://127.0.0.1:8001',
    key: process.env.ML_SERVICE_KEY || '',
    timeoutMs: Number(process.env.ML_TIMEOUT_MS) || 3000,
  },
};
