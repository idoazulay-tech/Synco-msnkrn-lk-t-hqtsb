import { qdrant } from "./qdrant.js";

interface CollectionConfig {
  name: string;
  vectorSize: number;
  distance: "Cosine" | "Euclid" | "Dot";
}

const COLLECTIONS: CollectionConfig[] = [
  { name: "user_events", vectorSize: 1536, distance: "Cosine" },
  { name: "user_insights", vectorSize: 1536, distance: "Cosine" },
  { name: "user_profile", vectorSize: 1536, distance: "Cosine" },
  { name: "synco_knowledge", vectorSize: 1536, distance: "Cosine" },
];

export async function initQdrantCollections() {
  if (!qdrant) {
    console.warn("Qdrant client not available — skipping collection init");
    return;
  }

  try {
    const existing = await qdrant.getCollections();
    const existingNames = new Set(existing.collections.map(c => c.name));

    for (const col of COLLECTIONS) {
      if (existingNames.has(col.name)) {
        console.log(`${col.name} collection already exists`);
      } else {
        await qdrant.createCollection(col.name, {
          vectors: {
            size: col.vectorSize,
            distance: col.distance,
          },
        });
        console.log(`${col.name} collection created`);
      }
    }

    await ensurePayloadIndices();

    console.log("Qdrant collections initialized successfully");
  } catch (error) {
    console.error("Failed to initialize Qdrant collections", error);
  }
}

async function ensurePayloadIndices() {
  if (!qdrant) return;

  const indices: Record<string, string[]> = {
    user_events: ["userId", "type", "status", "importance"],
    user_insights: ["userId", "insightType", "status", "confidence"],
    user_profile: ["userId", "category", "confirmedByUser"],
    synco_knowledge: ["domain", "whenToUse"],
  };

  for (const [collection, fields] of Object.entries(indices)) {
    for (const field of fields) {
      try {
        await qdrant.createPayloadIndex(collection, {
          field_name: field,
          field_schema: "keyword",
        });
      } catch (_e) {
      }
    }
  }
}
