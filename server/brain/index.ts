import { ingestEvent, type RawInput } from "./services/ingestion.js";
import { storeEvent, storeInsight, storeUserMessage, searchUserMemory, buildContext } from "./services/memory.js";
import { analyzeWithContext } from "./services/understanding.js";
import { evaluatePolicy, getUserLearningState, updateLearningState } from "./services/policy.js";
import { scheduleCuriosityQuestions, getNextCuriosityQuestion, markCuriosityAnswered, getPendingCuriosity } from "./services/curiosity.js";
import { isUsingFallbackEmbeddings } from "./utils/openai-client.js";
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

  const memoryContext = await buildContext(text, userId);

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

  return {
    message: understanding.response,
    actions: understanding.suggestedActions,
    insights: understanding.insights.map(i => `[${i.insightType}] ${i.title}: ${i.description}`),
    curiosityQuestions: understanding.curiosityQuestions,
    policyDecision,
  };
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
  const learningState = await getUserLearningState(userId);
  const pendingQuestions = getPendingCuriosity(userId);
  const nextQuestion = getNextCuriosityQuestion(userId);

  return {
    learningState,
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
