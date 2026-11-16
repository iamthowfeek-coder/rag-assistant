# AI Support Copilot

Support teams answer the same customer questions again and again. This app reads the company's own documents,
drafts a reply with the sources shown, and a **person always approves** the reply before it reaches the customer.
When the documents do not contain the answer, the AI does not guess: the ticket goes to a person.

## Why not just Ctrl+F?
Ctrl+F finds a word in one open file; a person still has to read it, decide what it means and write the reply.
This app searches every document at once, writes the first draft, shows which passage each answer came from,
tracks the ticket, and escalates what it cannot answer. The pattern (retrieve passages, answer only from them,
show sources, keep a human in the loop) is called RAG, retrieval-augmented generation.

## What it does
- **Customer form** (`/ask`): no account needed. Rate limited, validated, with a hidden bot trap field.
- **Status page** (`/status`): the customer enters a reference number and the email they used to read the approved reply.
- **Knowledge base**: admins upload `.txt`, `.md` and `.pdf` files (many files or a whole folder), or paste text.
  Documents are split into passages and searched with MySQL FULLTEXT.
- **AI drafts with sources**: the AI may only use the passages it is given, must name which ones it used, and must say
  when they do not answer the question. No source, or "cannot answer", means the ticket is escalated.
- **Review screen** (`/tickets/:id`): the question next to the draft and its sources. An agent edits the text and clicks
  **Approve and send**. Nothing is sent without that click.
- **Optional email**: if SMTP settings are in `.env`, the approved reply is also emailed.
- **Suggested answers**: when a person answers a ticket the AI could not, they can suggest the answer for the knowledge
  base. An admin edits and approves it, so the system learns from real questions.
- **Dashboard** (admin): tickets by status, average time to reply, how many drafts were sent unchanged, tickets per day.
- **Team** (admin): add agents and admins, deactivate and reactivate accounts.
- **Accuracy test**: `npm run eval` runs 30 questions and reports how often the system answered or escalated correctly.

## How a ticket flows
```
Customer form  ->  ticket saved  ->  search the knowledge base
                                          |
                        no match? ------> ESCALATED (a person writes the reply)
                                          |
                                AI drafts from the passages only
                                          |
                  "cannot answer" or no source named? --> ESCALATED
                                          |
                                    DRAFT READY
                                          |
              agent reviews, edits, clicks "Approve and send"
                                          |
                  REPLIED -> status page (and email, if set up)
```

## Roles
| | Admin | Agent |
|---|---|---|
| Dashboard, team, suggested answers | yes | no |
| Add or delete documents | yes | no |
| Tickets: review, edit, send replies | yes | yes |
| Search the knowledge base | yes | yes |

Roles are checked on the server for every request, not only hidden in the screens.

## Tech
Node.js, Express, MySQL 8 (FULLTEXT search), React (Vite). Packages: multer (uploads), pdf-parse (PDFs),
nodemailer (optional email). The AI is called with Node's built-in `fetch`. No GPU or native packages.

## Run it locally
1. **Database.** In MySQL Workbench run `database/schema.sql` once (File > Open SQL Script, then the lightning bolt).
2. **Backend.** `cd backend`, copy `.env.example` to `.env` and fill it in, then:
   ```
   npm install
   npm run seed          # creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD in .env
   npm run seed-docs     # optional: loads the sample documents into the knowledge base
   npm start             # also upgrades an older database automatically
   ```
3. **Frontend** (second terminal). `cd frontend`, then `npm install` and `npm run dev`.
4. Open http://localhost:5173 and sign in as the admin. Customers use http://localhost:5173/ask.

Upgrading from an earlier phase: replace the files, run `npm install` in `backend`, and start the backend.
New tables and columns are added automatically at start-up.

### Settings in `backend/.env`
| Setting | Purpose |
|---|---|
| `DB_*` | MySQL connection |
| `JWT_SECRET` | Long random text (16+ characters) that signs login tokens |
| `ADMIN_*` | The first admin account (used by `npm run seed`) |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | The AI. Without a key a basic template draft is used so the flow can still be tried |
| `SMTP_*`, `MAIL_FROM` | Optional email. Leave blank to skip |
| `TRUST_PROXY` | Set to `1` when hosted behind a proxy |

## Try it (5 minutes)
1. `npm run seed-docs` (or upload the files in `sample-docs/` in the Knowledge base page).
2. Open `/ask` and send "How long does a refund take?". Open the Tickets tab: the ticket is **Awaiting review**
   with the draft and its source. Edit it and click **Approve and send**.
3. Open `/status`, enter the reference number and email: the reply is there.
4. Send "Do you offer student discounts?": it is **Needs a person**, because no document covers it.
   Write a reply, tick *Suggest this answer for the knowledge base*, send. Then open **Suggestions** as admin and approve it.
5. Open the **Dashboard**.

`test-questions.txt` lists more questions to try.

## Accuracy test
```
cd backend
npm run seed-docs
npm run eval
```
Runs 26 questions whose answers are in the sample documents and 4 whose answers are not, through the same search and
draft logic real tickets use. It reports (1) how often search found the right document, (2) how often the system drafted
from the right document, and (3) how often it correctly escalated a question that is not in the documents. The full
table is saved to `eval/results.md`. With an API key the result reflects the AI; without one the basic template
drafts anything that shares a word with a document, so fewer questions are escalated. The mode is printed in the report.

## Deploy
One server serves both the API and the website:
```
cd frontend && npm install && npm run build
cd ../backend && npm install && npm start
```
When `frontend/dist` exists, Express serves it, so the app runs on one port (3000 by default).

Checklist for a real deployment:
- MySQL 8 with InnoDB FULLTEXT support. Run `database/schema.sql` once.
- Set every secret as an environment variable on the host (never commit `.env`). Use a long random `JWT_SECRET`
  and a strong admin password.
- Serve over HTTPS, and set `TRUST_PROXY=1` when a proxy sits in front, so rate limits see real visitor addresses.
- Keep a single running instance: login and form rate limits are kept in memory.
- Set the `SMTP_*` values if you want email replies.

## Security notes
- Passwords are hashed with scrypt and a random salt. Failed logins are rate limited.
- Roles are enforced on the server. The user is loaded from the database on every request, so a deactivated
  account stops working immediately.
- All database queries use placeholders, so customer text cannot change a query.
- Customer text is given to the AI as data, with instructions to ignore commands inside it. The AI never sends anything;
  only a person can.
- The status page needs both the reference number and the email, and is rate limited. It only ever shows a reply a person approved.
- The API key and SMTP password stay on the server. Security headers are set on every response.

## Limits and ideas for later
- Search matches words, not meaning ("money back" will not find a passage that only says "refund").
  Embeddings would fix this and could replace the FULLTEXT step in `backend/search.js`.
- Passages are cut by size, not by topic. Smarter splitting would help long documents.
- Scanned PDFs have no text layer and need OCR (paste the text instead).
- Drafts are made inside the web server process. A queue would be better at high volume; tickets left unfinished by a
  restart are drafted again automatically when the server starts.
- A customer's follow-up questions start a new ticket; there are no conversation threads yet.

## Project layout
```
database/schema.sql        tables (users, documents, passages, tickets, kb_suggestions)
backend/
  server.js, db.js, migrate.js, auth.js, password.js, wrap.js
  chunk.js, docs.js, search.js        splitting, storing and searching documents
  ai.js, draft.js, mailer.js          the AI call, the draft/escalate decision, optional email
  seed.js, seed-docs.js, eval.js      first admin, sample documents, accuracy test
  routes/                             auth, users, documents, search, public, tickets, suggestions, stats
frontend/src/                         one file per page, router.js, ui.jsx, index.css (black and gold theme)
sample-docs/, pdf-test/               documents to try
eval/questions.json                   the 30 test questions
```
