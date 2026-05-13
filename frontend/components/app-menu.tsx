"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type MenuItem = {
  href: string;
  label: string;
};

const MENU_ITEMS: MenuItem[] = [
  { href: "/dashboard", label: "Home" },
  { href: "/profile", label: "Profile" },
  { href: "/library", label: "Book List" },
  { href: "/friends", label: "Find Friends" },
  { href: "/town", label: "Town Editor" },
];

export function AppMenu() {
  const [open, setOpen] = useState(false);

  // Only attach the Escape listener while the menu is open to avoid an always-on
  // global keydown handler for something that's rarely visible.
  useEffect(() => {
    if (!open) return;
    const onEsc = (event: KeyboardEvent) => {""
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="grid h-9 w-9 place-items-center rounded-[8px] border border-[var(--border-brand)] bg-white text-[var(--primary-deep)]"
      >
        <span className="flex flex-col gap-[3px]">
          <span className="block h-[2px] w-4 bg-current" />
          <span className="block h-[2px] w-4 bg-current" />
          <span className="block h-[2px] w-4 bg-current" />
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-[rgba(44,44,44,0.35)]" />
          <aside
            className="absolute right-0 top-0 h-full w-[280px] border-l border-[var(--border-brand)] bg-white p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--ink)]">Menu</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[8px] border border-[var(--border-brand)] px-2 py-1 text-xs text-[var(--primary-deep)]"
              >
                Close
              </button>
            </div>

            <nav className="flex flex-col gap-2">
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-sm font-medium text-[var(--ink)]"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      ) : null}
    </>
  );
}
