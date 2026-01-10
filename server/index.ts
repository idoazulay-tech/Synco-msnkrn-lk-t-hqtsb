import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma.js';
import quickRoutes from './routes/quick.js';
import tasksRoutes from './routes/tasks.js';
import settingsRoutes from './routes/settings.js';
import regulationRoutes from './routes/regulation.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/quick', quickRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/task-files', tasksRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/regulation', regulationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`HaMefraket server running on port ${PORT}`);
});

export { prisma };
