import { QdrantClient } from "@qdrant/js-client-rest";

const url = process.env.QDRANT_URL;
const apiKey = process.env.QDRANT_API_KEY;

if (!url) {
  console.warn("QDRANT_URL is not set — Qdrant client will not be initialized");
}
if (!apiKey) {
  console.warn("QDRANT_API_KEY is not set — Qdrant client will not be initialized");
}

export const qdrant = url && apiKey
  ? new QdrantClient({ url, apiKey })
  : null;

console.log(qdrant ? "Qdrant client initialized" : "Qdrant client skipped (missing env vars)");

export async function testQdrantConnection() {
  if (!qdrant) {
    console.warn("Qdrant client not available — skipping connection test");
    return;
  }
  try {
    const collections = await qdrant.getCollections();
    console.log("Qdrant connected successfully");
    console.log(collections);
  } catch (error) {
    console.error("Qdrant connection failed", error);
  }
}
