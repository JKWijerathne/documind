from sqlalchemy.orm import Session
from google import genai
from app.config import settings
from app.services.retrieval_service import search_similar_chunks

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def generate_rag_answer(db: Session, query: str, top_k: int = 4) -> dict:
    similar_chunks = search_similar_chunks(db=db, query=query, top_k=top_k)

    if not similar_chunks:
        return {
            "answer": "I could not find any relevant information in the uploaded documents to answer your question.",
            "sources": []
        }

    context_blocks = []
    sources = []

    for chunk in similar_chunks:
        # Include inline page labels so Gemini knows precisely where each block originates
        context_blocks.append(f"[Page {chunk.page_number}]: {chunk.content}")
        sources.append({
            "document_id": chunk.document_id,
            "page_number": chunk.page_number,
            "chunk_index": chunk.chunk_index
        })

    combined_context = "\n\n---\n\n".join(context_blocks)

    prompt = f"""You are DocuMind, an expert AI document assistant. 
Answer the user's question using ONLY the provided document context below. 

Rules:
1. Do not invent or extrapolate any information not directly supported by the context.
2. If the answer cannot be found in the provided context, state clearly: "I cannot find the answer to this question in the uploaded documents."
3. Always cite the source page numbers (e.g., [Page X]) in your response when referencing information.

---
DOCUMENT CONTEXT:
{combined_context}
---

USER QUESTION: {query}

ANSWER:"""

    response = client.models.generate_content(
        model=settings.GEMINI_MODEL,
        contents=prompt,
    )

    return {
        "answer": response.text.strip(),
        "sources": sources
    }