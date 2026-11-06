import math
from sentence_transformers import SentenceTransformer
from app.config import settings

_model = None


def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(settings.HF_EMBEDDING_MODEL)
    return _model


def generate_embedding(text: str) -> list[float]:
    model = get_embedding_model()
    embedding = model.encode(text, convert_to_tensor=False)
    return embedding.tolist()


def generate_batch_embeddings(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    
    model = get_embedding_model()
    embeddings = model.encode(texts, convert_to_tensor=False)
    return [emb.tolist() for emb in embeddings]


def compute_cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
  
    if len(vec1) != len(vec2):
        raise ValueError("Vectors must have the same dimension")

    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = math.sqrt(sum(a * a for a in vec1))
    magnitude2 = math.sqrt(sum(b * b for b in vec2))

    if magnitude1 == 0.0 or magnitude2 == 0.0:
        return 0.0

    return dot_product / (magnitude1 * magnitude2)