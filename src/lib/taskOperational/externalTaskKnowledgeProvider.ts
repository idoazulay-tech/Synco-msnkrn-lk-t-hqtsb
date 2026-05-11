export type ExternalTaskKnowledgeProvider = {
  lookupTaskKnowledge(query: string): Promise<unknown | null>;
};

export const nullExternalTaskKnowledgeProvider: ExternalTaskKnowledgeProvider = {
  async lookupTaskKnowledge(_query: string) {
    return null;
  },
};
