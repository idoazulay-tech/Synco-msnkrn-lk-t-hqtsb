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
  share: {
    successPersisted:   'Share complete. Context identified and saved.',
    successDryRun:      'Scan complete. Not saved — pass persist=true to save.',
    noSignals:          'No special context detected in the text. All looks fine.',
    partialFailure:     'Share completed with partial errors. Data saved partially.',
    validationError:    'Missing data: userId and text are required.',
    unexpectedError:    'An error occurred. Please try again.',
    signalsSummary:     (count: number): string => `Detected ${count} signal${count === 1 ? '' : 's'}.`,
    wikiSummary:        (count: number): string => `Updated ${count} wiki topic${count === 1 ? '' : 's'}.`,
    graphSummary:       (nodes: number, edges: number): string => {
      const total = nodes + edges;
      if (edges > 0) return `Added ${total} connection${total === 1 ? '' : 's'} to personal graph.`;
      return `Added ${nodes} item${nodes === 1 ? '' : 's'} to personal graph.`;
    },
    openQSummary:       (count: number): string => `${count} open question${count === 1 ? '' : 's'}.`,
  },
  retrieve: {
    missingParams:      'Missing required params: userId and query.',
    noResults:          'No results found for this query.',
    unexpectedError:    'Retrieval error. Please try again.',
  },
} as const;

export type EnMessages = typeof enMessages;
