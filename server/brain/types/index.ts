export interface BrainEvent {
  id: string;
  userId: string;
  type: 'message' | 'task_created' | 'task_completed' | 'task_skipped' | 'task_postponed' |
        'schedule_changed' | 'preference_expressed' | 'feedback_given' |
        'check_in_response' | 'voice_input' | 'manual_input';
  payload: Record<string, unknown>;
  timestamp: Date;
  source: 'user' | 'system' | 'automation';
}

export interface BrainInsight {
  id: string;
  userId: string;
  insightType: 'pattern' | 'preference' | 'struggle' | 'strength' | 'habit';
  title: string;
  description: string;
  confidence: number;
  evidence: string[];
  createdAt: Date;
  status: 'active' | 'archived' | 'invalidated';
}

export interface UserProfileEntry {
  id: string;
  userId: string;
  category: 'energy_pattern' | 'task_preference' | 'time_preference' |
            'communication_style' | 'adhd_pattern' | 'coping_strategy';
  key: string;
  value: string;
  confidence: number;
  confirmedByUser: boolean;
  lastUpdated: Date;
}

export interface MemorySearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
  collection: string;
}

export interface UserMemoryHit {
  text: string;
  timestamp: string;
  score: number;
}

export interface BrainContext {
  userId: string;
  recentEvents: MemorySearchResult[];
  relevantInsights: MemorySearchResult[];
  userProfile: MemorySearchResult[];
  knowledgeHints: MemorySearchResult[];
  _userMemories?: UserMemoryHit[];
}

export interface PolicyDecision {
  action: 'execute' | 'ask_user' | 'learn_silently' | 'block';
  reason: string;
  confidence: number;
  requiresApproval: boolean;
}

export interface BrainResponse {
  message: string;
  actions: BrainAction[];
  insights: string[];
  curiosityQuestions: string[];
  policyDecision: PolicyDecision;
}

export interface BrainAction {
  type: 'create_task' | 'update_task' | 'suggest_schedule' | 'store_preference' |
        'send_reminder' | 'generate_insight' | 'ask_clarification';
  payload: Record<string, unknown>;
  priority: 'high' | 'medium' | 'low';
}

export interface EmbeddingResult {
  vector: number[];
  model: string;
  tokens: number;
}

export interface CuriosityItem {
  id: string;
  userId: string;
  question: string;
  priority: number;
  scheduledFor: Date;
  status: 'pending' | 'asked' | 'answered' | 'expired';
}
