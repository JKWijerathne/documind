import fitz  # PyMuPDF
from fastapi import HTTPException

def extract_text_from_pdf(file_bytes: bytes):
    """
    Takes raw PDF bytes, opens it with PyMuPDF, and extracts text page by page.
    """
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        
        if len(doc) == 0:
            raise HTTPException(status_code=400, detail="The uploaded PDF file is empty.")
        
        extracted_pages = []
        
        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text()
            
            extracted_pages.append({
                "page_number": page_num + 1,
                "text": text.strip()
            })
            
        return extracted_pages

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read PDF file. It might be corrupted or password-protected: {str(e)}")