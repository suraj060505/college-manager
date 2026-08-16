# College Manager V2 — Full System (Web App)

## Features
- **3 Roles:** Student, Teacher, Admin
- **Attendance:** Student self-marks → goes pending → Teacher approves/rejects → once approved it's **locked** (immutable) and counts toward official percentage
- **Admin:** Add/remove Teacher & Admin accounts, override locked attendance (fully audit-logged), post notices to all branches, edit routine for any branch
- **Teacher:** Approve/reject pending attendance for their branch, post notices to their branch, view routine
- **Student:** Mark attendance, view routine, view notices, edit personal + education profile, upload/view/delete personal documents

## New: Dark/Light Mode + AI Chatbot

- **Theme toggle** button top-right on every page — preference saved in the browser, persists across visits.
- **AI Helper chatbot** (floating button, bottom-right, on Student/Teacher/Admin dashboards) — powered by Gemini's latest model (`gemini-3.7-flash` as of Aug 2026). Answers academic doubts and app questions, 24/7.
- To enable the chatbot, add environment variable `GEMINI_API_KEY` (same as before) — get a free key at https://aistudio.google.com/apikey
- If Gemini later releases a newer model, just update the `GEMINI_MODEL` constant near the top of `server.js` — one line change.

## Default login (created automatically on first run)
- Username: `admin`
- Password: `admin123`
- **Change this immediately** after first login by removing the old admin entry in `data/users.json` and creating a new admin via the panel, or edit the file directly.

## Setup on Render

1. Push this whole folder to a GitHub repo (root of repo, not nested in a subfolder)
2. On Render: New → Web Service → connect your repo
3. Settings:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Instance Type: Free
4. Environment Variables:
   - `SESSION_SECRET` → any random string
5. Create Web Service → wait for deploy → open the URL

## Setup locally
```bash
npm install
export SESSION_SECRET="any_random_string"
node server.js
```
Open `http://localhost:3000`

## How the attendance lock works
1. Student taps Present/Absent → record status = `pending`, `locked: false`
2. Teacher sees it in their Pending Approvals tab → Approve or Reject
3. **Approve** → status = `approved`, `locked: true` → counted in official percentage → nothing in the app can change it except Admin Override
4. **Reject** → record deleted → student can mark again same day
5. Admin Override → only path to change a locked record → every override writes an entry to `data/audit.json` (who, when, what changed)

## File structure
```
college-manager-v2/
├── server.js              → all backend logic & API routes
├── package.json
├── data/                   → auto-created JSON "database" files
│   ├── users.json
│   ├── attendance.json
│   ├── pending.json
│   ├── summary.json
│   ├── notices.json
│   ├── routine.json
│   ├── profiles.json
│   ├── documents.json
│   └── audit.json
├── uploads/                → uploaded student documents
└── public/
    ├── index.html          → login
    ├── register.html       → student signup
    ├── student.html        → student dashboard (5 tabs)
    ├── teacher.html        → teacher dashboard (3 tabs)
    ├── admin.html          → admin dashboard (5 tabs)
    └── style.css
```

## Adding routine data (e.g. your CSE Semester III routine)
Login as Admin → Edit Routine tab → select branch + day → fill 6 periods → Save. Repeat for each day/branch. No code editing needed.

## Notes
- Data is stored as JSON files on disk — fine for a college project demo. On Render's free tier, the disk is **not persistent** across restarts/redeploys, so data can reset. For a permanent production version, migrate to a real database (Render offers free Postgres) — ask me if you want this upgrade later.
- Document uploads: images and PDFs, max 10MB each.
- To change the default admin password: safest way is to delete the `data/users.json` entry with username "admin", restart the server (it will reseed with admin/admin123), then immediately go to Manage Users and note you'll want to eventually add a "change password" feature — ask me if you want that added.
