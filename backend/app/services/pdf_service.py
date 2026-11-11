import pymupdf
from fastapi import HTTPException


def extract_text_from_pdf(file_bytes: bytes) -> list[dict]:
  
    try:
        doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read the PDF file. It may be corrupted.",
        )

    with doc:
        if doc.needs_pass:
            raise HTTPException(
                status_code=400,
                detail="Password-protected PDFs are not supported.",
            )

        if len(doc) == 0:
            raise HTTPException(
                status_code=400,
                detail="The uploaded PDF file is empty.",
            )

        try:
            return [
                {
                    "page_number": index + 1,
                    "text": page.get_text().strip(),
                }
                for index, page in enumerate(doc)
            ]
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Could not extract text from the PDF file.",
            )