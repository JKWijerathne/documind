from array import array

import pytest

from app.services import embedding_service


class FakeEmbeddingModel:
    def __init__(self):
        self.calls = []

    def encode(self, texts, convert_to_tensor=False):
        self.calls.append((texts, convert_to_tensor))
        if isinstance(texts, str):
            return array("f", [1.0] + [0.0] * 383)
        return [array("f", [1.0] + [0.0] * 383) for _ in texts]


@pytest.fixture
def fake_embedding_model(monkeypatch):
    model = FakeEmbeddingModel()
    monkeypatch.setattr(
        embedding_service,
        "get_embedding_model",
        lambda: model,
    )
    return model


def test_generate_embedding_returns_a_384_dimension_vector(fake_embedding_model):
    vector = embedding_service.generate_embedding("A test sentence.")

    assert isinstance(vector, list)
    assert len(vector) == 384
    assert all(isinstance(value, float) for value in vector)
    assert fake_embedding_model.calls == [("A test sentence.", False)]


def test_generate_batch_embeddings_encodes_all_texts(fake_embedding_model):
    texts = ["First sentence.", "Second sentence."]
    vectors = embedding_service.generate_batch_embeddings(texts)

    assert len(vectors) == len(texts)
    assert all(len(vector) == 384 for vector in vectors)
    assert fake_embedding_model.calls == [(texts, False)]


def test_empty_batch_does_not_call_the_model(fake_embedding_model):
    assert embedding_service.generate_batch_embeddings([]) == []
    assert fake_embedding_model.calls == []


def test_cosine_similarity_handles_equal_and_zero_vectors():
    assert embedding_service.compute_cosine_similarity([1.0, 0.0], [1.0, 0.0]) == 1.0
    assert embedding_service.compute_cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0


def test_cosine_similarity_rejects_different_dimensions():
    with pytest.raises(ValueError, match="same dimension"):
        embedding_service.compute_cosine_similarity([1.0], [1.0, 0.0])
