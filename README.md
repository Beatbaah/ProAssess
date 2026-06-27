# ProAssess

A full-stack cognitive assessment SaaS platform for modern hiring teams. Recruiters invite candidates by email, candidates complete structured reasoning tests across four domains, and AI generates an executive score profile the moment results are submitted.

---

## Features

### For Recruiters
- **Candidate Pipeline** — track every candidate through New → Under Review → Shortlisted → Rejected stages with recruiter notes
- **Email Invitations** — send personalised invite links tied to a specific job position; each link expires in 7 days
- **Position Management** — create and organise job roles; candidates are tagged to a position from the moment they register
- **Side-by-Side Comparison** — select 2–4 completed candidates and compare domain scores in a single view
- **CSV Export** — download the full candidate list with scores at any time
- **GDPR Compliance** — erase individual candidate records on request via the dashboard or API

### For Candidates
- **Four reasoning modules** — Numerical, Verbal, Logical, and Spatial (25 questions each, 20 minutes per module)
- **AI-graded results** — Gemini generates an executive summary and per-domain breakdown immediately on submission
- **Secure assessment flow** — distraction-free UI with timer, anti-navigation prompts, and tamper-proof grading
- **Data portability** — download or permanently erase personal data from the Settings page

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Tailwind CSS v4 |
| Backend | Express.js + Vite (middleware mode) |
| Runtime | Node.js via `tsx` |
| Auth | Firebase Authentication (client SDK) |
| Database | Cloud Firestore |
| AI | Google Gemini (`@google/genai`) |
| Email | Nodemailer (any SMTP provider) |
| Fonts | Plus Jakarta Sans (headings) · Inter (body) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with Authentication and Firestore enabled
- A Gemini API key (optional — AI summaries are skipped if not set)
- An SMTP provider for invite emails (optional — links still work without it)

### 1. Clone and install

```bash
git clone https://github.com/Beatbaah/ProAssess.git
cd ProAssess
npm install
```

### 2. Configure Firebase

Create `firebase-applet-config.json` in the project root (this file is gitignored):

```json
{
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "1:123456789:web:abc123"
}
```

### 3. Set environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

```env
# Firebase admin account (server-side Firestore access)
ADMIN_EMAIL=admin-proassess@system.com
ADMIN_PASSWORD=choose-a-strong-password

# Google Gemini (AI result summaries)
GEMINI_API_KEY=your-gemini-key

# App URL (used in invite email links)
APP_URL=http://localhost:3000

# SMTP — any provider works (Gmail, Resend, SendGrid, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=ProAssess <you@gmail.com>
```

### 4. Deploy Firestore rules

```bash
npx firebase deploy --only firestore:rules --project your-project-id
```

### 5. Run

```bash
npx tsx server.ts
```

Open [http://localhost:3000](http://localhost:3000).

---

## Demo Accounts

The login screen includes one-click demo launchers that auto-provision accounts on first use:

| Role | Email | Password |
|---|---|---|
| Candidate | `demo.candidate@proassess.com` | `demoCandidate123!` |
| Recruiter | `demo.recruiter@proassess.com` | `demoRecruiter123!` |

---

## Project Structure

```
ProAssess/
├── server.ts                  # Express + Vite server, all API routes
├── index.html                 # App entry point
├── src/
│   ├── App.tsx                # Root routing and auth state
│   ├── firebase.ts            # Firebase client initialisation
│   ├── components/
│   │   ├── AuthScreens.tsx    # Login / registration (with invite token support)
│   │   ├── Onboarding.tsx     # Candidate pre-assessment walkthrough
│   │   ├── RecruiterOnboarding.tsx  # Recruiter first-login welcome flow
│   │   ├── Dashboard.tsx      # Candidate assessment hub
│   │   ├── AssessmentInterface.tsx  # Timed question flow
│   │   ├── ResultsView.tsx    # Candidate results and AI summary
│   │   ├── RecruiterDashboard.tsx   # Pipeline, invitations, positions, comparison
│   │   ├── InviteModal.tsx    # Email invite flow
│   │   ├── Settings.tsx       # Profile, data export, account deletion
│   │   └── Sidebar.tsx        # Role-aware navigation
│   ├── context/
│   │   ├── AuthContext.tsx    # Firebase auth + Firestore profile
│   │   └── AssessmentContext.tsx   # Assessment state management
│   └── data/
│       └── questions.ts       # Full question bank (100 questions across 4 domains)
├── firestore.rules            # Firestore security rules
├── .env.example               # Environment variable template
└── firebase-applet-config.json  # Firebase config (gitignored — create locally)
```

---

## API Overview

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/questions` | — | Returns randomised question set |
| `POST` | `/api/submit-assessment` | — | Submits answers and triggers AI grading |
| `GET` | `/api/recruiter/candidates` | Recruiter UID | Returns all candidates with scores |
| `POST` | `/api/recruiter/invite` | Recruiter UID | Sends invite emails and stores tokens |
| `GET` | `/api/invite/:token` | — | Resolves an invite token to email + recruiter name |
| `PATCH` | `/api/invite/:token/accept` | — | Marks invite accepted and links to user account |
| `PATCH` | `/api/recruiter/candidate/:uid/pipeline` | Recruiter UID | Updates pipeline stage and notes |
| `GET` | `/api/recruiter/positions` | Recruiter UID | Lists recruiter's positions |
| `POST` | `/api/recruiter/positions` | Recruiter UID | Creates a new position |
| `DELETE` | `/api/recruiter/positions/:id` | Recruiter UID | Deletes a position |
| `GET` | `/api/candidate/export` | Bearer token | Downloads candidate's own data as JSON |
| `DELETE` | `/api/candidate/:uid/data` | Bearer token | Permanently erases a candidate's data |
| `DELETE` | `/api/recruiter/candidate/:uid/data` | Recruiter UID | Recruiter-triggered data erasure |

---

## Licence

MIT
