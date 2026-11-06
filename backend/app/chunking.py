import re
import math
from collections import defaultdict


def clean_text(text: str) -> str:
  
    # Remove null characters
    text = text.replace("\x00", " ")

    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # Replace multiple spaces and tabs with a single space
    text = re.sub(r"[ \t]+", " ", text)

    # Remove spaces around line breaks
    text = re.sub(r" *\n *", "\n", text)

    # Reduce 3 or more consecutive newlines to 2
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


def remove_repeated_headers_footers(pages: list[dict]) -> list[dict]:
    
    if len(pages) < 2:
        return [
            {
                **page,
                "text": clean_text(page.get("text", ""))
            }
            for page in pages
        ]

    edge_occurrences = defaultdict(set)

    # Identify lines appearing strictly at the top or bottom edges of pages
    for page_index, page in enumerate(pages):
        lines = [
            line.strip()
            for line in clean_text(page.get("text", "")).splitlines()
            if line.strip()
        ]
        
        if not lines:
            continue

        # Look only at the first 2 or last 2 lines of the page
        edge_lines = set(lines[:2] + lines[-2:])

        for line in edge_lines:
            if len(line) <= 120:
                edge_occurrences[line].add(page_index)

    # A line must appear on at least 60% of pages to be considered a header/footer
    threshold = max(2, math.ceil(len(pages) * 0.6))

    repeated_edge_lines = {
        line
        for line, page_indexes in edge_occurrences.items()
        if len(page_indexes) >= threshold
    }

    cleaned_pages = []

    for page in pages:
        raw_text = clean_text(page.get("text", ""))
        lines = raw_text.splitlines()
        filtered_lines = []

        for line in lines:
            stripped = line.strip()
            # Only filter out the line if it's a confirmed header/footer located near an edge
            is_edge = len(lines) > 0 and (stripped == lines[0] or stripped == lines[-1] or (len(lines) > 1 and stripped == lines[1]))
            if stripped in repeated_edge_lines and is_edge:
                continue
            filtered_lines.append(line)

        cleaned_pages.append({
            **page,
            "text": clean_text("\n".join(filtered_lines))
        })

    return cleaned_pages


def chunk_text(
    text: str,
    chunk_size: int = 800,
    overlap: int = 120
) -> list[str]:
   
    if chunk_size <= 0:
        raise ValueError("chunk_size must be positive")

    if overlap < 0 or overlap >= chunk_size:
        raise ValueError("overlap must be smaller than chunk_size")

    text = clean_text(text)

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))

        if end < len(text):
            min_boundary = start + int(chunk_size * 0.6)
            separators = ["\n\n", "\n", ". ", " "]

            for separator in separators:
                boundary = text.rfind(
                    separator,
                    min_boundary,
                    end
                )

                if boundary != -1:
                    end = boundary + len(separator)
                    break

        chunk = text[start:end].strip()

        if chunk:
            chunks.append(chunk)

        if end >= len(text):
            break


        next_start = max(start + 1, end - overlap)

        while (
            next_start < end
            and not text[next_start - 1].isspace()
        ):
            next_start += 1

        start = next_start

    return chunks


def chunk_document(
    document_id,
    pages: list[dict],
    chunk_size: int = 800,
    overlap: int = 120
) -> list[dict]:
    
    cleaned_pages = remove_repeated_headers_footers(pages)
    all_chunks = []

    for page in cleaned_pages:
        page_number = page["page_number"]
        text = page["text"]

        page_chunks = chunk_text(
            text,
            chunk_size=chunk_size,
            overlap=overlap
        )

        for chunk in page_chunks:
            all_chunks.append({
                "document_id": document_id,
                "page_number": page_number,
                "chunk_index": len(all_chunks),
                "content": chunk
            })

    return all_chunks