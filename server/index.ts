import express from 'express';
import cors from 'cors';
import { prisma } from './lib/prisma.js';
import quickRoutes from './routes/quick.js';
import tasksRoutes from './routes/tasks.js';
import settingsRoutes from './routes/settings.js';
import regulationRoutes from './routes/regulation.js';
import layersRoutes from './routes/layers.js';
import analyzeRoutes from './routes/analyze.js';
import learningRoutes from './routes/learning.js';
import automationRoutes from './routes/automation.js';
import feedbackRoutes from './routes/feedback.js';
import orgRoutes from './routes/org.js';
import temporalRoutes from './routes/temporal.js';
import brainRoutes from './routes/brain.js';
import memoryDebugRoutes from './routes/memory-debug.js';
import onboardingRoutes from './routes/onboarding.js';
import plannerRoutes from './routes/planner.js';
import { testQdrantConnection } from './lib/qdrant.js';
import { initQdrantCollections } from './lib/qdrant-init.js';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/quick', quickRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/task-files', tasksRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/regulation', regulationRoutes);
app.use('/api/layers', layersRoutes);
app.use('/api', analyzeRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api', automationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/temporal', temporalRoutes);
app.use('/api/brain', brainRoutes);
app.use('/api/memory', memoryDebugRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/planner', plannerRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`HaMefraket server running on port ${PORT}`);
  await testQdrantConnection();
  await initQdrantCollections();
});

export { prisma };
