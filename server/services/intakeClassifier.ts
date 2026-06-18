/**
 * intakeClassifier.ts — re-exports from intakeDeterministicParser.
 * Kept for backward compatibility. New code should import from
 * intakeDeterministicParser.ts or intakeUnderstandingService.ts directly.
 */
export {
  parseIntakeDeterministic,
  buildIntakePreview,
  type SyncoIntakePreview,
  type SyncoNowAction,
  type SyncoTodayTask,
  type SyncoLaterTask,
  type SyncoProject,
  type SyncoProjectStep,
  type SyncoOpenQuestion,
  type SyncoNote,
  type SyncoEntities,
  // legacy
  type IntakeType,
  type IntakePreview,
} from './intakeDeterministicParser.js';
