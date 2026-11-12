import logging
import os

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Document, DocumentChunk
from app.services.pdf_service import extract_text_from_pdf
from app.chunking import chunk_document
from app.services.embedding_service import generate_batch_embeddings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["Documents"])

MAX_FILE_SIZE = 10 * 1024 * 1024
READ_CHUNK_SIZE = 64 * 1024
CHUNK_SIZE = 800
CHUNK_OVERLAP = 120


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
def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        stream = file.file

        header = stream.read(8)
        stream.seek(0)

        if not header.startswith(b"%PDF-"):
            raise HTTPException(
                status_code=400,
                detail="Invalid file format. The uploaded file is not a genuine PDF.",
            )

        contents = bytearray()
        total_size = 0

        while True:
            chunk = stream.read(READ_CHUNK_SIZE)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail="File size exceeds the maximum allowed limit of 10MB.",
                )
            contents.extend(chunk)

        pages = extract_text_from_pdf(bytes(contents))
        filename = os.path.basename(file.filename or "") or "untitled.pdf"

        db_document = Document(filename=filename)
        db.add(db_document)
        db.flush()

        chunks = chunk_document(
            document_id=db_document.id,
            pages=pages,
            chunk_size=CHUNK_SIZE,
            overlap=CHUNK_OVERLAP,
        )

        if not chunks:
            raise HTTPException(
                status_code=400,
                detail="No searchable text was found in the PDF.",
            )

        embeddings = generate_batch_embeddings([c["content"] for c in chunks])

        db.add_all(
            [
                DocumentChunk(
                    document_id=db_document.id,
                    page_number=chunk_data["page_number"],
                    chunk_index=chunk_data["chunk_index"],
                    content=chunk_data["content"],
                    embedding=embeddings[i],
                )
                for i, chunk_data in enumerate(chunks)
            ]
        )

        db.commit()

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        logger.exception("Failed to process uploaded document")
        raise HTTPException(
            status_code=500,
            detail="Failed to process the document. Please try again.",
        )

    return {
        "document_id": db_document.id,
        "filename": db_document.filename,
        "total_pages": len(pages),
        "total_chunks": len(chunks),
        "status": "ready",
        "message": "Document successfully uploaded, chunked, embedded, and saved.",
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