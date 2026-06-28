import express from 'express';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import rateLimit from 'express-rate-limit';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, writeBatch, limit, query, getDoc, deleteDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

// Load Firebase configuration
import config from './firebase-applet-config.json';
import { QUESTIONS_BANK } from './src/data/questions';

const app = express();
app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────────────────────

// Broad limit on all API routes — prevents general scraping / probing
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  skip: (req) => !req.path.startsWith('/api'),
});
app.use(globalApiLimiter);

// Tight limit on assessment submission — one real candidate needs at most ~5 per session
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Submission limit reached. Please wait before trying again.' },
});

// Invite sending — prevent spam campaigns
const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Invite sending limit reached. Please try again in an hour.' },
});

const PORT = 3000;

// Verify a Firebase ID token by calling the Firebase REST API.
// Returns the uid if valid, null otherwise.
async function verifyIdToken(idToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    const data = await res.json() as any;
    return data?.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

// Express middleware: checks Bearer token, attaches req.verifiedUid.
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const uid = await verifyIdToken(header.slice(7));
  if (!uid) return res.status(401).json({ error: 'Invalid or expired token' });
  (req as any).verifiedUid = uid;
  next();
}

// Initialize Firebase client on the server side
const firebaseConfig = {
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  projectId: config.projectId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  appId: config.appId
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = (config as any).firestoreDatabaseId 
  ? getFirestore(firebaseApp, (config as any).firestoreDatabaseId) 
  : getFirestore(firebaseApp);

// Authenticate as system admin first to bypass Firestore rules
async function authenticateAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin-proassess@system.com';
  const password = process.env.ADMIN_PASSWORD;
  if (!password) { console.warn('ADMIN_PASSWORD not set — skipping admin auth'); return; }

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    console.log('Successfully signed in as admin:', userCred.user.email);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email' || error.code === 'auth/cannot-find-user') {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        console.log('Successfully created admin user:', userCred.user.email);
      } catch (createErr: any) {
        console.error('Error creating admin user:', createErr.message);
      }
    } else {
      console.error('Error signing in admin:', error.message);
    }
  }
}

// Function to seed questions to Firestore if they do not exist
async function seedQuestions() {
  try {
    console.log('Checking if questions need to be seeded...');
    const assessmentsCol = collection(db, 'assessments');
    const snapshot = await getDocs(query(assessmentsCol, limit(1)));
    
    if (snapshot.empty) {
      console.log(`Seeding ${QUESTIONS_BANK.length} questions into Firestore...`);
      const batch = writeBatch(db);
      
      for (const question of QUESTIONS_BANK) {
        const docRef = doc(db, 'assessments', question.id);
        batch.set(docRef, question);
      }
      
      await batch.commit();
      console.log('Seeding completed successfully!');
    } else {
      console.log('Questions already seeded in Firestore.');
    }
  } catch (error) {
    console.error('Error during database seeding:', error);
  }
}

// Initialize Gemini API (lazy initialized)
let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({ apiKey });
    }
  }
  return aiClient;
}

// =================== API ENDPOINTS ===================

// Fetch client-safe questions (strips correct answers and explanations)
app.get('/api/questions', async (req, res) => {
  try {
    const assessmentsCol = collection(db, 'assessments');
    const snapshot = await getDocs(assessmentsCol);
    
    // Fallback to local QUESTIONS_BANK if Firestore is empty or fails
    let questions = QUESTIONS_BANK;
    if (!snapshot.empty) {
      questions = snapshot.docs.map(doc => doc.data() as typeof QUESTIONS_BANK[0]);
    }
    
    // Sort questions by ID to maintain consistent ordering
    questions.sort((a, b) => a.id.localeCompare(b.id));

    // Strip correct answer index and explanation
    const clientSafeQuestions = questions.map(q => ({
      id: q.id,
      category: q.category,
      text: q.text,
      options: q.options
    }));
    
    res.json({ questions: clientSafeQuestions });
  } catch (error: any) {
    console.error('Error fetching questions:', error);
    // Safe fallback to avoid blocking the app
    const fallback = QUESTIONS_BANK.map(q => ({
      id: q.id,
      category: q.category,
      text: q.text,
      options: q.options
    }));
    res.json({ questions: fallback });
  }
});

// Securely calculate and submit assessment
app.post('/api/submit-assessment', submitLimiter, async (req, res) => {
  try {
    const { userId, userEmail, userDisplayName, answers, integrityData } = req.body;
    
    if (!userId || !answers) {
      return res.status(400).json({ error: 'Missing userId or answers' });
    }

    // Scores per category (Numerical, Verbal, Logical, Spatial)
    const categoryScores: Record<string, number> = {
      Numerical: 0,
      Verbal: 0,
      Logical: 0,
      Spatial: 0
    };
    
    // Grade each question
    for (const question of QUESTIONS_BANK) {
      const userAnswer = answers[question.id];
      if (userAnswer !== undefined && userAnswer === question.correctAnswerIndex) {
        categoryScores[question.category] += 1;
      }
    }

    const totalScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0);
    const percentages: Record<string, number> = {
      Numerical: Math.round((categoryScores.Numerical / 25) * 100),
      Verbal: Math.round((categoryScores.Verbal / 25) * 100),
      Logical: Math.round((categoryScores.Logical / 25) * 100),
      Spatial: Math.round((categoryScores.Spatial / 25) * 100)
    };

    // Generate high-impact professional feedback with Gemini
    let feedback = `You scored ${totalScore}/100. `;
    const strengths: string[] = [];
    const opportunities: string[] = [];
    
    for (const [cat, pct] of Object.entries(percentages)) {
      if (pct >= 70) {
        strengths.push(cat);
      } else if (pct < 50) {
        opportunities.push(cat);
      }
    }

    if (strengths.length > 0) {
      feedback += `Your primary strengths lie in ${strengths.join(' and ')} fields, demonstrating high capability. `;
    }
    if (opportunities.length > 0) {
      feedback += `There is room for development in ${opportunities.join(' and ')} domains. `;
    } else {
      feedback += `You displayed balanced competence across all cognitive dimensions tested. `;
    }

    const ai = getAiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: `Provide a formal, highly professional executive summary of the candidate's cognitive profile based on these results of ProAssess (the recruitment platform).
Candidate Name: ${userDisplayName || 'Candidate'}
Performance breakdown:
- Numerical Reasoning: ${categoryScores.Numerical}/25 (${percentages.Numerical}%)
- Verbal Reasoning: ${categoryScores.Verbal}/25 (${percentages.Verbal}%)
- Logical Reasoning: ${categoryScores.Logical}/25 (${percentages.Logical}%)
- Spatial Reasoning: ${categoryScores.Spatial}/25 (${percentages.Spatial}%)
Total Score: ${totalScore}/100

Format as 3-4 professional sentences focusing on their strengths, cognitive agility, and corporate readiness. Keep it strictly objective, supportive, and formal. Avoid any reference to internal code or formulas.`
        });
        
        if (response.text) {
          feedback = response.text.trim();
        }
      } catch (aiError) {
        console.error('Error generating feedback via Gemini:', aiError);
      }
    }

    const submittedAt = new Date().toISOString();
    const resultId = `${userId}_${Date.now()}`;

    // Summarise integrity flags stored with result and surfaced in recruiter view
    const integritySummary = integrityData ? {
      blurCount:       integrityData.blurCount       ?? 0,
      copyAttempts:    integrityData.copyAttempts    ?? 0,
      fullscreenExits: integrityData.fullscreenExits ?? 0,
      speedFlags:      integrityData.speedFlags      ?? {},
      flagged: (integrityData.blurCount > 3) ||
               (integrityData.copyAttempts > 0) ||
               (Object.values(integrityData.speedFlags ?? {}).some(Boolean)),
    } : null;

    // Per-question correctness breakdown (question text not included — client joins via questions array)
    const questionBreakdown = QUESTIONS_BANK.map(q => ({
      id: q.id,
      category: q.category,
      isCorrect: answers[q.id] === q.correctAnswerIndex,
    }));

    const assessmentResult = {
      id: resultId,
      userId,
      userEmail,
      userDisplayName: userDisplayName || 'Anonymous Candidate',
      scores: categoryScores,
      totalScore,
      categoryPercentages: percentages,
      submittedAt,
      feedback,
      questionBreakdown,
      ...(integritySummary && { integrity: integritySummary }),
    };

    // Save Result to Firestore securely via Client SDK (authorized as admin)
    const resultDocRef = doc(db, 'results', resultId);
    await setDoc(resultDocRef, assessmentResult);

    // Update User Profile — include integrity summary so recruiter pipeline can show badge
    const userDocRef = doc(db, 'users', userId);
    await setDoc(userDocRef, {
      status: 'Completed',
      lastSubmittedAt: submittedAt,
      aggregateScore: totalScore,
      ...(integritySummary && { integrity: integritySummary }),
    }, { merge: true });

    // Notify the recruiter who invited this candidate (fire-and-forget)
    try {
      const candidateProfile = (await getDoc(doc(db, 'users', userId))).data();
      const recruiterUid = candidateProfile?.invitedBy;
      if (recruiterUid) {
        const recruiterProfile = (await getDoc(doc(db, 'users', recruiterUid))).data();
        const recruiterEmail = recruiterProfile?.email;
        const mailer = getMailer();
        if (recruiterEmail && mailer) {
          const from = process.env.SMTP_FROM || process.env.SMTP_USER;
          await mailer.sendMail({
            from,
            to: recruiterEmail,
            subject: `${userDisplayName || 'A candidate'} has completed their ProAssess evaluation`,
            html: buildCompletionEmail(userDisplayName || 'A candidate', totalScore, percentages, recruiterProfile?.displayName || 'Recruiter'),
          });
        }
      }
    } catch (notifyErr: any) {
      console.warn('Recruiter completion notification failed:', notifyErr.message);
    }

    res.json({ success: true, result: assessmentResult });
  } catch (error: any) {
    console.error('Error submitting assessment:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Fetch candidate profiles and assessment results for recruiters
app.get('/api/recruiter/candidates', async (req, res) => {
  try {
    const requesterId = req.query.requesterId as string;
    if (!requesterId) {
      return res.status(400).json({ error: 'Missing requesterId parameter' });
    }

    // Verify requester role
    const requesterDoc = await getDoc(doc(db, 'users', requesterId));
    if (!requesterDoc.exists()) {
      return res.status(403).json({ error: 'Unauthorized: Requester profile not found' });
    }

    const requesterData = requesterDoc.data();
    if (requesterData?.role !== 'recruiter') {
      return res.status(403).json({ error: 'Unauthorized: Requester does not have recruiter role' });
    }

    // Fetch all candidates (exclude recruiters)
    const usersCol = collection(db, 'users');
    const usersSnap = await getDocs(usersCol);
    const candidates = usersSnap.docs
      .map(doc => doc.data())
      .filter(u => u.role !== 'recruiter');

    // Fetch all results
    const resultsCol = collection(db, 'results');
    const resultsSnap = await getDocs(resultsCol);
    const results = resultsSnap.docs.map(doc => doc.data());

    res.json({ success: true, candidates, results });
  } catch (error: any) {
    console.error('Error fetching recruiter dashboard data:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// =================== EMAIL / INVITE ===================

function getMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

function buildInviteEmail(to: string, recruiterName: string, inviteUrl: string, personalMessage?: string) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
        <!-- Header -->
        <tr>
          <td style="background:#002366;padding:28px 36px">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:32px;height:32px;background:#ffffff;border-radius:8px;text-align:center;vertical-align:middle">
                  <span style="color:#002366;font-size:16px;font-weight:700;line-height:32px">P</span>
                </td>
                <td style="padding-left:10px;color:#ffffff;font-size:16px;font-weight:600">ProAssess</td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 24px">
            <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase">Cognitive Assessment Invitation</p>
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0f172a;line-height:1.3">
              You've been invited to complete a ProAssess evaluation
            </h1>
            <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6">
              <strong style="color:#0f172a">${recruiterName}</strong> has invited you to complete a professional cognitive assessment on ProAssess.
            </p>
            ${personalMessage ? `
            <div style="background:#f8fafc;border-left:3px solid #002366;border-radius:0 8px 8px 0;padding:14px 18px;margin-bottom:24px">
              <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;font-style:italic">"${personalMessage}"</p>
            </div>` : ''}
            <table cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:0;margin-bottom:28px;width:100%">
              <tr>
                <td style="padding:14px 18px;border-bottom:1px solid #e2e8f0">
                  <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">What to expect</span>
                </td>
              </tr>
              ${[
                ['100 questions', '4 cognitive reasoning sections'],
                ['80 minutes total', '20 minutes per section'],
                ['AI-graded report', 'Generated upon completion'],
              ].map(([a, b]) => `
              <tr>
                <td style="padding:10px 18px;border-bottom:1px solid #f1f5f9">
                  <span style="font-size:13px;font-weight:600;color:#0f172a">${a}</span>
                  <span style="font-size:13px;color:#64748b"> · ${b}</span>
                </td>
              </tr>`).join('')}
            </table>
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#002366;border-radius:8px">
                  <a href="${inviteUrl}" style="display:inline-block;padding:13px 28px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none">
                    Begin Assessment →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:18px 0 0;font-size:12px;color:#94a3b8">
              Or copy this link: <a href="${inviteUrl}" style="color:#002366;word-break:break-all">${inviteUrl}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 36px;border-top:1px solid #f1f5f9;background:#f8fafc">
            <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6">
              This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.
              ProAssess · Cognitive Assessment Platform
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
  return { to, subject: `${recruiterName} has invited you to complete a ProAssess assessment`, html };
}

function buildCompletionEmail(candidateName: string, totalScore: number, percentages: Record<string, number>, recruiterName: string) {
  const rows = Object.entries(percentages).map(([cat, pct]) => `
    <tr>
      <td style="padding:9px 18px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#0f172a;font-weight:600">${cat}</td>
      <td style="padding:9px 18px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b">${pct}%</td>
    </tr>`).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Inter',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden">
        <tr><td style="background:#002366;padding:28px 36px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:32px;height:32px;background:#ffffff;border-radius:8px;text-align:center;vertical-align:middle">
              <span style="color:#002366;font-size:16px;font-weight:700;line-height:32px">P</span>
            </td>
            <td style="padding-left:10px;color:#ffffff;font-size:16px;font-weight:600">ProAssess</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:36px 36px 24px">
          <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:0.08em;text-transform:uppercase">Assessment Complete</p>
          <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#0f172a;line-height:1.3">
            ${candidateName} has completed their evaluation
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.6">
            Hi ${recruiterName}, your candidate scored <strong style="color:#0f172a">${totalScore}/100</strong> on the ProAssess cognitive assessment. Log in to view their full profile and integrity report.
          </p>
          <table cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;width:100%;margin-bottom:28px">
            <tr><td style="padding:12px 18px;border-bottom:1px solid #e2e8f0;background:#f8fafc">
              <span style="font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em">Score Breakdown</span>
            </td></tr>
            ${rows}
          </table>
        </td></tr>
        <tr><td style="padding:0 36px 32px">
          <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">This is an automated notification from ProAssess.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// Send candidate invitations
app.post('/api/recruiter/invite', inviteLimiter, async (req, res) => {
  try {
    const { requesterId, emails, personalMessage, positionId, positionName } = req.body;
    if (!requesterId || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Missing requesterId or emails' });
    }

    const requesterDoc = await getDoc(doc(db, 'users', requesterId));
    if (!requesterDoc.exists() || requesterDoc.data()?.role !== 'recruiter') {
      return res.status(403).json({ error: 'Unauthorized: recruiter role required' });
    }

    const recruiterName = requesterDoc.data()?.displayName || 'A recruiter';
    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
    const mailer  = getMailer();

    const results = await Promise.all(emails.map(async (email: string) => {
      const token      = crypto.randomBytes(24).toString('hex');
      const expiresAt  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const inviteUrl  = `${appUrl}?invite=${token}`;

      await setDoc(doc(db, 'invitations', token), {
        token, email: email.toLowerCase().trim(),
        invitedBy: requesterId, recruiterName,
        invitedAt: new Date().toISOString(),
        expiresAt, status: 'pending',
        personalMessage: personalMessage || null,
        positionId: positionId || null,
        positionName: positionName || null,
      });

      let emailSent = false;
      if (mailer) {
        try {
          const from = process.env.SMTP_FROM || process.env.SMTP_USER;
          await mailer.sendMail({ from, ...buildInviteEmail(email, recruiterName, inviteUrl, personalMessage) });
          emailSent = true;
        } catch (mailErr: any) {
          console.error('Email send failed for', email, mailErr.message);
        }
      }

      return { email, token, inviteUrl, emailSent };
    }));

    res.json({ success: true, invited: results });
  } catch (error: any) {
    console.error('Error sending invitations:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// List invitations sent by a recruiter
app.get('/api/recruiter/invitations', async (req, res) => {
  try {
    const requesterId = req.query.requesterId as string;
    if (!requesterId) return res.status(400).json({ error: 'Missing requesterId' });

    const requesterDoc = await getDoc(doc(db, 'users', requesterId));
    if (!requesterDoc.exists() || requesterDoc.data()?.role !== 'recruiter') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const snap = await getDocs(collection(db, 'invitations'));
    const invitations = snap.docs
      .map(d => d.data())
      .filter(i => i.invitedBy === requesterId)
      .sort((a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime());

    res.json({ success: true, invitations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve an invite token (used by the auth page to pre-fill the email)
app.get('/api/invite/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const inviteDoc = await getDoc(doc(db, 'invitations', token));
    if (!inviteDoc.exists()) return res.status(404).json({ error: 'Invitation not found' });

    const data = inviteDoc.data();
    if (new Date(data.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    res.json({ success: true, email: data.email, recruiterName: data.recruiterName, status: data.status, positionName: data.positionName || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Mark invitation as accepted (called after successful registration)
app.patch('/api/invite/:token/accept', async (req, res) => {
  try {
    const { token } = req.params;
    const { uid } = req.body;
    const now = new Date().toISOString();

    const inviteDoc = await getDoc(doc(db, 'invitations', token));
    if (!inviteDoc.exists()) return res.status(404).json({ error: 'Invitation not found' });

    const inviteData = inviteDoc.data();
    if (new Date(inviteData.expiresAt) < new Date()) {
      return res.status(410).json({ error: 'Invitation has expired' });
    }

    await setDoc(doc(db, 'invitations', token), { status: 'registered', acceptedAt: now }, { merge: true });

    // Write invite metadata to the user's profile for pipeline linkage and completion notifications
    if (uid) {
      const profileUpdate: Record<string, any> = {};
      if (inviteData.positionName) {
        profileUpdate.positionName = inviteData.positionName;
        profileUpdate.positionId = inviteData.positionId || null;
      }
      if (inviteData.invitedBy) profileUpdate.invitedBy = inviteData.invitedBy;
      if (Object.keys(profileUpdate).length > 0) {
        await setDoc(doc(db, 'users', uid), profileUpdate, { merge: true });
      }
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update pipeline status and recruiter notes for a candidate
app.patch('/api/recruiter/candidate/:uid/pipeline', async (req, res) => {
  try {
    const { uid } = req.params;
    const { requesterId, pipelineStatus, recruiterNotes, positionName } = req.body;

    if (!requesterId) return res.status(400).json({ error: 'Missing requesterId' });

    const requesterDoc = await getDoc(doc(db, 'users', requesterId));
    if (!requesterDoc.exists() || requesterDoc.data()?.role !== 'recruiter') {
      return res.status(403).json({ error: 'Unauthorized: Recruiter role required' });
    }

    const allowed = ['new', 'under_review', 'shortlisted', 'rejected', null];
    if (!allowed.includes(pipelineStatus)) {
      return res.status(400).json({ error: 'Invalid pipelineStatus value' });
    }

    const update: Record<string, any> = {
      pipelineUpdatedAt: new Date().toISOString(),
      pipelineUpdatedBy: requesterId,
    };
    if (pipelineStatus !== undefined) update.pipelineStatus = pipelineStatus;
    if (recruiterNotes !== undefined) update.recruiterNotes = recruiterNotes;
    if (positionName !== undefined) update.positionName = positionName;

    await setDoc(doc(db, 'users', uid), update, { merge: true });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating pipeline:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Bulk update pipeline status for multiple candidates
app.patch('/api/recruiter/candidates/bulk-pipeline', async (req, res) => {
  try {
    const { requesterId, uids, pipelineStatus } = req.body;

    if (!requesterId || !Array.isArray(uids) || uids.length === 0) {
      return res.status(400).json({ error: 'Missing requesterId or uids' });
    }

    const requesterDoc = await getDoc(doc(db, 'users', requesterId));
    if (!requesterDoc.exists() || requesterDoc.data()?.role !== 'recruiter') {
      return res.status(403).json({ error: 'Unauthorized: Recruiter role required' });
    }

    const allowed = ['new', 'under_review', 'shortlisted', 'rejected'];
    if (!allowed.includes(pipelineStatus)) {
      return res.status(400).json({ error: 'Invalid pipelineStatus value' });
    }

    const batch = writeBatch(db);
    for (const uid of uids) {
      batch.set(doc(db, 'users', uid), {
        pipelineStatus,
        pipelineUpdatedAt: new Date().toISOString(),
        pipelineUpdatedBy: requesterId,
      }, { merge: true });
    }
    await batch.commit();

    res.json({ success: true, updated: uids.length });
  } catch (error: any) {
    console.error('Error bulk-updating pipeline:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// =================== POSITIONS ===================

app.get('/api/recruiter/positions', async (req, res) => {
  try {
    const requesterId = req.query.requesterId as string;
    if (!requesterId) return res.status(400).json({ error: 'Missing requesterId' });

    const requesterDoc = await getDoc(doc(db, 'users', requesterId));
    if (!requesterDoc.exists() || requesterDoc.data()?.role !== 'recruiter') {
      return res.status(403).json({ error: 'Recruiter access required' });
    }

    const snap = await getDocs(collection(db, 'positions'));
    const positions = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((p: any) => p.createdBy === requesterId)
      .sort((a: any, b: any) => a.createdAt > b.createdAt ? 1 : -1);

    res.json({ success: true, positions });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/recruiter/positions', async (req, res) => {
  try {
    const { requesterId, name, department } = req.body;
    if (!requesterId || !name?.trim()) return res.status(400).json({ error: 'Missing requesterId or name' });

    const requesterDoc = await getDoc(doc(db, 'users', requesterId));
    if (!requesterDoc.exists() || requesterDoc.data()?.role !== 'recruiter') {
      return res.status(403).json({ error: 'Recruiter access required' });
    }

    const id = crypto.randomBytes(8).toString('hex');
    const position = {
      id,
      name: name.trim(),
      department: department?.trim() || null,
      createdBy: requesterId,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'positions', id), position);
    res.json({ success: true, position });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/recruiter/positions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const requesterId = req.query.requesterId as string;
    if (!requesterId) return res.status(400).json({ error: 'Missing requesterId' });

    const requesterDoc = await getDoc(doc(db, 'users', requesterId));
    if (!requesterDoc.exists() || requesterDoc.data()?.role !== 'recruiter') {
      return res.status(403).json({ error: 'Recruiter access required' });
    }

    const posDoc = await getDoc(doc(db, 'positions', id));
    if (!posDoc.exists() || posDoc.data()?.createdBy !== requesterId) {
      return res.status(403).json({ error: 'Position not found or unauthorized' });
    }

    await deleteDoc(doc(db, 'positions', id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =================== COMPLIANCE / DATA MANAGEMENT ===================

// Candidate exports their own data — requires valid Firebase ID token matching the uid
app.get('/api/candidate/export', requireAuth, async (req, res) => {
  try {
    const uid = req.query.uid as string;
    if (!uid) return res.status(400).json({ error: 'Missing uid' });
    if ((req as any).verifiedUid !== uid) return res.status(403).json({ error: 'Token does not match requested uid' });

    const [userSnap, draftSnap, allResultsSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDoc(doc(db, 'drafts', uid)),
      getDocs(collection(db, 'results')),
    ]);

    if (!userSnap.exists()) return res.status(404).json({ error: 'User not found' });

    const myResults = allResultsSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((r: any) => r.userId === uid);

    const exportData = {
      exportedAt: new Date().toISOString(),
      profile: userSnap.data(),
      assessmentResults: myResults,
      drafts: draftSnap.exists() ? draftSnap.data() : null,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="proassess-data-${uid.slice(0, 8)}.json"`);
    res.json(exportData);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Candidate deletes their own data — requires valid Firebase ID token matching the uid
app.delete('/api/candidate/:uid/data', requireAuth, async (req, res) => {
  try {
    const { uid } = req.params;
    if (!uid) return res.status(400).json({ error: 'Missing uid' });
    if ((req as any).verifiedUid !== uid) return res.status(403).json({ error: 'Token does not match requested uid' });

    const allResultsSnap = await getDocs(collection(db, 'results'));
    const myResults = allResultsSnap.docs.filter(d => d.data().userId === uid);

    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid));
    batch.delete(doc(db, 'drafts', uid));
    myResults.forEach(d => batch.delete(d.ref));
    await batch.commit();

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Recruiter removes a candidate's data (GDPR / right to erasure)
app.delete('/api/recruiter/candidate/:uid/data', async (req, res) => {
  try {
    const { uid } = req.params;
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ error: 'Missing requesterId' });

    const requesterDoc = await getDoc(doc(db, 'users', requesterId));
    if (!requesterDoc.exists() || requesterDoc.data()?.role !== 'recruiter') {
      return res.status(403).json({ error: 'Recruiter access required' });
    }

    const allResultsSnap = await getDocs(collection(db, 'results'));
    const theirResults = allResultsSnap.docs.filter(d => d.data().userId === uid);

    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', uid));
    batch.delete(doc(db, 'drafts', uid));
    theirResults.forEach(d => batch.delete(d.ref));
    await batch.commit();

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Seed DB and start Vite
async function startServer() {
  // Authenticate as system admin first to bypass Firestore rules
  await authenticateAdmin();

  // Now seed questions
  await seedQuestions();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ProAssess Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
