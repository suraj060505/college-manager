// server.js — College Manager V2
// Roles: student, teacher, admin
// Features: login/signup, attendance self-mark + teacher approval + lock,
//           admin override + audit log, routine, notices, profile, documents
// -----------------------------------------------------------------------
// SETUP:
// 1. npm install
// 2. Set env vars: SESSION_SECRET (any random string)
// 3. Run: node server.js
// 4. Default admin login is created automatically: username "admin", password "admin123"
//    CHANGE THIS PASSWORD after first login via the admin panel (or edit data/users.json).

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const BRANCHES = ['CSE', 'Mechanical', 'Electrical', 'Civil', 'Electronics'];
const DAYS = ['MON', 'TUE', 'WED', 'THUR', 'FRI', 'SAT'];

// ---------- Data files setup ----------
const FILES = {
  users: path.join(DATA_DIR, 'users.json'),
  attendance: path.join(DATA_DIR, 'attendance.json'),
  pending: path.join(DATA_DIR, 'pending.json'),
  summary: path.join(DATA_DIR, 'summary.json'),
  notices: path.join(DATA_DIR, 'notices.json'),
  routine: path.join(DATA_DIR, 'routine.json'),
  profiles: path.join(DATA_DIR, 'profiles.json'),
  documents: path.join(DATA_DIR, 'documents.json'),
  audit: path.join(DATA_DIR, 'audit.json')
};

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

function ensureFile(filePath, defaultValue) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
}
ensureFile(FILES.users, []);
ensureFile(FILES.attendance, {});
ensureFile(FILES.pending, {});
ensureFile(FILES.summary, {});
ensureFile(FILES.notices, {});
ensureFile(FILES.routine, {});
ensureFile(FILES.profiles, {});
ensureFile(FILES.documents, {});
ensureFile(FILES.audit, []);

function readJSON(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ---------- Seed default admin ----------
(async () => {
  const users = readJSON(FILES.users);
  if (!users.find(u => u.username === 'admin')) {
    const hash = await bcrypt.hash('admin123', 10);
    users.push({
      id: 'admin',
      name: 'Administrator',
      username: 'admin',
      password: hash,
      branch: 'ALL',
      role: 'admin',
      createdAt: new Date().toISOString()
    });
    writeJSON(FILES.users, users);
    console.log('Default admin created — username: admin / password: admin123 (CHANGE THIS)');
  }
})();

// ---------- Multer for document uploads ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

// ---------- Middleware ----------
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', requireLoginMiddleware, express.static(UPLOADS_DIR));
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

function requireLoginMiddleware(req, res, next) {
  if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  next();
}
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Not logged in' });
    if (!roles.includes(req.session.role)) return res.status(403).json({ error: 'Not authorized for this action' });
    next();
  };
}
function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function findUser(username) {
  const users = readJSON(FILES.users);
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

// ================= AUTH ROUTES =================

app.post('/api/register', async (req, res) => {
  try {
    const { name, username, password, branch } = req.body;
    if (!name || !username || !password || !branch) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (!BRANCHES.includes(branch)) return res.status(400).json({ error: 'Invalid branch' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const users = readJSON(FILES.users);
    if (findUser(username)) return res.status(409).json({ error: 'Username already taken' });

    const hash = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      name, username, password: hash,
      branch, role: 'student',
      createdAt: new Date().toISOString()
    };
    users.push(newUser);
    writeJSON(FILES.users, users);

    req.session.userId = newUser.id;
    req.session.username = newUser.username;
    req.session.role = 'student';
    req.session.branch = newUser.branch;
    res.json({ success: true, user: { name: newUser.name, username, role: 'student', branch } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = findUser(username || '');
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    const match = await bcrypt.compare(password || '', user.password);
    if (!match) return res.status(401).json({ error: 'Invalid username or password' });

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.branch = user.branch;
    res.json({ success: true, user: { name: user.name, username: user.username, role: user.role, branch: user.branch } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ loggedIn: false });
  const user = findUser(req.session.username);
  if (!user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: { name: user.name, username: user.username, role: user.role, branch: user.branch } });
});

// ================= STUDENT: ATTENDANCE =================

app.get('/api/attendance/status', requireRole('student'), (req, res) => {
  const attendance = readJSON(FILES.attendance);
  const key = `${req.session.username}_${today()}`;
  res.json({ record: attendance[key] || null });
});

app.post('/api/attendance/mark', requireRole('student'), (req, res) => {
  const { status } = req.body; // "present" or "absent"
  if (!['present', 'absent'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const attendance = readJSON(FILES.attendance);
  const key = `${req.session.username}_${today()}`;
  if (attendance[key]) return res.status(409).json({ error: 'Already marked for today. Waiting for approval or already processed.' });

  attendance[key] = { status, approvalStatus: 'pending', locked: false, date: today() };
  writeJSON(FILES.attendance, attendance);

  const pending = readJSON(FILES.pending);
  const pkey = `${req.session.branch}_${today()}`;
  if (!pending[pkey]) pending[pkey] = [];
  if (!pending[pkey].includes(req.session.username)) pending[pkey].push(req.session.username);
  writeJSON(FILES.pending, pending);

  res.json({ success: true });
});

app.get('/api/attendance/summary', requireRole('student'), (req, res) => {
  const summary = readJSON(FILES.summary);
  const s = summary[req.session.username] || { total: 0, present: 0 };
  const pct = s.total === 0 ? null : Math.round((s.present / s.total) * 1000) / 10;
  res.json({ ...s, percentage: pct });
});

app.get('/api/attendance/history', requireRole('student'), (req, res) => {
  const attendance = readJSON(FILES.attendance);
  const mine = Object.entries(attendance)
    .filter(([key]) => key.startsWith(req.session.username + '_'))
    .map(([key, val]) => val)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json({ history: mine });
});

// ================= TEACHER: APPROVALS =================

app.get('/api/teacher/pending', requireRole('teacher', 'admin'), (req, res) => {
  const branch = req.query.branch || req.session.branch;
  const pending = readJSON(FILES.pending);
  const pkey = `${branch}_${today()}`;
  res.json({ pending: pending[pkey] || [] });
});

app.post('/api/teacher/approve', requireRole('teacher', 'admin'), (req, res) => {
  const { username } = req.body;
  const attendance = readJSON(FILES.attendance);
  const key = `${username}_${today()}`;
  const record = attendance[key];
  if (!record) return res.status(404).json({ error: 'No record found for this student today' });
  if (record.locked) return res.status(409).json({ error: 'Already locked' });

  record.approvalStatus = 'approved';
  record.locked = true;
  attendance[key] = record;
  writeJSON(FILES.attendance, attendance);

  const summary = readJSON(FILES.summary);
  const s = summary[username] || { total: 0, present: 0 };
  s.total += 1;
  if (record.status === 'present') s.present += 1;
  summary[username] = s;
  writeJSON(FILES.summary, summary);

  removeFromPendingQueue(username, req.session.branch || findUser(username).branch);
  res.json({ success: true });
});

app.post('/api/teacher/reject', requireRole('teacher', 'admin'), (req, res) => {
  const { username } = req.body;
  const attendance = readJSON(FILES.attendance);
  const key = `${username}_${today()}`;
  const record = attendance[key];
  if (!record) return res.status(404).json({ error: 'No record found' });

  record.approvalStatus = 'rejected';
  record.locked = false;
  attendance[key] = record;
  delete attendance[key]; // allow re-marking today
  writeJSON(FILES.attendance, attendance);

  removeFromPendingQueue(username, req.session.branch || findUser(username).branch);
  res.json({ success: true });
});

function removeFromPendingQueue(username, branch) {
  const pending = readJSON(FILES.pending);
  const pkey = `${branch}_${today()}`;
  if (pending[pkey]) {
    pending[pkey] = pending[pkey].filter(u => u !== username);
    writeJSON(FILES.pending, pending);
  }
}

// ================= ADMIN: USERS =================

app.get('/api/admin/users', requireRole('admin'), (req, res) => {
  const users = readJSON(FILES.users).map(u => ({
    name: u.name, username: u.username, role: u.role, branch: u.branch
  }));
  res.json({ users });
});

app.post('/api/admin/users', requireRole('admin'), async (req, res) => {
  const { name, username, password, branch, role } = req.body;
  if (!name || !username || !password || !branch || !role) {
    return res.status(400).json({ error: 'All fields required' });
  }
  if (!['teacher', 'admin'].includes(role)) return res.status(400).json({ error: 'Role must be teacher or admin' });
  if (findUser(username)) return res.status(409).json({ error: 'Username already exists' });

  const users = readJSON(FILES.users);
  const hash = await bcrypt.hash(password, 10);
  users.push({ id: Date.now().toString(), name, username, password: hash, branch, role, createdAt: new Date().toISOString() });
  writeJSON(FILES.users, users);
  res.json({ success: true });
});

app.delete('/api/admin/users/:username', requireRole('admin'), (req, res) => {
  const users = readJSON(FILES.users);
  const filtered = users.filter(u => u.username !== req.params.username);
  if (filtered.length === users.length) return res.status(404).json({ error: 'User not found' });
  writeJSON(FILES.users, filtered);
  res.json({ success: true });
});

// ================= ADMIN: ATTENDANCE OVERRIDE =================

app.post('/api/admin/override', requireRole('admin'), (req, res) => {
  const { username, date, status } = req.body;
  if (!username || !date || !['present', 'absent'].includes(status)) {
    return res.status(400).json({ error: 'username, date, and status (present/absent) required' });
  }
  const attendance = readJSON(FILES.attendance);
  const key = `${username}_${date}`;
  const oldRecord = attendance[key] || null;
  const wasLockedAndApproved = oldRecord && oldRecord.locked && oldRecord.approvalStatus === 'approved';

  attendance[key] = { status, approvalStatus: 'approved', locked: true, date, overriddenByAdmin: true };
  writeJSON(FILES.attendance, attendance);

  // adjust summary: if it was already counted, undo old, add new; else just add new
  const summary = readJSON(FILES.summary);
  const s = summary[username] || { total: 0, present: 0 };
  if (wasLockedAndApproved) {
    if (oldRecord.status === 'present') s.present -= 1;
  } else {
    s.total += 1;
  }
  if (status === 'present') s.present += 1;
  summary[username] = s;
  writeJSON(FILES.summary, summary);

  const audit = readJSON(FILES.audit);
  audit.push({
    timestamp: new Date().toISOString(),
    admin: req.session.username,
    action: 'override attendance',
    target: username,
    date,
    oldValue: oldRecord,
    newValue: attendance[key]
  });
  writeJSON(FILES.audit, audit);

  res.json({ success: true });
});

app.get('/api/admin/audit', requireRole('admin'), (req, res) => {
  const audit = readJSON(FILES.audit).slice().reverse();
  res.json({ audit });
});

// ================= ROUTINE =================

app.get('/api/routine/:branch', requireLogin, (req, res) => {
  const routine = readJSON(FILES.routine);
  res.json({ routine: routine[req.params.branch] || {} });
});

app.post('/api/routine/:branch', requireRole('admin'), (req, res) => {
  const { day, periods } = req.body; // periods = array of 6 strings
  if (!DAYS.includes(day) || !Array.isArray(periods)) return res.status(400).json({ error: 'Invalid day or periods' });

  const routine = readJSON(FILES.routine);
  if (!routine[req.params.branch]) routine[req.params.branch] = {};
  routine[req.params.branch][day] = periods;
  writeJSON(FILES.routine, routine);
  res.json({ success: true });
});

// ================= NOTICES =================

app.get('/api/notices/:branch', requireLogin, (req, res) => {
  const notices = readJSON(FILES.notices);
  res.json({ notices: (notices[req.params.branch] || []).slice().reverse() });
});

app.post('/api/notices', requireRole('teacher', 'admin'), (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Notice text required' });

  const notices = readJSON(FILES.notices);
  const entry = { text, date: new Date().toISOString(), postedBy: req.session.username };
  const targets = req.session.role === 'admin' ? BRANCHES : [req.session.branch];
  for (const branch of targets) {
    if (!notices[branch]) notices[branch] = [];
    notices[branch].push(entry);
  }
  writeJSON(FILES.notices, notices);
  res.json({ success: true });
});

// ================= PROFILE =================

app.get('/api/profile', requireLogin, (req, res) => {
  const profiles = readJSON(FILES.profiles);
  res.json({ profile: profiles[req.session.username] || null });
});

app.post('/api/profile', requireLogin, (req, res) => {
  const profiles = readJSON(FILES.profiles);
  profiles[req.session.username] = { ...req.body, updatedAt: new Date().toISOString() };
  writeJSON(FILES.profiles, profiles);
  res.json({ success: true });
});

// ================= DOCUMENTS =================

app.get('/api/documents', requireLogin, (req, res) => {
  const documents = readJSON(FILES.documents);
  res.json({ documents: documents[req.session.username] || [] });
});

app.post('/api/documents', requireLogin, upload.single('document'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const documents = readJSON(FILES.documents);
  if (!documents[req.session.username]) documents[req.session.username] = [];
  documents[req.session.username].push({
    filename: req.file.filename,
    originalName: req.file.originalname,
    uploadedAt: new Date().toISOString(),
    label: req.body.label || req.file.originalname
  });
  writeJSON(FILES.documents, documents);
  res.json({ success: true });
});

app.delete('/api/documents/:filename', requireLogin, (req, res) => {
  const documents = readJSON(FILES.documents);
  const mine = documents[req.session.username] || [];
  const doc = mine.find(d => d.filename === req.params.filename);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  documents[req.session.username] = mine.filter(d => d.filename !== req.params.filename);
  writeJSON(FILES.documents, documents);

  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  res.json({ success: true });
});

// ================= AI CHATBOT (Gemini) =================

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-3.7-flash'; // latest stable Gemini model (as of Aug 2026)

app.post('/api/chat', requireLogin, async (req, res) => {
  try {
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set on the server. Add it in your hosting provider\'s environment variables.' });
    }
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: 'Message is required' });

    const contents = [];
    if (Array.isArray(history)) {
      for (const turn of history) {
        contents.push({ role: turn.role === 'assistant' ? 'model' : 'user', parts: [{ text: turn.content }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: `You are the 24/7 AI helper inside a College Manager app for a Diploma Computer Science student in India. Help with academic doubts, general college queries, and app usage questions. Be clear, concise, and encouraging. The user's role is: ${req.session.role}.` }]
        }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Gemini API error:', data);
      return res.status(502).json({ error: data.error?.message || 'Gemini API request failed' });
    }
    const reply = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || 'Sorry, I could not generate a response.';
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error while contacting Gemini API' });
  }
});

// ================= MISC =================

app.get('/api/branches', (req, res) => res.json({ branches: BRANCHES }));
app.get('/api/days', (req, res) => res.json({ days: DAYS }));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`College Manager V2 running on port ${PORT}`);
});
