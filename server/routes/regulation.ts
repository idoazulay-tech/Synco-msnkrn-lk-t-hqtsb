import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

interface Exercise {
  id: string;
  type: 'emotional' | 'sensory' | 'other';
  title: string;
  titleHe: string;
  instructions: string;
  instructionsHe: string;
  duration: number;
}

const exercises: Exercise[] = [
  {
    id: 'breathe-4-7-8',
    type: 'emotional',
    title: '4-7-8 Breathing',
    titleHe: 'נשימה 4-7-8',
    instructions: 'Inhale for 4 seconds, hold for 7 seconds, exhale for 8 seconds',
    instructionsHe: 'שאיפה ל-4 שניות, החזקה ל-7 שניות, נשיפה ל-8 שניות',
    duration: 60,
  },
  {
    id: 'grounding-5-4-3-2-1',
    type: 'sensory',
    title: '5-4-3-2-1 Grounding',
    titleHe: 'עיגון 5-4-3-2-1',
    instructions: 'Name 5 things you see, 4 you hear, 3 you feel, 2 you smell, 1 you taste',
    instructionsHe: 'ציין 5 דברים שאתה רואה, 4 שומע, 3 מרגיש, 2 מריח, 1 טועם',
    duration: 90,
  },
  {
    id: 'quick-stretch',
    type: 'other',
    title: 'Quick Stretch',
    titleHe: 'מתיחה מהירה',
    instructions: 'Stand up, stretch your arms above your head, hold for 10 seconds',
    instructionsHe: 'קום, מתח את הידיים מעל הראש, החזק 10 שניות',
    duration: 30,
  },
  {
    id: 'box-breathing',
    type: 'emotional',
    title: 'Box Breathing',
    titleHe: 'נשימת ריבוע',
    instructions: 'Inhale 4s, hold 4s, exhale 4s, hold 4s - repeat 4 times',
    instructionsHe: 'שאיפה 4 שניות, החזקה 4 שניות, נשיפה 4 שניות, החזקה 4 שניות - חזור 4 פעמים',
    duration: 64,
  },
  {
    id: 'cold-water',
    type: 'sensory',
    title: 'Cold Water Reset',
    titleHe: 'איפוס במים קרים',
    instructions: 'Splash cold water on your face or hold ice cubes in your hands',
    instructionsHe: 'שפשף מים קרים על הפנים או החזק קוביות קרח בידיים',
    duration: 30,
  },
];

router.get('/exercises', (req: Request, res: Response) => {
  const { type } = req.query;
  
  if (type && typeof type === 'string') {
    const filtered = exercises.filter(e => e.type === type);
    res.json(filtered);
    return;
  }
  
  res.json(exercises);
});

router.get('/exercises/:type/random', (req: Request, res: Response) => {
  const { type } = req.params;
  const filtered = exercises.filter(e => e.type === type);
  
  if (filtered.length === 0) {
    res.status(404).json({ error: 'No exercises found for this type' });
    return;
  }
  
  const random = filtered[Math.floor(Math.random() * filtered.length)];
  res.json(random);
});

router.post('/log', async (req: Request, res: Response) => {
  try {
    const { type, exerciseId, userFeedback } = req.body;
    
    const log = await prisma.regulationLog.create({
      data: {
        type,
        exerciseId,
        userFeedback,
      }
    });
    
    res.status(201).json(log);
  } catch (error) {
    console.error('Log regulation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
