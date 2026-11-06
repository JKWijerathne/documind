from app.chunking import clean_text, chunk_text, chunk_document


def test_clean_text():
    sample = "Hello     World\n\n\nWelcome to DocuMind"
    cleaned = clean_text(sample)
    assert cleaned == "Hello World\n\nWelcome to DocuMind"


def test_chunk_text():
    long_text = "DocuMind is an AI-powered document assistant. " * 50
    chunks = chunk_text(long_text, chunk_size=800, overlap=120)
    
    assert len(chunks) > 0
    assert all(len(chunk) <= 800 for chunk in chunks)


def test_chunk_document_metadata():
    pages = [
        {
            "page_number": 1,
            "text": "Header Text\nIntroduction to artificial intelligence. " * 30
        },
        {
            "page_number": 2,
            "text": "Header Text\nMachine learning fundamentals. " * 30
        }
    ]

    document_chunks = chunk_document(document_id=1, pages=pages)

    # Validate metadata preservation and sequential indexing
    assert len(document_chunks) > 0
    assert all(c["document_id"] == 1 for c in document_chunks)
    assert all(c["page_number"] in [1, 2] for c in document_chunks)
    assert all(len(c["content"]) <= 800 for c in document_chunks)
    
    for idx, chunk in enumerate(document_chunks):
        assert chunk["chunk_index"] == idx