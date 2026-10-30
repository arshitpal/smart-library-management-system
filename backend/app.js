const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const { clientOrigin } = require('./config/env');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Hosting platforms sit in front of the app, so the login rate limit needs the real client IP.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: clientOrigin, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ success: true, message: 'ok' }));
app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
