"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import dynamic from "next/dynamic";
const BookFinishedCelebration = dynamic(
  () => import("@/components/book-finished-celebration"),
  { ssr: false }
);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

type BookStatus = "to_read" | "reading" | "finished";

type Book = {
  id: number;
  user_id: number;
  title: string;
  author: string;
  cover_url: string;
  rating: number;
  total_pages: number;
  current_page: number;
  status: BookStatus;
  started_at: string | null;
  finished_at: string | null;
  google_books_id: string;
  created_at: string;
  updated_at: string;
};

type SearchResult = {
  id: string;
  title: string;
  authors?: string[];
  cover?: string;
  rating?: number;
  pageCount?: number;
};

type Stats = {
  started: number;
  finished: number;
  ratio: number;
  points: number;
};

type ActionMode = "start" | "finish" | "progress";

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  if (typeof window === "undefined") return headers;
  const token = window.localStorage.getItem("booktown_token") || window.localStorage.getItem("token");
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [addingBookID, setAddingBookID] = useState<string | null>(null);

  const [menuBookID, setMenuBookID] = useState<number | null>(null);
  const [actionBook, setActionBook] = useState<Book | null>(null);
  const [actionMode, setActionMode] = useState<ActionMode | null>(null);
  const [actionDate, setActionDate] = useState(todayISODate());
  const [progressPage, setProgressPage] = useState(0);
  const [actionSaving, setActionSaving] = useState(false);
  const [removingBookID, setRemovingBookID] = useState<number | null>(null);
  const [celebrationBook, setCelebrationBook] = useState<Book | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<BookStatus>>(new Set());
  const [celebrationAudioCtx, setCelebrationAudioCtx] = useState<AudioContext | null>(null);

  useEffect(() => {
    void loadBooks();
    void loadStats();
  }, []);

  // Debounce search by 280ms to avoid a request on every keystroke.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }
    const timeout = setTimeout(() => void runSearch(q), 280);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timeout);
  }, [toast]);

  const sections = useMemo(
    () => ({
      reading: books.filter((book) => book.status === "reading"),
      finished: books.filter((book) => book.status === "finished"),
      toRead: books.filter((book) => book.status === "to_read"),
    }),
    [books],
  );

  async function loadBooks() {
    const response = await fetch(`${API_BASE}/api/books`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { books: Book[] };
    setBooks(payload.books ?? []);
  }

  async function loadStats() {
    const response = await fetch(`${API_BASE}/api/users/me/stats`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    if (!response.ok) return;
    setStats((await response.json()) as Stats);
  }

  async function runSearch(query: string) {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const response = await fetch(`${API_BASE}/api/books/search?q=${encodeURIComponent(query)}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!response.ok) {
        setSearchResults([]);
        setSearchError("Search failed.");
        return;
      }
      const payload = (await response.json()) as { results: SearchResult[] };
      setSearchResults(payload.results ?? []);
    } catch {
      setSearchResults([]);
      setSearchError("Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function addBook(result: SearchResult) {
    setAddingBookID(result.id);
    try {
      const response = await fetch(`${API_BASE}/api/books`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.title,
          author: (result.authors ?? []).join(", "),
          cover_url: result.cover ?? "",
          rating: result.rating,
          total_pages: result.pageCount ?? 0,
          google_books_id: result.id,
        }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { book: Book };
      setBooks((prev) => [payload.book, ...prev]);
      setSearchResults((prev) => prev.filter((item) => item.id !== result.id));
      setToast("Book added");
    } finally {
      setAddingBookID(null);
    }
  }

  function openAction(book: Book, mode: ActionMode) {
    setMenuBookID(null);
    setActionBook(book);
    setActionMode(mode);
    if (mode === "start") {
      setActionDate(toISODate(book.started_at) ?? todayISODate());
    } else if (mode === "finish") {
      setActionDate(toISODate(book.finished_at) ?? todayISODate());
    } else {
      setProgressPage(book.current_page);
    }
  }

  async function confirmAction() {
    if (!actionBook || !actionMode) return;
    setActionSaving(true);
    try {
      const body =
        actionMode === "start"
          ? { status: "reading", started_at: actionDate }
          : { status: "finished", finished_at: actionDate };

      const response = await fetch(`${API_BASE}/api/books/${actionBook.id}/status`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { book: Book };
      setBooks((prev) => prev.map((book) => (book.id === payload.book.id ? payload.book : book)));
      setActionBook(null);
      setActionMode(null);
      if (actionMode === "finish") {
        setCelebrationBook(payload.book);
      } else {
        setToast("Marked as reading");
      }
      void loadStats();
    } finally {
      setActionSaving(false);
    }
  }

  async function confirmProgress() {
    if (!actionBook) return;
    setActionSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/books/${actionBook.id}/progress`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ current_page: progressPage }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { book: Book };
      setBooks((prev) => prev.map((b) => (b.id === payload.book.id ? payload.book : b)));
      setActionBook(null);
      setActionMode(null);
      if (payload.book.status === "finished") {
        setCelebrationBook(payload.book);
      } else {
        setToast("Progress updated");
      }
    } finally {
      setActionSaving(false);
    }
  }

  async function removeBook(bookID: number) {
    setRemovingBookID(bookID);
    setMenuBookID(null);
    try {
      const response = await fetch(`${API_BASE}/api/books/${bookID}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!response.ok) return;
      setBooks((prev) => prev.filter((book) => book.id !== bookID));
      setToast("Book removed");
      void loadStats();
    } finally {
      setRemovingBookID(null);
    }
  }

  return (
    <>
    {celebrationBook && (
      <BookFinishedCelebration
        title={celebrationBook.title}
        coverUrl={celebrationBook.cover_url}
        finishedAt={celebrationBook.finished_at}
        audioCtx={celebrationAudioCtx}
        onDismiss={() => {
          celebrationAudioCtx?.close().catch(() => {});
          setCelebrationAudioCtx(null);
          setCelebrationBook(null);
        }}
      />
    )}
    <div className="flex min-h-screen flex-col bg-[var(--bg)] lg:pl-60" onClick={() => setMenuBookID(null)}>

      {/* Header */}
      <header className="page-header-bar">
        <p className="page-title">My Books</p>
        <div className="points-pill">{stats?.points ?? 0} pts</div>
      </header>

      {/* Search */}
      <div className="flex gap-2 px-4 pt-3 lg:mx-auto lg:w-full lg:max-w-[1100px] lg:px-6">
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search or add a book..."
          className="field flex-1"
        />
      </div>

      {searchLoading ? <p className="px-4 pt-2 text-[11px] text-[var(--ink-muted)]">Searching...</p> : null}
      {searchError ? <p className="px-4 pt-2 text-[11px] text-[#a3213a]">{searchError}</p> : null}

      {searchResults.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 px-4 pt-2 sm:grid-cols-3 lg:mx-auto lg:w-full lg:max-w-[1100px] lg:grid-cols-4 lg:px-6 xl:grid-cols-6">
          {searchResults.slice(0, 6).map((result) => (
            <article
              key={result.id}
              className="rounded-[10px] border border-[rgba(133,57,83,0.18)] bg-white p-2"
            >
              <div className="mx-auto h-[170px] w-[112px] overflow-hidden rounded-[6px] bg-[var(--surface-alt)] sm:h-[186px] sm:w-[124px]">
                {result.cover ? (
                  <img src={result.cover} alt={result.title} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="mt-2 min-w-0 px-1 pb-1">
                <p className="line-clamp-2 text-[11px] font-semibold leading-[1.25] text-[var(--ink)]">{result.title}</p>
                <p className="truncate text-[11px] text-[var(--ink-muted)]">
                  {(result.authors ?? []).join(", ") || "Unknown author"}
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--primary)]">{renderStars(result.rating)}</p>
                <button
                  className="btn-primary mt-2 w-full px-2.5 py-1.5 text-[11px]"
                  disabled={addingBookID === result.id}
                  onClick={() => void addBook(result)}
                >
                  {addingBookID === result.id ? "..." : "Add"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1 lg:mx-auto lg:w-full lg:max-w-[1100px] lg:px-6">
        {/* All pill — clears selection */}
        <button
          onClick={() => setActiveFilters(new Set())}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${
            activeFilters.size === 0
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[rgba(133,57,83,0.2)] bg-white text-[var(--ink-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
          }`}
        >
          All
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${activeFilters.size === 0 ? "bg-white/25 text-white" : "bg-[var(--surface-alt)] text-[var(--ink-muted)]"}`}>
            {books.length}
          </span>
        </button>

        {(
          [
            { key: "reading" as BookStatus, label: "Reading", count: sections.reading.length },
            { key: "finished" as BookStatus, label: "Finished", count: sections.finished.length },
            { key: "to_read" as BookStatus, label: "Want to Read", count: sections.toRead.length },
          ]
        ).map(({ key, label, count }) => {
          const active = activeFilters.has(key);
          return (
            <button
              key={key}
              onClick={() => {
                setActiveFilters((prev) => {
                  const next = new Set(prev);
                  if (active) next.delete(key); else next.add(key);
                  return next;
                });
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${
                active
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[rgba(133,57,83,0.2)] bg-white text-[var(--ink-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
              }`}
            >
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${active ? "bg-white/25 text-white" : "bg-[var(--surface-alt)] text-[var(--ink-muted)]"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Shelf sections */}
      <main className="mx-auto w-full flex-1 pb-2 lg:max-w-[1100px] lg:px-2">
        <ShelfSection
          title="Currently Reading"
          books={activeFilters.size === 0 || activeFilters.has("reading") ? sections.reading : []}
          menuBookID={menuBookID}
          setMenuBookID={setMenuBookID}
          onStart={(book) => openAction(book, "start")}
          onFinish={(book) => openAction(book, "finish")}
          onProgress={(book) => openAction(book, "progress")}
          onRemove={(bookID) => void removeBook(bookID)}
          removingBookID={removingBookID}
        />
        <ShelfSection
          title="Finished"
          books={activeFilters.size === 0 || activeFilters.has("finished") ? sections.finished : []}
          menuBookID={menuBookID}
          setMenuBookID={setMenuBookID}
          onStart={(book) => openAction(book, "start")}
          onFinish={(book) => openAction(book, "finish")}
          onProgress={(book) => openAction(book, "progress")}
          onRemove={(bookID) => void removeBook(bookID)}
          removingBookID={removingBookID}
        />
        <ShelfSection
          title="Want to Read"
          books={activeFilters.size === 0 || activeFilters.has("to_read") ? sections.toRead : []}
          menuBookID={menuBookID}
          setMenuBookID={setMenuBookID}
          onStart={(book) => openAction(book, "start")}
          onFinish={(book) => openAction(book, "finish")}
          onProgress={(book) => openAction(book, "progress")}
          onRemove={(bookID) => void removeBook(bookID)}
          removingBookID={removingBookID}
        />
      </main>

      {/* Action modal — start / finish */}
      {actionBook && (actionMode === "start" || actionMode === "finish") ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(44,44,44,0.35)] p-4">
          <div className="w-full max-w-sm rounded-[10px] border border-[rgba(133,57,83,0.18)] bg-white p-4">
            <h2 className="text-[14px] font-semibold text-[var(--ink)]">
              {actionMode === "start" ? "Start Reading" : "Finish Book"}
            </h2>
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{actionBook.title}</p>
            <label className="mt-4 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
              {actionMode === "start" ? "Start Date" : "End Date"}
            </label>
            <input
              type="date"
              value={actionDate}
              onChange={(event) => setActionDate(event.target.value)}
              className="mt-1 w-full rounded-[8px] border border-[rgba(133,57,83,0.18)] bg-white px-3 py-2 text-[12px] outline-none"
            />
            <div className="mt-4 flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => { setActionBook(null); setActionMode(null); }}>
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                disabled={actionSaving || !actionDate}
                onClick={() => {
                  if (actionMode === "finish") {
                    try { setCelebrationAudioCtx(new AudioContext()); } catch { /* unsupported */ }
                  }
                  void confirmAction();
                }}
              >
                {actionSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Progress modal */}
      {actionBook && actionMode === "progress" ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(44,44,44,0.35)] p-4">
          <div className="w-full max-w-sm rounded-[var(--r-lg)] border border-[var(--border-brand)] bg-white p-5 shadow-[var(--sh-lg)]">
            <h2 className="text-sm font-bold text-[var(--ink)]">Update Progress</h2>
            <p className="mt-0.5 truncate text-xs text-[var(--ink-muted)]">{actionBook.title}</p>

            {actionBook.total_pages > 0 ? (
              <>
                <div className="progress-track mt-4">
                  <div
                    className="progress-fill"
                    style={{ width: `${Math.min(100, Math.round((progressPage / actionBook.total_pages) * 100))}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-xs font-bold text-[var(--primary)]">
                  {Math.min(100, Math.round((progressPage / actionBook.total_pages) * 100))}%
                </p>
              </>
            ) : null}

            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
              Current Page
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={actionBook.total_pages || undefined}
                value={progressPage}
                onChange={(e) => setProgressPage(Math.max(0, Number(e.target.value) || 0))}
                className="field flex-1"
              />
              {actionBook.total_pages > 0 ? (
                <span className="whitespace-nowrap text-xs text-[var(--ink-muted)]">/ {actionBook.total_pages}</span>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => { setActionBook(null); setActionMode(null); }}>
                Cancel
              </button>
              <button
                className="btn-primary flex-1"
                disabled={actionSaving}
                onClick={() => {
                  try { setCelebrationAudioCtx(new AudioContext()); } catch { /* unsupported */ }
                  void confirmProgress();
                }}
              >
                {actionSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}

      <BottomNav />
    </div>
    </>
  );
}

function ShelfSection({
  title,
  books,
  menuBookID,
  setMenuBookID,
  onStart,
  onFinish,
  onProgress,
  onRemove,
  removingBookID,
}: {
  title: string;
  books: Book[];
  menuBookID: number | null;
  setMenuBookID: (id: number | null) => void;
  onStart: (book: Book) => void;
  onFinish: (book: Book) => void;
  onProgress: (book: Book) => void;
  onRemove: (bookID: number) => void;
  removingBookID: number | null;
}) {
  if (books.length === 0) return null;

  return (
    <section className="px-4 pb-1 pt-4">
      <p className="section-label px-0">{title}</p>

      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {books.map((book) => (
          <article
            key={book.id}
            className="relative rounded-[10px] border border-[rgba(133,57,83,0.18)] bg-white p-2"
          >
            <div className="mx-auto h-[170px] w-[112px] overflow-hidden rounded-[6px] bg-[var(--surface-alt)] sm:h-[186px] sm:w-[124px]">
              {book.cover_url ? (
                <img src={book.cover_url} alt={book.title} className="h-full w-full object-cover" />
              ) : null}
            </div>

            <div className="mt-2 min-w-0 px-1 pb-1 pr-9">
              <p className="line-clamp-2 text-[11px] font-semibold leading-[1.25] text-[var(--ink)]">
                {book.title}
              </p>
              <p className="truncate text-[11px] text-[var(--ink-muted)]">
                {book.author || "Unknown author"}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--primary)]">{renderStars(book.rating)}</p>
              <span className={`badge mt-1 ${statusBadgeClass(book.status)}`}>
                {statusLabel(book.status)}
              </span>
              {book.status === "reading" && book.started_at ? (
                <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                  since {prettyDate(book.started_at)}
                </p>
              ) : null}
              {book.status === "reading" && book.total_pages > 0 ? (
                <>
                  <div className="progress-track mt-1.5">
                    <div className="progress-fill" style={{ width: `${Math.min(100, Math.round((book.current_page / book.total_pages) * 100))}%` }} />
                  </div>
                  <p className="mt-0.5 text-[9px] text-[var(--ink-muted)]">
                    p.{book.current_page}/{book.total_pages} · {Math.min(100, Math.round((book.current_page / book.total_pages) * 100))}%
                  </p>
                </>
              ) : null}
              {book.status === "finished" && book.finished_at ? (
                <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                  finished {prettyDate(book.finished_at)}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setMenuBookID(menuBookID === book.id ? null : book.id);
              }}
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-[6px] border border-[rgba(133,57,83,0.18)] bg-white text-[var(--ink-muted)]"
              aria-label="Book actions"
            >
              <span className="flex flex-col items-center gap-[2px]">
                <span className="block h-[3px] w-[3px] rounded-full bg-current" />
                <span className="block h-[3px] w-[3px] rounded-full bg-current" />
                <span className="block h-[3px] w-[3px] rounded-full bg-current" />
              </span>
            </button>

            {menuBookID === book.id ? (
              <div
                className="absolute right-2 top-10 z-20 w-40 overflow-hidden rounded-[8px] border border-[rgba(133,57,83,0.18)] bg-white shadow-md"
                onClick={(event) => event.stopPropagation()}
              >
                {book.status !== "reading" && book.status !== "finished" ? (
                  <button
                    className="w-full px-3 py-2 text-left text-[11px] hover:bg-[var(--surface-alt)]"
                    onClick={() => onStart(book)}
                  >
                    Start reading
                  </button>
                ) : null}
                {book.status === "reading" ? (
                  <button
                    className="w-full px-3 py-2 text-left text-[11px] font-semibold text-[var(--primary-deep)] hover:bg-[var(--surface-alt)]"
                    onClick={() => onProgress(book)}
                  >
                    Update progress
                  </button>
                ) : null}
                {book.status !== "finished" ? (
                  <button
                    className="w-full px-3 py-2 text-left text-[11px] hover:bg-[var(--surface-alt)]"
                    onClick={() => onFinish(book)}
                  >
                    Finish book
                  </button>
                ) : null}
                <button
                  className="w-full px-3 py-2 text-left text-[11px] text-[#a3213a] hover:bg-[#fcecef]"
                  onClick={() => onRemove(book.id)}
                  disabled={removingBookID === book.id}
                >
                  {removingBookID === book.id ? "Removing..." : "Remove"}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function statusBadgeClass(status: BookStatus): string {
  if (status === "reading") return "badge-reading";
  if (status === "finished") return "badge-finished";
  return "badge-toread";
}

function statusLabel(status: BookStatus): string {
  if (status === "reading") return "reading";
  if (status === "finished") return "finished";
  return "want to read";
}

function renderStars(rating?: number): string {
  const n =
    typeof rating === "number" && Number.isFinite(rating)
      ? Math.max(0, Math.min(5, Math.round(rating)))
      : 0;
  return `${"*".repeat(n)}${"-".repeat(5 - n)}`;
}

function prettyDate(raw: string): string {
  const date = new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// SQLite stores datetimes as "YYYY-MM-DD HH:MM:SS" (space, no Z).
// Normalize to an ISO string before parsing so Date() interprets it as UTC,
// then slice to YYYY-MM-DD for <input type="date">.
function toISODate(raw: string | null): string | null {
  if (!raw) return null;
  const date = new Date(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

