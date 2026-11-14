import pytest
from fastapi import HTTPException

from app.services.pdf_service import extract_text_from_pdf


def test_extract_text_from_pdf_preserves_page_numbers_and_text(make_pdf_bytes):
    pdf_bytes = make_pdf_bytes(
        ["First page text.", "Second page has another fact."]
    )

    pages = extract_text_from_pdf(pdf_bytes)

    assert [page["page_number"] for page in pages] == [1, 2]
    assert "First page text." in pages[0]["text"]
    assert "Second page has another fact." in pages[1]["text"]


def test_corrupt_pdf_returns_a_client_error():
    with pytest.raises(HTTPException) as error:
        extract_text_from_pdf(b"not a PDF")

    assert error.value.status_code == 400
    assert "corrupted" in error.value.detail
