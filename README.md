# Documind

**A document assistant that lets you ask questions about your PDFs and get answers based on their content.**

DocuMind is a full-stack application that uses Retrieval-Augmented Generation (RAG) to make PDF documents searchable through natural language questions.

It extracts text from uploaded PDFs, splits the content into smaller chunks, and stores them along with their vector embeddings in PostgreSQL using pgvector. When a user asks a question, the application retrieves relevant passages and uses Google Gemini to generate an answer based on the retrieved content.

## Features

- **PDF Upload and Processing:** Upload PDF files up to 10 MB. Text is extracted page by page using PyMuPDF, cleaned, and split into overlapping chunks. Repeated headers and footers are also removed during processing.
- **Semantic Search:** Uses `sentence-transformers/all-MiniLM-L6-v2` to generate 384-dimensional embeddings and PostgreSQL with pgvector to find relevant passages.
- **AI-Powered Q&A:** Ask questions about uploaded documents. A LangGraph workflow retrieves relevant content and passes it to Gemini to generate context-based answers.
- **Source References:** Answers include the document filename and page numbers of the passages used to generate them.
- **Conversation History:** Conversations and messages are stored in PostgreSQL, allowing users to reopen previous chats and continue where they left off.
- **Document Management:** View uploaded documents, start conversations about specific documents, and delete documents along with their associated chunks.

## Architecture

```mermaid
flowchart LR
    Browser["Browser"]
    Next["Next.js UI"]
    API["FastAPI"]
    PDF["PDF extraction and chunking"]
    Embed["Sentence Transformers"]
    Graph["LangGraph RAG workflow"]
    DB[("PostgreSQL + pgvector")]
    Gemini["Google Gemini"]

    Browser --> Next
    Next --> API
    API --> PDF
    PDF --> Embed
    Embed --> DB
    API --> Graph
    Graph --> Embed
    Graph --> DB
    Graph --> Gemini
    Gemini --> Graph
    Graph --> API
    API --> Next
```

### How it works

1. **Upload:** A PDF is uploaded through the frontend and sent to the FastAPI backend.
2. **Extract and process:** PyMuPDF extracts text from each page. The extracted text is cleaned and divided into overlapping chunks while retaining page information.
3. **Generate embeddings:** Sentence Transformers converts each chunk into a 384-dimensional vector, which is stored in PostgreSQL using pgvector.
4. **Retrieve relevant content:** When a question is submitted, LangGraph generates an embedding for the query and retrieves the most relevant document chunks using cosine similarity.
5. **Generate an answer:** The retrieved passages are passed to Google Gemini as context to generate an answer.
6. **Save the conversation:** The answer, source information, and conversation messages are returned to the frontend and saved in PostgreSQL.

## Technology Stack

| Area | Technologies |
|---|---|
| Frontend | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4 |
| Backend API | Python 3.12, FastAPI, Pydantic Settings, SQLAlchemy |
| Database | PostgreSQL, pgvector, Psycopg 3 |
| PDF Processing | PyMuPDF |
| Embeddings | Sentence Transformers, `all-MiniLM-L6-v2` |
| RAG Workflow | LangGraph, LangChain Core |
| AI Model | Google Gemini via `google-genai` |

## Requirements

Make sure the following are installed before running the application:

- Python 3.12
- Node.js 20.9 or later
- npm
- PostgreSQL with the `vector` (pgvector) extension available
- A Google Gemini API key
- Internet access on the backend's first start to download the embedding model, unless it is already cached locally

The backend automatically runs `CREATE EXTENSION IF NOT EXISTS vector` and creates the required database tables at startup. The PostgreSQL user must have permission to enable the extension and create tables.

You can use any PostgreSQL provider that supports pgvector.

## Setup and Installation

### 1. Clone the repository

```powershell
git clone https://github.com/JKWijerathne/documind.git

Set-Location documind
```

### 2. Set up the backend

Open a terminal in the project root and run:

```powershell
Set-Location backend

py -3.12 -m venv .venv

.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip

pip install -r requirements.txt

Copy-Item .env.example .env
```

Open `backend/.env` and update the configuration:

```dotenv
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require

GEMINI_API_KEY=your_gemini_api_key

GEMINI_MODEL=gemini-3.8-flash

HF_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
```

Replace the database connection details with the connection URL provided by your PostgreSQL provider. Add your Gemini API key as well.

If your database username or password contains special characters, URL-encode them where necessary.

The model value shown above matches the backend's configured default. If it is not available for your API key, change it to a supported Gemini model.

**Important:** Keep your `.env` file private. Never commit your API keys or database credentials to GitHub.

Start the backend from the `backend` directory:

```powershell
uvicorn app.main:app --reload
```

The API will be available at:

- API: http://127.0.0.1:8000
- Swagger documentation: http://127.0.0.1:8000/docs

You can also check the backend and database status using:

- `GET /health`
- `GET /health/db`

### 3. Set up the frontend

Open a second terminal in the project root:

```powershell
Set-Location frontend

npm ci

npm run dev
```

Once the development server starts, open:

http://localhost:3000

By default, the Next.js server forwards API requests to `http://127.0.0.1:8000`.

If your backend runs at a different address, set `DOCUMIND_API_URL` before starting the frontend:

```powershell
$env:DOCUMIND_API_URL = "http://127.0.0.1:8000"

npm run dev
```

The API proxy is configured in `frontend/next.config.ts`.

For deployment, update `DOCUMIND_API_URL` to point to your deployed backend.

## Running Tests

### Backend

Activate the backend virtual environment, navigate to the `backend` directory, and run:

```powershell
python -m pytest
```

### Frontend

From the `frontend` directory, run the following commands:

```powershell
npm test

npm run typecheck

npm run lint

npm run build
```

The backend tests use SQLite and mock external model calls. They are useful for testing application logic but do not replace testing against a PostgreSQL database with pgvector and the configured Gemini API.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Check whether the API is running |
| GET | `/health/db` | Check database connectivity |
| GET | `/api/documents/` | Retrieve all indexed documents |
| POST | `/api/documents/upload` | Upload and process a PDF |
| DELETE | `/api/documents/{document_id}` | Delete a document and its associated chunks |
| POST | `/api/search/` | Search for relevant document passages |
| POST | `/api/chat/` | Ask a question and save the conversation |
| GET | `/api/chat/conversations` | Retrieve saved conversations |
| GET | `/api/chat/conversations/{conversation_id}` | Load a conversation and its messages |
