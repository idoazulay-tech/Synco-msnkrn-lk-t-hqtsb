export const AI_FEATURES = {
  enabled:                  process.env.SYNCO_AI_ENABLED === 'true',
  provider:                 process.env.SYNCO_AI_PROVIDER || 'openai',
  parseEnabled:             process.env.SYNCO_AI_PARSE_ENABLED === 'true',
  taskReportEnabled:        process.env.SYNCO_AI_TASK_REPORT_ENABLED === 'true',
  breakdownEnabled:         process.env.SYNCO_AI_BREAKDOWN_ENABLED === 'true',
  dayCommandEnabled:        process.env.SYNCO_AI_DAY_COMMAND_ENABLED === 'true',
  externalKnowledgeEnabled: process.env.SYNCO_EXTERNAL_KNOWLEDGE_ENABLED === 'true',
};

export function hasOpenAIKey(): boolean {
  return !!(
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY
  );
}

export function getOpenAIKey(): string | undefined {
  return process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
}

export function getOpenAIBaseURL(): string | undefined {
  return process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
}
