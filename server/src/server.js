import 'dotenv/config';
import { createApp } from './app.js';

const PORT = process.env.PORT || 5000;

const { httpServer } = createApp();

httpServer.listen(PORT, () => {
  console.log(`🚀 Athithi server running on http://localhost:${PORT}`);
});
