from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Document, DocumentChunk
from app.services.pdf_service import extract_text_from_pdf
from app.chunking import chunk_document
from app.services.embedding_service import generate_batch_embeddings

router = APIRouter(prefix="/api/documents", tags=["Documents"])

MAX_FILE_SIZE = 10 * 1024 * 1024  


@router.get("/")
def list_documents(db: Session = Depends(get_db)):
    documents = (
        db.query(Document, func.count(DocumentChunk.id))
        .outerjoin(DocumentChunk, DocumentChunk.document_id == Document.id)
        .group_by(Document.id)
        .order_by(Document.upload_date.desc(), Document.id.desc())
        .all()
    )

    return [
        {
            "id": document.id,
            "filename": document.filename,
            "upload_date": (
                document.upload_date.isoformat()
                if document.upload_date is not None
                else None
            ),
            "total_chunks": chunk_count,
            "status": "ready" if chunk_count > 0 else "failed",
        }
        for document, chunk_count in documents
    ]


@router.post("/upload")
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    header = await file.read(1024)
    await file.seek(0)
    
    if not header.startswith(b"%PDF-"):
        raise HTTPException(
            status_code=400,
            detail="Invalid file format. The uploaded file is not a genuine PDF."
        )


    contents = bytearray()
    chunk_size = 1024 * 64 
    total_size = len(header)

    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="File size exceeds the maximum allowed limit of 10MB."
            )
        contents.extend(chunk)

    pages = extract_text_from_pdf(bytes(contents))

    # Keep the document and its chunks in one transaction so failed processing
    # cannot leave a document that appears usable but has no completed chunks.
    db_document = Document(filename=file.filename)
    db.add(db_document)
    db.flush()

    # 2. Chunk text
    chunks = chunk_document(
        document_id=db_document.id,
        pages=pages,
        chunk_size=800,
        overlap=120
    )
    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No searchable text was found in the PDF.",
        )

    # 3. Generate embeddings
    chunk_texts = [c["content"] for c in chunks]
    embeddings = generate_batch_embeddings(chunk_texts)

    # 4. Save chunks and embeddings into database
    for i, chunk_data in enumerate(chunks):
        db_chunk = DocumentChunk(
            document_id=db_document.id,
            page_number=chunk_data["page_number"],
            chunk_index=chunk_data["chunk_index"],
            content=chunk_data["content"],
            embedding=embeddings[i]
        )
        db.add(db_chunk)

    db.commit()

    return {
        "document_id": db_document.id,
        "filename": db_document.filename,
        "total_pages": len(pages),
        "total_chunks": len(chunks),
        "status": "ready",
        "message": "Document successfully uploaded, chunked, embedded, and saved to Neon PostgreSQL!"
    }


@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")

    db.delete(document)
    db.commit()

    return {
        "document_id": document_id,
        "message": "Document and its associated chunks were deleted.",
    }