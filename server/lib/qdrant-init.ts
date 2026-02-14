import { qdrant } from "./qdrant.js";

export async function initQdrantCollections() {
  if (!qdrant) {
    console.warn("Qdrant client not available — skipping collection init");
    return;
  }

  const collectionName = "synco_memory";

  try {
    const collections = await qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === collectionName);

    if (exists) {
      console.log("synco_memory collection already exists");
      return;
    }

    await qdrant.createCollection(collectionName, {
      vectors: {
        size: 1536,
        distance: "Cosine",
      },
    });

    console.log("synco_memory collection created");
  } catch (error) {
    console.error("Failed to initialize Qdrant collections", error);
  }
}
