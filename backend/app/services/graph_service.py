from typing import TypedDict, List, Optional, Any
from langgraph.graph import StateGraph, START, END
from sqlalchemy.orm import Session
from google import genai
from app.config import settings
from app.services.embedding_service import generate_embedding
from app.services.retrieval_service import search_similar_chunks_by_embedding

client = genai.Client(api_key=settings.GEMINI_API_KEY)


class GraphState(TypedDict):
    db: Session
    question: str
    top_k: int
    document_id: Optional[int]
    query_embedding: List[float]
    retrieved_chunks: List[Any]
    answer: str
    sources: List[dict]


def create_rag_graph():
    workflow = StateGraph(GraphState)

    def retrieve_documents_node(state: GraphState):
        return {"query_embedding": generate_embedding(state["question"])}

    def search_pgvector_node(state: GraphState):
        chunks = search_similar_chunks_by_embedding(
            db=state["db"],
            query_embedding=state["query_embedding"],
            top_k=state["top_k"],
            document_id=state["document_id"]
        )
        return {"retrieved_chunks": chunks}

    def generate_answer_node(state: GraphState):
        chunks = state["retrieved_chunks"]
        query = state["question"]

        if not chunks:
            return {
                "answer": "I could not find any relevant information in the uploaded documents to answer your question.",
                "sources": []
            }

        context_blocks = []
        sources = []

        for chunk in chunks:
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

    def format_response_node(state: GraphState):
        return {
            "answer": state.get("answer", ""),
            "sources": state.get("sources", [])
        }

    workflow.add_node("retrieve_documents", retrieve_documents_node)
    workflow.add_node("search_pgvector", search_pgvector_node)
    workflow.add_node("generate_answer", generate_answer_node)
    workflow.add_node("format_response", format_response_node)

    workflow.add_edge(START, "retrieve_documents")
    workflow.add_edge("retrieve_documents", "search_pgvector")
    workflow.add_edge("search_pgvector", "generate_answer")
    workflow.add_edge("generate_answer", "format_response")
    workflow.add_edge("format_response", END)

    return workflow.compile()


_rag_graph = None


def run_rag_graph(
    db: Session,
    query: str,
    top_k: int = 4,
    document_id: Optional[int] = None
) -> dict:
    global _rag_graph
    if _rag_graph is None:
        _rag_graph = create_rag_graph()

    initial_state = {
        "db": db,
        "question": query,
        "top_k": top_k,
        "document_id": document_id,
        "query_embedding": [],
        "retrieved_chunks": [],
        "answer": "",
        "sources": []
    }

    result = _rag_graph.invoke(initial_state)

    return {
        "answer": result.get("answer"),
        "sources": result.get("sources", [])
    }