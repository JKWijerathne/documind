from sentence_transformers import SentenceTransformer

from app.config import settings


# Load the embedding model
model = SentenceTransformer(
    settings.HF_EMBEDDING_MODEL
)

# Text to convert into an embedding
text = "Artificial intelligence can answer questions about documents."

# Generate the embedding
embedding = model.encode(text)

# Display the result
print("Embedding generated successfully!")
print("Dimensions:", len(embedding))
print("First five values:", embedding[:5])