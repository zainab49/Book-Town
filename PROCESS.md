# PROCESS.md — Book-Town

---

## The Stack and Why

**Frontend:** Next.js 14 (React, TypeScript) with Tailwind CSS for styling and Three.js for the 3D town canvas.
**Backend:** Go with the Fiber framework, SQLite as the database, and JWT for authentication.
**Infrastructure:** Docker Compose to run both services together.

I chose Next.js because it handles both server-side rendering and client-side interactivity without extra setup, which meant the reading dashboard and the 3D town could live in the same project. Go was the right choice for the backend because it is fast, lightweight, and produces a single binary — perfect for a small, focused API. SQLite kept things simple: no separate database server to manage, and with WAL mode enabled it handles concurrent reads well enough for this scale.

---

## The Design Problem

Most reading apps feel like a task manager. You add a book, you track pages, and you feel guilty every time you open the app and see how far behind you are. The problem is not that people forget to read — it is that nothing in those apps makes them *want* to read.

I wanted to flip that. Instead of showing you what you have not done, Book-Town shows you what you *have* done. Every book you finish unlocks a building in your personal 3D town. The more you read, the more your town grows. The reading list is still there, but it exists to feed something that feels alive and rewarding, not to remind you of your failures.

---

## One Design Decision I Debated

**Whether to include background music.**

Some people find ambient music helpful and immersive; others find it intrusive and annoying, especially if they are already listening to something. I went back and forth on this. In the end I added it, with a smooth fade-in and easy controls to toggle it off. My reasoning: this is my app, and I wanted to build something I would actually enjoy using. The option to turn it off respects users who disagree. If this were a product for a wide audience, I would default it to off and let users opt in.

---

## AI Tools Used

I used two AI tools throughout this project:

- **OpenAI Codex** — for generating the base project structure and boilerplate (folder layout, initial API routes, database schema scaffolding).
- **Claude Code** — for design, styling, and UI refinement. I used it to iterate on the visual language of the app: the town canvas, component layouts, and Tailwind styling decisions.

Where they helped most: getting past blank-page paralysis on the structure, and speeding up repetitive styling work.

Where I overrode them: both tools occasionally suggested patterns that were more complex than the problem needed. I simplified several component architectures they proposed and removed abstractions that added indirection without benefit.

Where I did not use them: nowhere. AI was involved in every part of this project, from initial scaffolding to final polish.

---

## One AI Suggestion I Rejected

The AI suggested upgrading to the latest version of Three.js mid-project to take advantage of newer rendering features. I rejected this. The app was already working correctly with the version in use, and a major library upgrade in the middle of feature development carries real risk — API changes, broken types, unexpected rendering differences. Upgrading Three.js completely was not the goal; finishing the app with the features I wanted was. I will revisit it when there is time to test the migration properly.

---

## Auth: Choice and Tradeoffs

**What I used:** Custom JWT authentication with bcrypt password hashing, implemented in Go.

Tokens are signed with HS256 and expire after 24 hours. On the frontend, the token is stored in two places: `localStorage` for client-side access, and an `httpOnly` cookie for the Next.js edge middleware to verify server-side before rendering protected pages.

**What it protects against:**
- Passwords are never stored in plain text (bcrypt, cost 12).
- Tokens expire, so a leaked token has a limited window of use.
- The `httpOnly` cookie prevents JavaScript from accessing the auth cookie directly, reducing XSS exposure for the SSR layer.

**What it does not protect against:**
- The `JWT_SECRET` is currently hardcoded in the `.env` file as `dev-secret-change-me`. If that file is exposed, all tokens can be forged. This is a serious gap.
- The Google Books API key is also committed to the repository.
- There is no token refresh or revocation mechanism. A stolen token is valid until it expires.
- No rate limiting on login attempts, which leaves the endpoint open to brute-force attacks.

**What I would change for production:**
- Move all secrets to a proper secrets manager (e.g., environment injection at deploy time, never committed to git).
- Add a token refresh flow and a server-side revocation list for logout.
- Implement rate limiting on `/api/auth/login` and `/api/auth/register`.
- Consider switching to an established auth provider (e.g., Clerk, Auth.js) to offload session management and security maintenance.

---

## What I Would Cut and What I Would Add


**If I had another week, I would add:**
- **Book clubs and a community layer** — readers could join groups, share progress, and encourage each other to finish books together. Reading is often more enjoyable with accountability partners, and this fits the "make reading social" direction the app is already pointing toward.
- **Book reviews and ratings** — once you finish a book and it becomes a building in your town, you could leave a short review and a star rating. Your town becomes not just a visual achievement board but a personal library of opinions.
- **Better onboarding** — the first experience with the 3D town is not obvious. A short guided walkthrough would help new users understand the core loop immediately.
