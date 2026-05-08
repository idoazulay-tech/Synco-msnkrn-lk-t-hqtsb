import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { storeUserMessage } from '../brain/services/memory.js';

const router = Router();

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const state = await prisma.onboardingState.findUnique({ where: { userId } });
    res.json(state || { status: 'NOT_STARTED' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to get onboarding state', details: error.message });
  }
});

router.post('/save', async (req, res) => {
  try {
    const { userId, ...data } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const state = await prisma.onboardingState.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    res.json(state);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to save onboarding state', details: error.message });
  }
});

router.post('/complete', async (req, res) => {
  try {
    const { userId, behaviorPatterns } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const mapped = behaviorPatterns ? Object.keys(behaviorPatterns) : [];

    const state = await prisma.onboardingState.upsert({
      where: { userId },
      create: { userId, status: 'COMPLETED', behaviorPatterns, mappedDifficulties: mapped },
      update: { status: 'COMPLETED', behaviorPatterns, mappedDifficulties: mapped },
    });

    if (behaviorPatterns && Object.keys(behaviorPatterns).length > 0) {
      const patternSummary = Object.entries(behaviorPatterns)
        .map(([key, val]: [string, any]) => `${key}: ${val.triggerType || ''} → ${val.reactionPattern || ''}`)
        .join('; ');
      try {
        await storeUserMessage(userId, `[onboarding] דפוסי פעולה: ${patternSummary}`, {
          type: 'onboarding_complete',
          patterns: behaviorPatterns,
        });
      } catch (memErr: any) {
        console.warn('[Onboarding] memory store skipped (offline):', memErr.message);
      }
    }

    res.json(state);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to complete onboarding', details: error.message });
  }
});

router.post('/skip', async (req, res) => {
  try {
    const { userId, behaviorPatterns, difficulties, rankedDifficulties } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const mapped = behaviorPatterns ? Object.keys(behaviorPatterns) : [];

    const state = await prisma.onboardingState.upsert({
      where: { userId },
      create: {
        userId,
        status: 'SKIPPED_PARTIAL',
        behaviorPatterns,
        difficulties,
        rankedDifficulties,
        mappedDifficulties: mapped,
      },
      update: {
        status: 'SKIPPED_PARTIAL',
        behaviorPatterns,
        difficulties,
        rankedDifficulties,
        mappedDifficulties: mapped,
      },
    });

    if (behaviorPatterns && Object.keys(behaviorPatterns).length > 0) {
      const patternSummary = Object.entries(behaviorPatterns)
        .map(([key, val]: [string, any]) => `${key}: ${val.triggerType || ''} → ${val.reactionPattern || ''}`)
        .join('; ');
      try {
        await storeUserMessage(userId, `[onboarding partial] דפוסי פעולה: ${patternSummary}`, {
          type: 'onboarding_partial',
          patterns: behaviorPatterns,
        });
      } catch (memErr: any) {
        console.warn('[Onboarding] memory store skipped (offline):', memErr.message);
      }
    }

    res.json(state);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to skip onboarding', details: error.message });
  }
});

router.post('/conversation', async (req, res) => {
  try {
    const { userId, text } = req.body;
    if (!userId || !text) return res.status(400).json({ error: 'userId and text are required' });

    const difficultyKeywords: Record<string, string[]> = {
      procrastination: ['דוחה', 'דחיינות', 'מחר', 'עוד מעט', 'לא עכשיו', 'מתעצל'],
      overload: ['עומס', 'הרבה', 'יותר מדי', 'לא מספיק זמן', 'עמוס'],
      focus: ['פיזור', 'לא ממוקד', 'קופץ', 'לא מתרכז', 'מוסח'],
      inconsistency: ['לא עקבי', 'פעם כן פעם לא', 'תלוי ביום', 'לא קבוע'],
      time_estimation: ['איחור', 'לא מספיק', 'חושב שיש זמן', 'הערכת זמן'],
      starting: ['קושי להתחיל', 'לא מתחיל', 'דחיית התחלה', 'מתקשה להתחיל'],
      finishing: ['לא מסיים', 'עוזב באמצע', 'מפסיק', 'קושי לסיים'],
      perfectionism: ['מושלם', 'פרפקציוניזם', 'לא מספיק טוב', 'שוב ושוב'],
      multi_goals: ['הרבה מטרות', 'רוצה הכל', 'ריבוי', 'לא יודע במה להתמקד'],
      decisions: ['החלטות', 'לא מחליט', 'מתלבט', 'קושי לבחור'],
      sensory: ['רעש', 'הצפה', 'חושי', 'יותר מדי גירויים', 'מוצף'],
      burnout: ['שחיקה', 'עייף', 'אין אנרגיה', 'תשישות', 'ירידה'],
      pressure: ['לחץ', 'דדליין', 'בהול', 'נלחץ'],
      people_pleasing: ['אנשים', 'לרצות', 'לא אומר לא', 'ריצוי'],
      task_switching: ['קופץ', 'עובר בין', 'לא נשאר', 'מחליף משימות'],
      motivation_loss: ['מוטיבציה', 'מאבד עניין', 'משעמם', 'לא רוצה יותר'],
    };

    const detected: string[] = [];
    const normalized = text.toLowerCase();

    for (const [key, keywords] of Object.entries(difficultyKeywords)) {
      if (keywords.some(kw => normalized.includes(kw))) {
        detected.push(key);
      }
    }

    const difficultyLabels: Record<string, string> = {
      procrastination: 'דחיינות',
      overload: 'עומס',
      focus: 'פיזור וחוסר מיקוד',
      inconsistency: 'חוסר עקביות',
      time_estimation: 'איחורים והערכת זמן',
      starting: 'קושי להתחיל',
      finishing: 'קושי לסיים',
      perfectionism: 'פרפקציוניזם',
      multi_goals: 'ריבוי מטרות',
      decisions: 'קושי בקבלת החלטות',
      sensory: 'ויסות חושי / הצפה',
      burnout: 'שחיקה / ירידת אנרגיה',
      pressure: 'לחץ מתמשך',
      people_pleasing: 'ריצוי אחרים',
      task_switching: 'קפיצה בין משימות',
      motivation_loss: 'איבוד מוטיבציה באמצע',
    };

    let reflection = '';
    if (detected.length > 0) {
      const labels = detected.map(d => difficultyLabels[d] || d);
      reflection = `שמעתי. נשמע שיש פה עניין של ${labels.join(', ')}.`;
    } else {
      reflection = 'הבנתי. ספר לי עוד — מה הדבר הכי מתסכל ביום שלך?';
    }

    res.json({
      reflection,
      detectedDifficulties: detected,
      labels: detected.map(d => ({ key: d, label: difficultyLabels[d] || d })),
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to process conversation', details: error.message });
  }
});

router.get('/should-prompt/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const state = await prisma.onboardingState.findUnique({ where: { userId } });
    if (!state || state.status !== 'SKIPPED_PARTIAL') {
      return res.json({ shouldPrompt: false });
    }

    const selected = (state.difficulties as string[]) || [];
    const mapped = (state.mappedDifficulties as string[]) || [];
    const unmapped = selected.filter(d => !mapped.includes(d));

    if (unmapped.length === 0) {
      return res.json({ shouldPrompt: false });
    }

    res.json({
      shouldPrompt: true,
      unmappedCount: unmapped.length,
      message: 'רוצה להשלים עוד 2 שאלות קצרות כדי שאדייק אותך יותר?',
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to check prompt', details: error.message });
  }
});

export default router;
