# Smart Receipt Analyzer

Python application that extracts structured data from PDF invoices using a vision-capable LLM, stores the results in PostgreSQL, and generates PDF expense reports. Includes a React web UI and REST API.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- An [OpenAI API key](https://platform.openai.com/api-keys)

## Quick start

1. Clone the repository and copy the environment file:

   ```bash
   cp .env.example .env
   ```

2. Set your OpenAI API key in `.env`:

   ```env
   OPENAI_API_KEY=sk-...
   ```

3. Start all services:

   ```bash
   docker compose up --build
   ```

4. Open the web UI at [http://localhost:5173](http://localhost:5173).

The backend API is available at [http://localhost:8000](http://localhost:8000). Interactive API docs are at [http://localhost:8000/docs](http://localhost:8000/docs).

## Usage

### Web UI

1. Click **Upload invoice** and either drag in a PDF or pick one of the sample invoices shown in the modal.
2. Wait for extraction to finish — structured fields and line items (with categories) are saved automatically.
3. Open an invoice card to review or edit extracted data.
4. Click **Generate PDF** to create an expense report on the server.
5. View generated reports under the **Your PDFs** tab, or download them from the report viewer.
6. Use the chat panel to ask natural-language questions about stored invoices (e.g. total spend, top vendors).

### Sample invoices

Test PDFs are in the [`samples/`](samples/) directory:

| File | Description |
|------|-------------|
| `receipt.pdf` | Sample receipt |
| `INV2.pdf` | Sample invoice |
| `inv3.pdf` | Sample invoice |

These are also offered in the upload modal when running the app.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/invoices/extract` | Upload a PDF invoice for extraction (multipart form field: `file`) |
| `GET` | `/invoices` | List all saved invoices |
| `GET` | `/invoices/{id}` | Get one invoice with line items and raw LLM response |
| `PATCH` | `/invoices/{id}` | Update extracted invoice data |
| `DELETE` | `/invoices/{id}` | Delete an invoice and related data |
| `GET` | `/invoices/{id}/image` | Download the original uploaded PDF |
| `POST` | `/invoices/{id}/expense-report` | Generate an expense report PDF |
| `GET` | `/expense-reports` | List generated expense report PDFs |
| `GET` | `/expense-reports/{id}` | Download a generated expense report PDF |
| `DELETE` | `/expense-reports/{id}` | Delete a generated expense report PDF |
| `POST` | `/invoices/ask` | Ask a question about stored invoices (JSON body: `message`, optional `session_id` UUID for thread memory) |

### Example: extract an invoice

```bash
curl -X POST http://localhost:8000/invoices/extract \
  -F "file=@samples/receipt.pdf"
```

### Example: generate an expense report

```bash
curl -X POST http://localhost:8000/invoices/1/expense-report
```

Each saved invoice includes a `raw_llm_response` field with the unmodified JSON returned by the model at extraction time, alongside the parsed/normalized fields used by the app.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  React UI   │────▶│   FastAPI   │────▶│  PostgreSQL  │
│  (nginx)    │     │   backend   │     │              │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
                           ▼
                    OpenAI API
                    (invoice extraction,
                     invoice Q&A agent)
```

- **Extraction:** PDF is sent to OpenAI (`gpt-5-mini`) with a structured JSON prompt. Line items are categorized and OCR errors corrected in a single pass.
- **Storage:** The raw LLM JSON response and parsed invoice fields are both persisted in PostgreSQL (`invoices.raw_llm_response` plus normalized columns and line items). Original uploaded PDFs and generated expense reports are stored as well.
- **Reports:** Expense report PDFs are built server-side with ReportLab from stored data; category totals are computed in code.
- **Q&A agent:** A LangChain agent with read-only SQL access to invoice views answers questions about stored data. Conversation history is persisted per `session_id` (LangGraph `thread_id`) in PostgreSQL via a checkpointer, including tool/SQL steps; older turns are summarized automatically when threads grow long.

## Project structure

```
├── backend/           # FastAPI app, LLM extraction, PDF generation
├── frontend/          # React + Vite web UI
├── db/init/           # PostgreSQL schema and migrations (run on first start)
├── samples/           # Sample invoice PDFs for testing
├── docker-compose.yml
├── .env.example
└── README.md
```

## Environment variables

See [`.env.example`](.env.example). The only required secret is `OPENAI_API_KEY`. Database variables have sensible defaults for local Docker use.

## Stopping

```bash
docker compose down
```

Invoice and report data persist in the `postgres_data` Docker volume across restarts. To reset the database:

```bash
docker compose down -v
```

If you already have a database volume from an older version, recreate it with `docker compose down -v` so migrations in `db/init/` (including `raw_llm_response`) are applied on the next start.