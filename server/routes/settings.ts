import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    let settings = await prisma.userSettings.findFirst();
    
    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          language: 'he',
          insightsMode: 'hidden',
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { language, insightsMode, regulationProfile } = req.body;
    
    let settings = await prisma.userSettings.findFirst();
    
    if (settings) {
      settings = await prisma.userSettings.update({
        where: { id: settings.id },
        data: {
          language,
          insightsMode,
          regulationProfile,
        }
      });
    } else {
      settings = await prisma.userSettings.create({
        data: {
          language: language || 'he',
          insightsMode: insightsMode || 'hidden',
          regulationProfile,
        }
      });
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
