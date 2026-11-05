from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.pdf_service import extract_text_from_pdf

router = APIRouter(prefix="/api/documents", tags=["Documents"])

MAX_FILE_SIZE = 10 * 1024 * 1024  


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
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

    return {
        "filename": file.filename,
        "total_pages": len(pages),
        "pages": pages
    }