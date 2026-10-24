import 'dotenv/config';
import { createApp } from './app.js';

process.on('unhandledRejection', (reason) => {
  console.warn('[SERVER_UNHANDLED_REJECTION]', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('[SERVER_UNCAUGHT_EXCEPTION]', err?.message || err);
});

const PORT = process.env.PORT || 5000;

const { httpServer } = createApp();

httpServer.listen(PORT, () => {
  console.log(`🚀 Athithi server running on http://localhost:${PORT}`);
});
