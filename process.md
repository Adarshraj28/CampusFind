# CampusFind — Complete Process Document

**Project:** Campus Lost & Found Management System
**Institution:** Galgotias University, Greater Noida
**Stack:** HTML5 · CSS3 · vanilla JavaScript (no frameworks, no build step)

This document explains, in plain language, **what was built, how it works, what every
file does, and exactly what to do next to take it live.**

Read sections 1–3 if you are new to web development. Sections 4–7 are for whoever
will review or deploy the project.

---

## Table of contents

1. [What the application does](#1-what-the-application-does)
2. [How to run it on your machine](#2-how-to-run-it-on-your-machine)
3. [Folder structure — what every file does](#3-folder-structure--what-every-file-does)
4. [How the code works (the moving parts)](#4-how-the-code-works-the-moving-parts)
5. [Design system — the Galgotias University branding](#5-design-system--the-galgotias-university-branding)
6. [How this scales to about 1000 concurrent users](#6-how-this-scales-to-about-1000-concurrent-users)
7. [Going live with Supabase (step by step)](#7-going-live-with-supabase-step-by-step)
8. [Security notes and honest limitations](#8-security-notes-and-honest-limitations)
9. [Glossary](#9-glossary)

---

## 1. What the application does

CampusFind is a lost-and-found register for a university campus.

### The problem
Students lose phones, bags, ID cards and books. Security staff and the lost & found
desk collect the same items. Today that is handled on paper or scattered WhatsApp
groups, so owners never find their belongings and staff cannot trace who has what.

### The solution
A web application where a student can **report** something they lost, the campus team
can **log** something they found, and the app automatically **suggests matches**
between the two. The owner then answers a few verification questions, staff approve
the handover, and the whole chain of custody is recorded.

### Roles

| Role | What they can do |
|---|---|
| **Student** | Report lost items, browse found items, claim an item, track claim status |
| **Faculty** | Everything a student can do, plus sees claims raised against items they logged |
| **Staff** | Log found items, review and decide claims, update secure-storage status |
| **Admin** | Everything above, plus manage user accounts, edit/archive any report, read audit logs, view analytics |

### The Smart Match Score
This is the core idea. When someone reports a lost item, the app scores it against
every open found item and surfaces the closest ones above a threshold (default 70%).

The score is a weighted sum of six signals:

| Signal | Weight | What it compares |
|---|---|---|
| Description | 30% | Word-by-word similarity of the free-text description |
| Category | 20% | Electronics vs Bag vs Documents, etc. |
| Location | 15% | Same building? Same zone? |
| Colour | 15% | Exact / partial / different |
| Date | 10% | How close the dates are |
| Brand | 10% | Brand and model string overlap |

Weights, the threshold and the location-zone list all live in `js/matching.js`, so
tuning the algorithm never means touching a user interface file.

### Status lifecycles

**Reports**
`open → matched → returned → closed`, with `archived` available to admins.

**Claims**
`PENDING → UNDER_REVIEW → APPROVED → ITEM_RETURNED`
with `REJECTED`, `CANCELLED` and `MORE_INFO` as side states.

Legal transitions are enforced in `js/claims.js` — the UI cannot skip a step, and a
rejection always requires a written reason.

### The journey never goes quiet

A handover involves at least four people — the finder, the owner, the reviewer and the
desk — and the state machine alone leaves each of them wondering "what now?". Two
guidance panels close that gap.

**On the claim** (`js/claims.js`). `NEXT_STEP` maps all seven statuses to a title and a
body; `nextStepHtml(claim, user)` renders it on `claim-details.html` directly under the
progress bar. Reviewers get a separate map, `NEXT_STEP_REVIEWER`, because "your claim
is queued" is the wrong thing to tell someone who is the one holding the queue.

> `requestMoreInfo()` does **not** change the status — it sets `infoRequested` and keeps
> the claim at `PENDING` or `UNDER_REVIEW`. So `resolveStepKey()` selects the
> `MORE_INFO` copy from that flag, not from `claim.status`. Reading the status alone
> would silently show the wrong instruction at exactly the moment the claimant is
> being asked for something.

**On the lost report** (`js/items.js`). `lostOwnerGuidance(report, user)` covers the
person who *lost* the thing, who never appears on the claim page. It returns the linked
claim's next step if one exists, otherwise "we found N likely matches" with a link to
the strongest one, otherwise "we are watching for this item". It returns an empty string
for anyone who is not the owner, so no panel leaks across accounts.

Both are verified end-to-end: seven statuses on the live `claim-details.html` in both
claimant and reviewer voice, plus the owner panel and its non-owner case.

---

## 2. How to run it on your machine

You do **not** need Node.js, npm, or any build tool. The project is plain files.

### Option A — VS Code (easiest)

1. Install [Visual Studio Code](https://code.visualstudio.com/).
2. Open the `CampusFind` folder.
3. Install the **Live Server** extension (the icon with a small server).
4. Right-click `index.html` → **Open with Live Server**.
5. A browser opens at `http://127.0.0.1:5500/index.html`.

### Option B — Python (if you have Python installed)

```bash
cd CampusFind
python -m http.server 8000
```

Then open <http://localhost:8000>.

### Option C — Node.js

```bash
cd CampusFind
npx serve .
```

### Why a server at all?
Opening `index.html` by double-clicking works, but the browser blocks some features
from `file://` (service workers, fetch, and the `<base>` path). Use a local server.

### Signing in

The app ships with realistic fictional accounts so every screen has data.

| Role | Email | Password |
|---|---|---|
| Student | `aarav.sharma@galgotiasuniversity.edu.in` | `Student@123` |
| Staff | `neha.gupta@galgotiasuniversity.edu.in` | `Staff@123` |
| Admin | `r.menon@galgotiasuniversity.edu.in` | `Admin@123` |
| Faculty | `kabir.rao@galgotiasuniversity.edu.in` | `Faculty@123` |

The login page has **Reference profiles** buttons that fill the form for you.
You still have to press **Sign In**.

> These are fictional accounts from `js/seed.js`. Never reuse a real campus password.

### Resetting the data
Signed in as **admin** → **Settings** (sidebar) → **Reset sample data**.

---

## 3. Folder structure — what every file does

```
CampusFind/
├── index.html               Landing page (hero, how it works, features, about, CTA)
├── login.html               Sign-in page
├── register.html            Create-account page
├── forgot-password.html     Password reset request page
├── 403.html                 "Access denied" page (role check failed)
├── 404.html                 "Page not found" page
├── privacy.html             Privacy policy (required before real student data)
│
├── dashboard.html           Signed-in home: stats, quick actions, matches, activity
├── profile.html             Personal details + change password + session
├── notifications.html       Notification centre (tabs, mark read, clear)
├── my-reports.html          Everything I have reported
├── lost-items.html          Public browser for lost items
├── found-items.html         Public browser for found items
├── item-details.html        One item: photos, match score, claim button, QR code
├── claims.html              My claims list
├── claim-details.html       One claim: answers, timeline, staff decision
├── report-lost.html         5-step wizard to report a lost item
├── report-found.html        5-step wizard to log a found item
│
├── admin.html               Admin overview: charts + claims needing attention
├── admin-reports.html       All reports, with edit and archive
├── admin-claims.html        All claims, with approve / reject / request-info
├── admin-users.html         All user accounts, with activate / deactivate
├── admin-analytics.html     Trends, categories, hotspots, recovery rate
├── admin-audit.html         Immutable trail of privileged actions
│
├── logo.png                 Official Galgotias University logo (C2PA-signed)
├── assets/
│   ├── items/              20 branded category illustrations (2 per category)
│   ├── favicon.png         Official GU crest (browser tab icon)
│   └── apple-touch-icon.png 180x180 opaque variant for iOS home screens
├── robots.txt               Allows public pages, blocks signed-in areas
├── sitemap.xml              Public pages only
├── README.md                Quick reference card
├── process.md               This document
├── .env.example             Template for Supabase environment values
│
├── css/
│   ├── style.css            Design tokens, dark mode, landing page, footer, error pages
│   ├── components.css       App shell, cards, forms, tables, badges, modals, wizard…
│   ├── dashboard.css        Dashboard, profile, charts, match cards, recovery ring
│   ├── auth.css             Login / register / reset page layout
│   └── responsive.css       Tablet (<1024px) and mobile (<640px) breakpoints
│
├── js/
│   ├── config.js            Environment configuration contract (Supabase URL/key/mode)
│   ├── utils.js             DOM helpers, escaping, formatting, icons, theme, debounce
│   ├── storage.js           Data layer over localStorage + all repositories
│   ├── seed.js              The shipped sample dataset (users, reports, claims, audit)
│   ├── validation.js        Every input validator — one function per field/rule
│   ├── auth.js              Sign-in, sign-out, sessions, roles, password change
│   ├── matching.js          The Smart Match Score algorithm
│   ├── claims.js            Claim lifecycle, status transitions, timeline rendering
│   ├── qr.js                QR code generation with a text fallback
│   ├── notifications.js     Notification list, unread badge, tabs
│   ├── reports.js           Lost/found wizards, image handling, review step
│   ├── items.js             Listing and detail page rendering for items
│   ├── dashboard.js         Dashboard + profile page rendering
│   ├── admin.js             All admin pages
│   ├── analytics.js         Chart.js wrapper (with a no-chart fallback)
│   ├── api.js               Supabase data-access layer (the swap target)
│   └── app.js               Page shell, navigation, footer, guards, toasts, modals
│
└── supabase/
    └── schema.sql           Tables, indexes, Row Level Security policies, storage bucket
```

### Why each page is a separate HTML file
There is no router and no bundler. Each page has a `<body data-page="...">` attribute;
`js/app.js` reads it, checks `PAGE_GUARDS`, renders the shared navigation and footer,
then calls the matching `pageInits[...]` function. This means every page is a valid,
independently cacheable document — which is exactly what you want when serving ~1000
concurrent users from a CDN.

---

## 4. How the code works (the moving parts)

### 4.1 Everything hangs off one global
Each JavaScript file is an IIFE that registers itself on `window.CF`:

```js
window.CF.storage     // data access
window.CF.auth        // sign-in and roles
window.CF.matching    // match algorithm
window.CF.claims      // claim lifecycle
window.CF.ui          // toasts, modals, navigation (from app.js)
window.CF.pageInits   // one function per page, registered by its module
```

No imports, no exports, no build. The browser loads the files in the order listed at
the bottom of each HTML page.

### 4.2 The boot sequence
When any page loads, `js/app.js` runs `init()`:

```
1. storage.ensureSeeded()      → is there data? if not, load js/seed.js
2. utils.initTheme()           → apply light or dark from localStorage
3. Read <body data-page>       → which page is this?
4. Look up PAGE_GUARDS[page]   → does it need a session? which roles?
5. No session + protected?     → redirect to login.html
6. Wrong role?                 → redirect to 403.html
7. renderAppShell()            → sidebar + topbar (or public nav on landing pages)
8. renderFooter()              → only on public pages
9. pageInits[page](root)       → hand control to the module for this page
```

### 4.3 The data layer
`js/storage.js` is the single place data is read and written. Every other module asks
it for data and never touches `localStorage` itself.

```
users[]  reports[]  claims[]  notifications[]  audit[]
```

This matters for two reasons: swapping the backend later only touches this one file,
and no module can accidentally corrupt another's data.

If the browser storage quota is exceeded on a write, `stripImages()` retries the write
with embedded photos removed, so the record survives even if the picture is dropped.

### 4.4 Security in the current build

| Control | Where | Note |
|---|---|---|
| Output escaping | `utils.escapeHtml()` | Every user string is escaped before it enters HTML |
| Input sanitising | `utils.sanitizeInput()` | Strips control characters, trims |
| Password hashing | `seed.digestPassword()` | One-way; **plaintext is never stored** — verified by test |
| Login rate limiting | `auth.js` | 5 failed attempts → 5 minute lock |
| Role checks | `auth.canUserAccess()` | Own-property check, so `constructor` cannot be used as a role |
| Route guards | `app.js PAGE_GUARDS` | Runs on every page load, not just hidden nav |
| Audit trail | `storage.pushAudit()` | Every privileged action is recorded |

### 4.5 Accessibility
- Semantic landmarks (`header`, `nav`, `main`, `footer`) and a skip link
- `aria-current` on the active nav item, `aria-invalid` on failing fields
- Visible focus rings on every interactive element (red 3px outline)
- Status is never conveyed by colour alone — every badge has text
- All icons are decorative (`aria-hidden`) with text labels
- Exactly one `<h1>` per rendered page, and heading levels never skip a step
- Every `<img>` carries an `alt`; every form control has a label, `aria-label` or
  `aria-labelledby`
- The hidden file inputs in both report wizards are `tabindex="-1"` with their own
  `aria-label`, so the visually-hidden upload input is never announced as an
  unlabelled control

> **Why this is checked against the rendered DOM.** Almost every page builds its markup
> in JavaScript (`window.CF.pageInits[...]`), so auditing the `.html` files finds no
> `<h1>`, no navigation links and no images. The verification pass therefore boots each
> page and audits the DOM that `pageInit` produced.
>
> That distinction caught two real defects. `item-details.html` and
> `claim-details.html` rendered their "not found" state as a bare `<h3>` inside an
> empty-state card, with no page heading at all — so following a stale or mistyped
> `?id=` link left the page with **zero** `<h1>` elements and a heading that jumped
> from nothing straight to `<h3>`. Both now render a proper `page-head` with an `<h1>`
> and demote the empty-state heading to `<h2>`.

### 4.6 Graceful degradation
Three CDN libraries are used. Each has a fallback so a network failure never breaks a page:

| Library | Used for | If it fails to load |
|---|---|---|
| lucide | icons | Bullet characters instead of icons |
| Chart.js | charts | A readable "chart unavailable" notice with the numbers |
| qrcodejs | QR codes | The case ID shown as a large readable card |

### 4.7 Mobile

Layout is verified from **320px** up. `css/responsive.css` carries every breakpoint.

| Width | What changes |
|---|---|
| ≤1024px | Grids drop to two columns; detail/profile/admin layouts go single-column |
| ≤980px | Public navbar collapses into the drawer (below) |
| ≤820px portrait | Hero, dashboard and listing grids go single-column |
| ≤640px | App sidebar becomes a drawer; **data tables become cards**; forms go one-up |
| ≤560 / ≤900px | Component-level tightening already present in `style.css` |
| ≤400px | Small phones: one-up grids, 44px touch targets, full-width buttons |

#### Three mobile bugs that were hiding in plain sight

The responsive stylesheet was 231 lines and the markup was JS-rendered, so none of
these were visible from reading the HTML.

**Every data table was invisible on a phone.** The mobile block contained

```css
.data-table { display: none; }
.data-table.mobile { display: table; ... }
```

but **no table ever had the `mobile` class** — not one, in the whole app. So below
640px all five tables (Admin reports, claims, users, audit, and My Claims) simply
disappeared. The card treatment was already fully prepared: all 35 `<td>` elements
across those tables carry a `data-label` attribute, which is exactly what the card
layout needs to label each row. Only the class was missing.

The fix makes the card treatment apply to `.data-table` directly, so a future table
cannot silently break the same way, and adds `.keep-table` as an explicit opt-out:

```css
.data-table { display: block; }        /* was: display:none */
.data-table thead { display: none; }
.data-table tbody tr { display: block; border: 1px solid var(--border); ... }
.data-table td { display: flex; justify-content: space-between; }
.data-table td::before { content: attr(data-label); ... }
```

**The public navbar had no working hamburger.** `app.js` had always rendered a
`[data-nav-toggle]` button and correctly toggled `.mobile-menu.is-open` on click —
but `.nav-toggle { display: none; }` in `style.css` was never overridden by any
media query. The button existed, was wired, and could never be seen. On a phone the
header tried to lay out a logo, five links and three buttons in a single flex row.
The `.btn-desktop` class (applied to the Login and Dashboard links) likewise had no
CSS rule at all. Both now switch on below 980px.

**Signed-in users could not reach the navigation at all.** The same pattern, worse.
`.topbar-menu-btn { display: none; }` with no media query, while the sidebar itself
becomes `position: fixed; transform: translateX(-100%)` below 640px — an off-screen
drawer with no button to open it. It is now shown at exactly the width where the
drawer applies, so the button and the drawer can never disagree again.

Dead rules for a retired header design (`.main-nav`, `.header-top`) were removed.

#### Touch targets

`.btn-icon` inherited only padding from `.btn`, leaving every icon button roughly
57×41px with a size that varied by icon. It now has a fixed 44×44 box. `.input-action`
(the show/hide and clear buttons inside fields) went from 34px to 40px, and 44px below
400px. Form controls use `font-size: 16px` on small screens, because anything smaller
makes iOS Safari zoom the page on focus.

#### What could not be verified

jsdom has no layout engine, so nothing here measures real pixel widths or detects
actual overflow. These fixes are verified at the level of **stylesheet logic and DOM
behaviour** — the drawer opens and closes, every table is labelled for the card
layout, no fixed width over 320px survives in the base CSS, and all braces balance.
Whether a given element visually overflows still needs a real browser at 320, 375 and
414px.

---

## 5. Design system — the Galgotias University branding

The colours and fonts were taken **from the live university website**, not guessed.
The source stylesheets are:

```
www.galgotiasuniversity.edu.in
  /public/frontend/assets/css/style.css
  /public/frontend/assets/css/mystyle.css
  /public/frontend/assets/css/site-inline-common.css
  /public/frontend/assets/fonts/gotham-narrow.css
```

### Core palette

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--ul-primary` | `#BC1820` | `#E23A40` | Brand red — buttons, links, active nav |
| `--ul-primary-dark` | `#BE2727` | `#C01C24` | Hover and pressed states |
| `--ul-primary-deep` | `#8E1218` | — | Text on soft red surfaces |
| `--ul-charcoal` | `#202020` | `#161616` | Header and dark surfaces |
| `--ul-ink` | `#202020` | `#F3F3F3` | Headings and body text |
| `--ul-cream` | `#F3F3F3` | `#121212` | Page background |
| `--surface` | `#FFFFFF` | `#161616` | Cards |

`#BC1820` is the single most-used colour on the university site (40 occurrences in
`style.css` alone, 67 across three files). `#202020` is the site's header background.
The yellow `#F7D209` appears only three times — for the active nav item — so it is not
used as a surface or accent colour here.

### Typography

Lifted from the same site:

| Role | Font | Where the university uses it |
|---|---|---|
| Body | **Poppins** 400/500/600/700 | `font-family:Poppins,sans-serif` (11 uses) |
| Headings | **Gotham Narrow** | `gothammedium`, `gothambold`, `gothamnarrow` (25 uses) |
| Fallback display | **Montserrat** | Used alongside Poppins on the university site |

Gotham Narrow is a licensed font served by the university from cdnfonts.com. We
reference the same family with a Montserrat fallback and `font-display: swap`, so a
blocked font server can never change the layout or delay first paint.

### The compatibility trick

The original prototype used a blue/green/indigo palette with variable names like
`--ul-blue` and `--ul-emerald`. **Those names were kept but re-pointed to the brand
colours.**

```css
--ul-blue:    #BC1820;   /* name kept, value is brand red   */
--ul-emerald: #1F7A4D;   /* kept because "approved" reads as green */
--ul-amber:   #B8860B;   /* warning — muted gold, not gold   */
```

Why? Because 20+ CSS rules and every component class referenced those names. Renaming
them would have meant touching hundreds of lines and risking silent breakage. Keeping
the names means the re-theme was a change of **values**, not structure.

### Logo
`logo.png` is the official Galgotias University crest (1276×1233 RGBA, content-signed,
so it is referenced as a file and never re-encoded). Its dominant red is `#A00820`,
close to the site red `#BC1820`.

Because the crest has large white areas, it is rendered on a **white** container with a
neutral border. An earlier tinted container made the white parts of the crest look
wrong, so `.logo-mark` and `.brand-mark` now use `background: #FFFFFF`.

### Favicon and app icon

The browser tab icon is the **real university crest**, downloaded from the live site
rather than drawn:

```
https://www.galgotiasuniversity.edu.in/public/uploads/media/
  PSf8vV9pdHjUb5MhnGpG1hiiJ9Y0c8YYgSAk54Q3.png
```

It is stored locally as `assets/favicon.png` (201×200, 6.5 KB, red `#A12826` on
transparency) so the site never hotlinks the university's server. **Both assets are
placeholders — replace them with the university's official supplied files before
launch.** That is a two-file swap: drop in the new images with the same filenames and
no HTML needs to change.

```
assets/
├── favicon.png           201x200 transparent crest
└── apple-touch-icon.png  180x180 opaque white-backed crest
```

Two files rather than one, because the source crest has an alpha channel and iOS
composites transparent PNGs onto **black**, which would have rendered the white parts
of the crest as dark smudges on an iOS home screen. The apple-touch-icon is therefore
regenerated at 180×180 with the transparency flattened onto white and re-encoded as
opaque RGB. Its crest bounding box is centred at 89,90 against a canvas centre of 90,90.

Every one of the 24 pages declares both:

```html
<link rel="icon" type="image/png" sizes="201x201" href="assets/favicon.png">
<link rel="apple-touch-icon" sizes="180x180" href="assets/apple-touch-icon.png">
```

These replaced an earlier generic red map-pin SVG that was inlined as a `data:` URI on
all 24 pages. Removing the data URIs cut roughly 1.5 KB per page of HTML and stopped
each page carrying its own copy of the same icon.

### Dark mode
Switch with the toggle on the profile page or in admin settings. The choice is saved in
`localStorage` and applied before first paint so there is no white flash.

### University identifiers

Users are identified by the university's own roll-number scheme, not by an invented
numeric id. `js/seed.js` builds all 20 sample users through a `roll()` helper and
`js/validation.js` enforces the format on the register form.

| Role | Pattern | Regex | Example |
|---|---|---|---|
| Student | `YY` + 4-letter school + 3-digit programme + 4-digit serial | `/^\d{2}[A-Z]{4}\d{3}\d{4}$/` | `24SCSE1010457` |
| Faculty / Staff / Admin | 4–5 letter prefix + 7 digits | `/^[A-Z]{4,5}\d{7}$/` | `FASC2018088` |

`SCSE` is the School of Computing Science & Engineering. The `SCHOOLS` map in
`js/seed.js` holds the five codes the seed uses: `SCSE`, `SBOM` (Business &
Organisation Management), `SBAS` (Basic & Applied Sciences), `SEA` (Engineering &
Architecture) and `SLAS` (Liberal Arts & Sciences). `validateCollegeId` upper-cases the
input and strips spaces before testing, so `24 scse 1010457` is accepted. The register
form formats the roll number visually — `24 | SCSE | 101 | 0457` — so a student can see
the four parts before submitting.

### Item photography

A lost-and-found listing without a photo is hard to match against. All 30 seeded
reports therefore carry **two** branded illustrations each, from `assets/items/`.

`assets/items/` holds 20 SVGs — two variants for each of the 10 categories in
`js/validation.js`. They are flat vector shapes in the brand red and neutral greys,
about 1.4 KB each, so the gallery costs nothing to load. `js/seed.js` attaches them via
`photoFor()` and `photoPair()`, which derive the filename from the report's category
and id rather than hard-coding paths.

Regenerating them after a palette change means editing `photoFor()`; no manifest to
maintain.

### The landing page

`index.html` opens with a university lockup — the crest linking to
`www.galgotiasuniversity.edu.in` — rather than a generic hero. Below it, the headline
scales with `clamp(38px, 5.6vw, 62px)` so it stays dominant from 320px to a desktop
monitor without a media query.

The hero carries two live elements rather than decoration:

- **A working search box** (`#hero-search`) that submits to `found-items.html?q=…`.
  `js/items.js` `initListing` reads that parameter and pre-fills the listing's search
  box, so the query carries across the navigation.
- **A "Recently handed in" panel** (`[data-hero-items]`) filled by `js/app.js`
  `pageInits.index` with three real found reports from storage, photos included.

Both are populated from the data layer, so the landing page reflects the dataset
instead of showing placeholder copy.

---

## 6. How this scales to about 1000 concurrent users

This is an important distinction:

> The **current build** is a static site that runs entirely in the browser.
> It can serve 1000 concurrent visitors with zero backend cost — but their data
> lives in their own browsers and is not shared.

The moment you wire up Supabase (section 7), that changes. Here is the reasoning for both cases.

### 6.1 The static tier (already scales)

| Concern | How it is handled |
|---|---|
| Server load | Zero. HTML/CSS/JS are static files served by a CDN. No Node process, no database connection per visitor. |
| Assets | `logo.png` is served from a CDN edge; the CDN caches it once and serves thousands of copies. |
| Caching | `<base href="/">` and versioned asset paths mean every page is independently cacheable. |
| Front-end cost | Each browser does its own matching. A 1000-user spike costs the server nothing. |

Host it on **Netlify, Vercel, GitHub Pages, or Cloudflare Pages**. All four are free,
all four serve from a global CDN, all four handle far more than 1000 concurrent
connections on the free tier.

### 6.2 The database tier (what Supabase adds)

The naive version of this app sends one query per page load and collapses at a few
hundred concurrent users. The schema in `supabase/schema.sql` is designed so it does not:

1. **Indexes on every filter column.** `reports (type, created_at desc)`,
   `reports (status)`, `claims (status)`, `notifications (user_id, created_at desc)`.
   Without these, a claims list becomes a sequential scan.

2. **Row Level Security, not application-level filtering.** The RLS policies in
   `schema.sql` push the "you may only see your own claims" rule into Postgres.
   That means a policy is enforced no matter which client asks, and one indexed query
   returns *only* the rows the caller is allowed to see.

3. **One query per page, not per row.** The repository functions in `js/api.js` return
   whole filtered sets. Never build a dashboard that fetches 30 reports and then loops
   to fetch each one's claims — that is 31 queries per dashboard load.

4. **Supabase connection pooling.** Every browser tab holds one connection. With 1000
   concurrent users that is 1000 connections, which is why you must:
   - set the project's **pooler** (Transaction mode) as the connection URL, and
   - enable **Realtime** quotas and raise **Max client connections** in project settings.

5. **Images never go into the database.** Photos are downscaled in the browser
   (`reports.js` — max 900px, quality 0.82) and uploaded to Supabase **Storage**.
   A row containing five base64 images would be megabytes and would destroy your
   query performance and your browser quota. `api.uploadPhoto()` handles this.

6. **Free-tier headroom.** Supabase's free plan gives 500MB of database and 1GB of
   storage, which comfortably serves a full academic year for a campus-sized project.
   With indexes and RLS in place, 1000 concurrent *readers* is well within budget —
   what you must avoid is unindexed queries and unbounded result sets.

### 6.3 Practical checklist for deployment

- [ ] Serve over **HTTPS only** — required for Supabase Auth cookies
- [ ] Add `Cache-Control: no-cache` to `.html`, and long `max-age` to `.css`/`.js`
- [ ] Enable the Supabase **connection pooler** (Transaction mode)
- [ ] Keep `CAMPUSFIND_MODE=auto` so the site still works if Supabase is unreachable
- [ ] Add error monitoring (Sentry) before you get real traffic

---

## 7. Going live with Supabase (step by step)

Everything needed is already in the folder. This section is the actual migration plan.

### Why it is not wired yet

`js/storage.js` returns **synchronous** arrays, and about twenty call sites depend on
that. A network backend returns **promises**. Changing that touches every module, so it
must land as one reviewed change alongside a real database — not as a half-wired stub.

What *is* done: the configuration contract (`js/config.js`), the complete data-access
layer (`js/api.js`), the schema (`supabase/schema.sql`), and a fallback mode so the
site never breaks if Supabase is down.

### Step 1 — Create the project (15 minutes)

1. Go to <https://supabase.com> → **Start your project**
2. Save the database password somewhere safe — you will need it for the CLI
3. Wait for provisioning (~2 minutes)
4. Note the **Project URL** and **anon public key** from **Project Settings → API**

### Step 2 — Create the schema (5 minutes)

1. In the Supabase dashboard open **SQL Editor → New query**
2. Open `supabase/schema.sql`, copy the whole file, paste it
3. Press **Run**

This creates six tables, all indexes, every Row Level Security policy, the storage
bucket, and the trigger that auto-creates a profile when someone signs up.

> **Read the RLS section before you go further.** The anon key is public — it ships in
> the JavaScript bundle. The policies are the *only* thing protecting student data.

### Step 3 — Point the app at it (2 minutes)

1. Copy `.env.example` to `.env`
2. Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY`
3. Set `CAMPUSFIND_MODE=auto`

That is it. `js/config.js` reads those values and `js/api.js` switches itself to
Postgres automatically.

### Step 4 — Swap the storage layer (half a day)

This is the actual code change. In each module:

```js
// BEFORE — synchronous, local
const reports = CF.storage.reports();

// AFTER — asynchronous, Supabase
const reports = await CF.api.listReports();
```

Work through it in this order, testing after each step:

| Step | File | Change |
|---|---|---|
| 1 | `js/app.js` | `init()` becomes async; call `api.refreshSession()` before the guard check |
| 2 | `js/auth.js` | `signIn`/`signUp`/`signOut` delegate to `CF.api.*`; keep the role matrix unchanged |
| 3 | `js/reports.js` | Wizard submit awaits `api.saveReport()`; images go to `api.uploadPhoto()` |
| 4 | `js/claims.js` | `submitClaim` / `transitionClaim` await `api.saveClaim()` |
| 5 | `js/items.js` | `initListing` / `initDetail` await the list functions |
| 6 | `js/dashboard.js` | `render()` awaits before drawing |
| 7 | `js/admin.js` | All five admin pages await; move the role check into a Postgres policy |
| 8 | `js/analytics.js` | Query aggregate counts instead of downloading rows to count them |

**Keep `js/storage.js`.** It becomes the offline cache: if Supabase is unreachable,
the app reads from localStorage and shows a "you're offline" banner rather than an
error page.

### Step 5 — Turn off the sample data

Once real users exist, remove the auto-seed so nobody sees fictional people:

```js
// js/app.js — delete this line from init()
storage.ensureSeeded();
```

Keep `js/seed.js` in the folder for local development.

### Step 6 — Promote your first admin

New sign-ups are always `role = 'student'` (see the trigger in `schema.sql`). Run this
once in the SQL Editor:

```sql
update public.profiles set role = 'admin' where email = 'you@university.edu.in';
```

### Step 7 — Verify before launch

- [ ] Sign up a student → profile row appears in `public.profiles`
- [ ] Report a lost item → row in `public.reports`
- [ ] Sign in as a second student → they **cannot** see student one's claim
      *(run the check in the SQL editor: `select * from claims;` as anon should return nothing)*
- [ ] Deactivate a user → they can no longer sign in
- [ ] Upload a photo → it lands in the `campusfind-photos` bucket
- [ ] Audit log records every admin action
- [ ] Turn off wifi → the app still loads from cache and shows an offline banner

---

## 8. Security notes and honest limitations

### Already handled

- No plaintext passwords are ever stored (verified by automated test)
- All user-supplied text is escaped before entering HTML — no XSS
- Rate limiting on sign-in (5 attempts, then a 5-minute lock)
- Role checks on every protected route, not just hidden menu items
- Object-prototype-safe role lookup (`constructor` cannot be used as a role)
- Append-only audit trail for privileged actions
- Registration requires explicit Terms and Privacy consent (`agreeTerms`)
- Registration is restricted to the campus domain

#### The college-domain check

`validateEmail(value, { collegeOnly: true })` anchors on the university domain:

```js
const COLLEGE_DOMAIN = 'galgotiasuniversity.edu.in';
const COLLEGE_EMAIL_RE = new RegExp(
  '^[A-Za-z0-9._%+-]+@' + COLLEGE_DOMAIN.replace(/\./g, '\\.') + '$', 'i');
```

This started life broken. The original was

```js
const COLLEGE_EMAIL_RE = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;
```

which is a copy of the generic email pattern — it matches **any** domain, so
`someone@gmail.com` passed and the "Please use your college email address" branch
could never fire. The campus restriction was advertised in the UI and enforced
nowhere. It is covered by 16 cases in the verification pass, including the
lookalike domains `notgalgotiasuniversity.edu.in` and
`galgotiasuniversity.edu.in.evil.com`.

### Must be fixed before real student data goes in

| Issue | Fix |
|---|---|
| Passwords are hashed with a fast browser digest, not bcrypt/argon2 | Supabase Auth (`supabase/auth`) uses bcrypt internally |
| Sessions live in `localStorage` | Supabase Auth issues httpOnly, SameSite cookies |
| No password reset email | Supabase Auth `resetPasswordForEmail` + `updateUser` |
| Rate limiting is per-browser, so it can be bypassed | Move to a Postgres function or an edge-function check |
| Images stored as base64 inside records | `api.uploadPhoto()` → Supabase Storage |
| No email notifications | Supabase Edge Function on report/claim insert |

### Also worth doing

- Serve the campus domain with an SSL certificate
- Add a privacy policy page before launch (the app stores student emails)
- Back up the Supabase project weekly (Settings → Database → Backups)
- Review the RLS policies quarterly — they are the security boundary

---

## 9. Glossary

| Term | Meaning |
|---|---|
| **Smart Match Score** | The 0–100% confidence that a lost item and a found item are the same object |
| **Claim** | A student's request to have a found item returned to them |
| **Chain of custody** | The recorded trail of who held an item and when |
| **CDN** | Content Delivery Network — copies of your files served from servers near the user |
| **IIFE** | Immediately Invoked Function Expression — the `(function(){...})()` wrapper that gives each file its own scope |
| **RLS** | Row Level Security — Postgres rules that decide which rows a user may see |
| **anon key** | Supabase's public API key. Safe to ship; RLS is what protects the data |
| **Quorum / pooler** | Supabase's connection pooler, needed so 1000 browser tabs do not exhaust the connection limit |
| **localStorage** | Browser storage that survives refresh. Per-device — not shared between users |