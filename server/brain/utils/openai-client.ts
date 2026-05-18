import OpenAI from "openai";

// ─── Chat client (uses AI Integrations proxy) ─────────────────────────────────

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

    if (!apiKey) {
      throw new Error("AI_INTEGRATIONS_OPENAI_API_KEY is not set");
    }

    _client = new OpenAI({ apiKey, baseURL });
  }
  return _client;
}

// ─── Embedding client (prefers direct OPENAI_API_KEY, no proxy) ───────────────
// Replit AI Integrations proxy does not support /v1/embeddings.
// When OPENAI_API_KEY is present, use it directly with no baseURL.
// Falls back to AI_INTEGRATIONS_OPENAI_API_KEY if OPENAI_API_KEY is absent.

let _embeddingClient: OpenAI | null = null;

function getEmbeddingClient(): OpenAI {
  if (!_embeddingClient) {
    const directKey  = process.env.OPENAI_API_KEY;
    const proxyKey   = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    const apiKey     = directKey || proxyKey;

    if (!apiKey) {
      throw new Error("No OpenAI API key available for embeddings (OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY required)");
    }

    // Use direct key without any base URL override so the request goes to
    // api.openai.com/v1/embeddings — not through the Replit proxy.
    _embeddingClient = new OpenAI({ apiKey });

    const source = directKey ? "OPENAI_API_KEY (direct)" : "AI_INTEGRATIONS_OPENAI_API_KEY (proxy)";
    console.log(`[Brain] Embedding client initialized using ${source}`);
  }
  return _embeddingClient;
}

// ─── Fallback flag ────────────────────────────────────────────────────────────

let _usingFallbackEmbeddings = false;

export function isUsingFallbackEmbeddings(): boolean {
  return _usingFallbackEmbeddings;
}

// ─── Chat completion (unchanged) ──────────────────────────────────────────────

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
    temperature: options?.temperature ?? 0.3,
    max_completion_tokens: options?.maxTokens ?? 2048,
    ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
  });

  return response.choices[0]?.message?.content ?? "";
}

// ─── Embedding generation (uses direct OpenAI key) ────────────────────────────

export async function generateEmbedding(text: string): Promise<{ vector: number[]; isFallback: boolean }> {
  if (_usingFallbackEmbeddings) {
    return { vector: generateFallbackEmbedding(text), isFallback: true };
  }

  try {
    const client = getEmbeddingClient();

    const response = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return { vector: response.data[0].embedding, isFallback: false };

  } catch (error: any) {
    const isUnsupported =
      error?.status === 404 ||
      error?.status === 400 ||
      error?.message?.includes("not supported") ||
      error?.message?.includes("not found");

    if (isUnsupported) {
      console.warn("[Brain] Embeddings API not available, switching to fallback permanently");
      _usingFallbackEmbeddings = true;
      return { vector: generateFallbackEmbedding(text), isFallback: true };
    }

    console.error("[Brain] Embedding generation failed, using fallback:", error?.message);
    return { vector: generateFallbackEmbedding(text), isFallback: true };
  }
}

// ─── Deterministic fallback embedding (safety net only) ───────────────────────

function generateFallbackEmbedding(text: string): number[] {
  const dim = 1536;
  const vector = new Array(dim).fill(0);
  const normalized = text.toLowerCase().trim();

  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i);
    const pos = (charCode * 31 + i * 17) % dim;
    vector[pos] += 1.0 / Math.sqrt(normalized.length);

    const bigram = i < normalized.length - 1
      ? (charCode * 256 + normalized.charCodeAt(i + 1))
      : charCode;
    const bigramPos = (bigram * 13 + i * 7) % dim;
    vector[bigramPos] += 0.5 / Math.sqrt(normalized.length);
  }

  const magnitude = Math.sqrt(vector.reduce((sum: number, v: number) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dim; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}
