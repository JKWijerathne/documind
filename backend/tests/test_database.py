from app.models import Document, DocumentChunk


def test_document_chunks_are_saved_and_retrieved(db_session):
    document = Document(filename="manual.pdf")
    db_session.add(document)
    db_session.flush()

    db_session.add_all(
        [
            DocumentChunk(
                document_id=document.id,
                page_number=1,
                chunk_index=0,
                content="The project launched in 2024.",
                embedding=[0.1] * 384,
            ),
            DocumentChunk(
                document_id=document.id,
                page_number=2,
                chunk_index=1,
                content="The service supports PDF files.",
                embedding=[0.2] * 384,
            ),
        ]
    )
    db_session.commit()

    chunks = (
        db_session.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document.id)
        .order_by(DocumentChunk.chunk_index)
        .all()
    )

    assert [chunk.content for chunk in chunks] == [
        "The project launched in 2024.",
        "The service supports PDF files.",
    ]
    assert [(chunk.page_number, chunk.chunk_index) for chunk in chunks] == [
        (1, 0),
        (2, 1),
    ]
    assert all(len(chunk.embedding) == 384 for chunk in chunks)
