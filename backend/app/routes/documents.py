from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Document, DocumentChunk
from app.services.pdf_service import extract_text_from_pdf
from app.chunking import chunk_document
from app.services.embedding_service import generate_batch_embeddings

router = APIRouter(prefix="/api/documents", tags=["Documents"])

MAX_FILE_SIZE = 10 * 1024 * 1024  

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
    total_size = 0

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

    # 1. Save document metadata to Neon database
    db_document = Document(filename=file.filename)
    db.add(db_document)
    db.commit()
    db.refresh(db_document)

    # 2. Chunk text
    chunks = chunk_document(
        document_id=db_document.id,
        pages=pages,
        chunk_size=800,
        overlap=120
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
        "message": "Document successfully uploaded, chunked, embedded, and saved to Neon PostgreSQL!"
    }