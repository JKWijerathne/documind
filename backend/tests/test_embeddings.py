from app.services.embedding_service import (
    generate_embedding,
    generate_batch_embeddings,
    compute_cosine_similarity
)

def test_generate_single_embedding():
    sample_text = "DocuMind is an AI-powered document assistant."
    vector = generate_embedding(sample_text)
    
    assert isinstance(vector, list)
    assert all(isinstance(val, float) for val in vector)
    assert len(vector) == 384


def test_generate_batch_embeddings():
    texts = [
        "What is machine learning?",
        "Vector databases store high-dimensional embeddings."
    ]
    vectors = generate_batch_embeddings(texts)
    
    assert len(vectors) == 2
    assert len(vectors[0]) == 384
    assert len(vectors[1]) == 384


def test_sample_question_embedding():
    query = "How do I upload a PDF document?"
    query_vector = generate_embedding(query)
    
    assert len(query_vector) == 384


def test_cosine_similarity():
    # Identical texts should have a cosine similarity close to 1.0
    v1 = generate_embedding("Artificial intelligence and machine learning.")
    v2 = generate_embedding("Artificial intelligence and machine learning.")
    
    similarity = compute_cosine_similarity(v1, v2)
    assert 0.99 <= similarity <= 1.00