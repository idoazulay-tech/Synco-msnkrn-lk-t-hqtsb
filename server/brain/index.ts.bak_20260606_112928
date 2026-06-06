import { type RawInput } from "./services/ingestion.js";
import { storeInsight, storeUserMessage, searchUserMemory, buildContext } from "./services/memory.js";
import { analyzeWithContext } from "./services/understanding.js";
import { evaluatePolicy, getUserLearningState, updateLearningState } from "./services/policy.js";
import { scheduleCuriosityQuestions, getNextCuriosityQuestion, markCuriosityAnswered, getPendingCuriosity } from "./services/curiosity.js";
import { isUsingFallbackEmbeddings } from "./utils/openai-client.js";
import { analyzeEventLocal, getUserMetrics, getUnresolvedFlags } from "./services/localAnalyzer.js";
import { runAIAnalysis } from "./services/aiAnalyzer.js";
import type { BrainResponse, BrainContext } from "./types/index.js";

export async function processBrainInput(
  userId: string,
  text: string,
  type: RawInput['type'] = 'message',
  extraPayload?: Record<string, unknown>
): Promise<BrainResponse> {
  await updateLearningState(userId, 'event');

  const [, memories] = await Promise.all([
    storeUserMessage(userId, text, { type, source: "user" }),
    searchUserMemory(userId, text, 5),
  ]);

  const localResult = await analyzeEventLocal(userId, { type, text });

  if (!localResult.shouldTriggerAI) {
    const memoryContext = await buildContext(text, userId);
    const memoryLines = memories
      .filter(m => m.text)
      .map(m => `"${m.text}" (${m.timestamp})`)
      .join("\n");

    const quickResponse = localResult.flags.length > 0
      ? buildFlagResponse(localResult.flags)
      : null;

    return {
      message: quickResponse || "קיבלתי ✓",
      actions: [],
      insights: [],
      curiosityQuestions: [],
      policyDecision: {
        action: "learn_silently",
        reason: localResult.reason,
        confidence: 0.8,
        requiresApproval: false,
      },
      localFlags: localResult.flags.map(f => f.type),
      aiTriggered: false,
    };
  }

  const [memoryContext, aiResult] = await Promise.all([
    buildContext(text, userId),
    runAIAnalysis(userId, localResult.flags, text),
  ]);

  const context: BrainContext = {
    userId,
    ...memoryContext,
    _userMemories: memories,
  };

  const understanding = await analyzeWithContext(text, context);

  const overallConfidence = understanding.insights.length > 0
    ? understanding.insights.reduce((sum, i) => sum + i.confidence, 0) / understanding.insights.length
    : 0.5;

  const adjustedConfidence = isUsingFallbackEmbeddings()
    ? Math.min(overallConfidence, 0.6)
    : overallConfidence;

  const policyDecision = await evaluatePolicy(
    understanding.suggestedActions,
    context,
    adjustedConfidence,
  );

  const insightPromises = understanding.insights
    .filter(i => i.confidence >= 0.4)
    .map(i => storeInsight(i));
  await Promise.all(insightPromises);

  if (understanding.curiosityQuestions.length > 0) {
    scheduleCuriosityQuestions(userId, understanding.curiosityQuestions);
  }

  let message = understanding.response;
  if (aiResult) {
    const prefix = aiResult.type === "question" ? "💡 " : "📊 ";
    message = `${message}\n\n${prefix}${aiResult.content}`;
  }

  return {
    message,
    actions: understanding.suggestedActions,
    insights: understanding.insights.map(i => `[${i.insightType}] ${i.title}: ${i.description}`),
    curiosityQuestions: understanding.curiosityQuestions,
    policyDecision,
    localFlags: localResult.flags.map(f => f.type),
    aiTriggered: true,
  };
}

function buildFlagResponse(flags: { type: string; detail: string }[]): string {
  const responses: string[] = [];
  for (const flag of flags) {
    switch (flag.type) {
      case "MISSING_INFO":
        responses.push("שמתי לב שחסרים פרטים - מתי ולכמה זמן?");
        break;
      case "REPEATED_POSTPONE":
        responses.push("שמתי לב שהדחיות חוזרות. אולי כדאי לפרק את המשימה?");
        break;
      case "OVERLOAD_DAY":
        responses.push("נראה שיש עומס היום. אולי כדאי לתעדף?");
        break;
      case "PRIORITY_UNCLEAR":
        responses.push("הרבה דברים נראים דחופים - מה הכי חשוב עכשיו?");
        break;
      default:
        break;
    }
  }
  return responses.join("\n") || "קיבלתי ✓";
}

export async function handleApproval(
  userId: string,
  approved: boolean
): Promise<void> {
  await updateLearningState(userId, approved ? 'approved' : 'rejected');
}

export async function answerCuriosity(
  userId: string,
  questionId: string,
  answer: string
): Promise<BrainResponse> {
  markCuriosityAnswered(userId, questionId);
  return processBrainInput(userId, answer, 'check_in_response', { curiosityQuestionId: questionId });
}

export async function getBrainStatus(userId: string) {
  const [learningState, metrics, unresolvedFlags] = await Promise.all([
    getUserLearningState(userId),
    getUserMetrics(userId),
    getUnresolvedFlags(userId),
  ]);
  const pendingQuestions = getPendingCuriosity(userId);
  const nextQuestion = getNextCuriosityQuestion(userId);

  return {
    learningState,
    metrics,
    unresolvedFlags: unresolvedFlags.map(f => ({ type: f.flagType, detail: (f.context as any)?.detail })),
    pendingQuestionsCount: pendingQuestions.length,
    nextQuestion,
    usingFallbackEmbeddings: isUsingFallbackEmbeddings(),
  };
}

export {
  getUserLearningState,
  updateLearningState,
  getPendingCuriosity,
  getNextCuriosityQuestion,
};
