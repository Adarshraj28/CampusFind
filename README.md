# CampusFind — Galgotias University Lost & Found

A campus lost-and-found management system for **Galgotias University, Greater Noida**.

Students report what they have lost. The campus team logs what they have found. The app
automatically scores every lost/found pair, surfaces the strongest matches, and tracks
the claim through verification, approval and handover — with a full chain of custody
and an audit trail.

**Stack:** HTML5 · CSS3 · vanilla JavaScript. No frameworks, no bundler, no build step.

**Branding:** colours and typography are taken from the live Galgotias University
website — brand red `#BC1820`, charcoal `#202020`, Poppins body with Gotham Narrow
headings.

> Full documentation — what every file does, how the matching algorithm works, and the
> step-by-step Supabase go-live plan — is in **[`process.md`](process.md)**.

---

## Features

- **Report** lost items and log found items through a 5-step wizard with photo upload
- **Smart Match Score** — weighted algorithm across description, category, location,
  colour, date and brand
- **Browse** public lost/found listings with search, filters and pagination
- **Claim** an item by answering five verification questions
- **Claim lifecycle** with a legal state machine; rejections require a written reason
- **Next-step guidance** on every claim and every lost report, so nobody is ever left
  wondering what happens now — see `js/claims.js` (`NEXT_STEP`) and
  `js/items.js` (`lostOwnerGuidance`)
- **Staff and admin consoles** — reports, claims, users, audit log, analytics
- **QR case tags** (`LF-GU-2026-00124`) for scanning at the handover desk
- **Chain of custody** recorded for every item
- **Gallery photos** — every seeded report carries two branded category illustrations
  from `assets/items/`
- **Dark mode**, keyboard accessible, CDN-independent
- **Mobile-ready from 320px** — collapsing navbar and sidebar drawers, data tables
  that become cards instead of sideways-scrolling, one-up forms, 44px touch targets.
  Breakpoints and the three mobile bugs this fixed are documented in `process.md` §4.7

---

## Run it

The project is plain static files. Any local server works.

```bash
# Python
python -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>.

Use a local server rather than double-clicking `index.html` — browsers restrict
`localStorage` and cross-page behaviour on the `file://` protocol.

---

## Signing in

The app ships with realistic fictional accounts so every screen has data to show.

| Role | Email | Password |
|---|---|---|
| Student | `aarav.sharma@galgotiasuniversity.edu.in` | `Student@123` |
| Staff | `neha.gupta@galgotiasuniversity.edu.in` | `Staff@123` |
| Admin | `r.menon@galgotiasuniversity.edu.in` | `Admin@123` |
| Faculty | `kabir.rao@galgotiasuniversity.edu.in` | `Faculty@123` |

Every seeded account also carries a real-format university identifier, validated by
`js/validation.js`:

| Role | Identifier format | Example |
|---|---|---|
| Student | 2-digit entry year + school code + 3-digit programme + 4-digit serial | `24SCSE1010457` |
| Faculty / Staff / Admin | 4–5 letter prefix + 7 digits | `FASC2018088` |

`SCSE` is the School of Computing Science & Engineering. The register form normalises
input to upper case and strips spaces as you type, and explains the format inline.

The login page has **Reference profiles** buttons that fill the form. You still press
**Sign In**. These are fictional accounts from `js/seed.js` — never reuse a real campus
password.

Reset the data at any time: **admin → Settings → Reset sample data**.

---

## Project layout

```
├── index.html                Landing page
├── login / register / forgot-password.html
├── dashboard / profile / notifications / my-reports
├── lost-items / found-items / item-details
├── claims / claim-details
├── report-lost / report-found
├── admin / admin-reports / admin-claims / admin-users / admin-audit / admin-analytics
├── 403.html · 404.html
├── privacy.html              Privacy policy
├── logo.png                  Official university mark
├── assets/
│   ├── items/              20 branded category illustrations (2 per category)
│   ├── favicon.png         Official GU crest — browser tab icon
│   └── apple-touch-icon.png 180x180 opaque variant for iOS home screens
├── robots.txt · sitemap.xml  Public pages only; signed-in areas blocked
├── process.md                Full documentation
├── css/                      style · components · dashboard · auth · responsive
├── js/                       17 ES5-safe modules on one window.CF namespace
└── supabase/schema.sql       Tables, indexes, RLS policies, storage bucket
```

| File | Responsibility |
|---|---|
| `js/config.js` | Environment contract (Supabase URL, key, mode) |
| `js/utils.js` | DOM, escaping, formatting, icons, theme, debounce |
| `js/storage.js` | Data layer over `localStorage` + all repositories |
| `js/seed.js` | The shipped sample dataset (20 users, 30 reports, 10 claims) |
| `js/validation.js` | One validator per field/rule |
| `js/auth.js` | Sessions, roles, rate limiting, password change |
| `js/matching.js` | The Smart Match Score algorithm |
| `js/claims.js` | Claim lifecycle and transition rules |
| `js/reports.js` | Report wizards, image downscaling, review step |
| `js/items.js` | Listing and detail rendering |
| `js/dashboard.js` | Dashboard and profile pages |
| `js/admin.js` | All administration pages |
| `js/analytics.js` | Chart.js wrapper with a no-chart fallback |
| `js/qr.js` | QR generation with a text fallback |
| `js/api.js` | Supabase data-access layer (the backend swap target) |
| `js/app.js` | Page shell, guards, navigation, footer, toasts, modals |

`css/responsive.css` holds every breakpoint in one file (1024 / 980 / 820 / 640 / 400),
so responsive behaviour is easy to review and change in isolation.

---

## Deploying

Static hosting — Netlify, Vercel, GitHub Pages or Cloudflare Pages. No build command;
publish directory is the project root.

If you deploy under a subpath (`/campusfind/`), change `<base href="/">` to
`<base href="/campusfind/">` in every HTML file, and update the URLs in `sitemap.xml`.

**Scaling.** The static tier serves any number of concurrent users from a CDN at zero
backend cost. With Supabase wired in, the schema is indexed and protected by Row Level
Security, and `js/api.js` is designed around one-query-per-page rather than
one-query-per-row — see `process.md` §6 for the full capacity analysis.

### Launch checklist

- [ ] Serve over **HTTPS**
- [ ] Update the domain in `sitemap.xml`
- [ ] **Replace `assets/favicon.png` and `assets/apple-touch-icon.png` with the
      university's own supplied files** — the current ones were downloaded from the
      live site as placeholders. Same filenames, so no HTML changes needed
- [ ] Read `supabase/schema.sql` before enabling the backend — Row Level Security is the
      only thing protecting student data, because the anon key ships in the JavaScript
- [ ] Connect Supabase (see `process.md` §7)
- [ ] Remove `storage.ensureSeeded()` from `js/app.js` once real users exist
- [ ] Have the privacy policy reviewed by the university
- [ ] Add error monitoring before real traffic

---

## Backend plan

The app currently runs entirely in the browser. The backend contract is ready:

- `js/config.js` — reads Supabase URL and anon key
- `js/api.js` — the full data-access layer, mirrors the `js/storage.js` repository names
- `supabase/schema.sql` — 6 tables, all indexes, RLS policies, storage bucket, signup trigger
- `.env.example` — the environment variables

Set `CAMPUSFIND_MODE=auto` and the app switches to Postgres automatically. Step-by-step
instructions are in `process.md` §7.

---

## Graceful degradation

The app still works without its three CDN dependencies:

| Missing | Result |
|---|---|
| Chart.js | A readable "chart unavailable" notice; tables still show the data |
| qrcodejs | The case ID shown as a large readable card |
| Lucide | Bullet characters in place of icons |

---

## Limitations

Honest list of what is not production-ready yet:

- Authentication and storage are browser-side; passwords use a fast one-way digest,
  not bcrypt/argon2
- Sessions live in `localStorage`, so they are per-device
- No password-reset email is sent
- Login rate limiting is per-browser and can be bypassed
- Item photos are stored as compressed data URLs rather than in object storage
- No CI pipeline or automated test suite in this folder

`process.md` §8 lists the specific fix for each of these.

**Go live as-is for a pilot with fictional or low-sensitivity data. Do not put real
student personal data into the browser-only build** — it never leaves the device, so
there is no server-side access control or encryption at rest.

---

© Galgotias University · Campus Lost & Found Management System