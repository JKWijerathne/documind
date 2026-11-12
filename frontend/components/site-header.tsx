"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/chat", label: "AI chat" },
];

export default function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#080b12]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-5 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="DocuMind home">
          <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-400 text-sm font-black text-slate-950">
            D
          </span>
          <span className="text-base font-semibold tracking-tight text-white">
            DocuMind<span className="text-indigo-300">.</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm transition hover:bg-white/5 hover:text-white sm:px-4 ${
                pathname === link.href
                  ? "bg-white/[0.07] text-white"
                  : "text-slate-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
