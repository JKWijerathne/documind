import re
import math
from collections import defaultdict

# How many non-empty lines at the top/ bottom of a page count as "edge" lines
EDGE_LINE_COUNT = 2
# Header/footer lines are short, longer lines are real content
MAX_HEADER_LENGTH = 120


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


def unwrap_lines(text: str) -> str:
    return re.sub(r"(?<!\n)\n(?!\n)", " ", text)


def _normalize_line(line: str) -> str:
    return re.sub(r"\d+", "#", line.strip().lower())


def _edge_positions(lines: list[str]) -> set[int]:
    
    non_empty = [i for i, line in enumerate(lines) if line.strip()]
    return set(non_empty[:EDGE_LINE_COUNT] + non_empty[-EDGE_LINE_COUNT:])


def remove_repeated_headers_footers(pages: list[dict]) -> list[dict]:
    cleaned_pages = [
        {**page, "text": clean_text(page.get("text", ""))}
        for page in pages
    ]

    if len(cleaned_pages) < 2:
        return cleaned_pages

    edge_occurrences = defaultdict(set)

    # Detection: which normalized lines show up at the page edges?
    for page_index, page in enumerate(cleaned_pages):
        lines = page["text"].splitlines()

        for position in _edge_positions(lines):
            line = lines[position].strip()
            if len(line) <= MAX_HEADER_LENGTH:
                edge_occurrences[_normalize_line(line)].add(page_index)

    # A line must appear at the edges of at least 60% of pages
    threshold = max(2, math.ceil(len(cleaned_pages) * 0.6))

    repeated_edge_lines = {
        line
        for line, page_indexes in edge_occurrences.items()
        if len(page_indexes) >= threshold
    }

    if not repeated_edge_lines:
        return cleaned_pages

    result = []

    for page in cleaned_pages:
        lines = page["text"].splitlines()
        edges = _edge_positions(lines)

        kept = [
            line
            for position, line in enumerate(lines)
            if not (
                position in edges
                and _normalize_line(line) in repeated_edge_lines
            )
        ]

        result.append({**page, "text": clean_text("\n".join(kept))})

    return result


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
        text = unwrap_lines(page["text"])

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