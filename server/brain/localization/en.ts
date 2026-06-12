/**
 * Synco English Localization — Future Support Skeleton
 *
 * Not yet used in production. Provided so multilingual support
 * requires minimal code changes when needed.
 */

export const enMessages = {
  recommendation: {
    lifeRuleBlock: (ruleTitle: string): string =>
      `This conflicts with your rule: "${ruleTitle}". Consider moving it to tomorrow or reducing the task.`,
    lifeRuleBlockAction: 'Move to tomorrow, or adjust the timing.',
    lifeRuleBlockReason: 'An active life rule blocks this action.',

    highRiskPrediction:
      'There is a chance today is slightly harder for completing tasks. How about starting with something small?',
    highRiskPredictionAction: 'Start with a small, well-defined task.',
    highRiskPredictionReason: 'A historical signal indicates a possible execution risk.',

    overloadWarning:
      'Today looks fairly busy. Better to pick 3 key actions and keep the rest flexible.',
    overloadWarningAction: 'Pick 3 core tasks for today.',
    overloadWarningReason: 'Relative overload detected in current context.',

    missingInfo:
      "I can save this now, but I'm missing a detail that would help me be more precise later.",
    missingInfoAction: 'Add details so I can help better.',
    missingInfoReason: 'Context is missing for better focus.',
  },
  openQuestions: {
    whoIsPerson: (name: string): string => `Who is ${name} to you?`,
    whichProject: 'Which project did you mean?',
  },
} as const;

export type EnMessages = typeof enMessages;
