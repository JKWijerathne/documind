import Link from "next/link";
import BackendStatus from "@/components/backend-status";

const highlights = [
  {
    number: "01",
    title: "Bring your PDFs",
    description: "Upload documents and let DocuMind prepare them for search.",
  },
  {
    number: "02",
    title: "Find the right detail",
    description: "Search across your files without digging through every page.",
  },
  {
    number: "03",
    title: "Ask in plain language",
    description: "Get grounded answers with page references back to your sources.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#080b12] text-slate-100">
      <main>
        <section className="relative isolate">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -right-32 -top-32 size-[34rem] rounded-full bg-indigo-500/10 blur-[120px]" />
            <div className="absolute -left-44 top-72 size-[28rem] rounded-full bg-cyan-400/[0.07] blur-[120px]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
          </div>

          <div className="mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
            <div className="max-w-2xl">
              <BackendStatus />
              <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-300">
                Your knowledge, within reach
              </p>
              <h1 className="mt-5 text-5xl font-semibold leading-[1.06] tracking-[-0.05em] text-white sm:text-6xl lg:text-7xl">
                Make every
                <br />
                document{" "}
                <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-cyan-200 bg-clip-text text-transparent">
                  answerable.
                </span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-400">
                Turn your PDFs into a knowledge base you can actually talk to.
                Upload your files, ask a question, and get answers grounded in
                your own documents.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/upload"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-indigo-400 px-6 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300"
                >
                  Upload your first PDF
                  <span aria-hidden="true">→</span>
                </Link>
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-13 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-medium text-slate-200 transition hover:bg-white/[0.07]"
                >
                  Explore dashboard
                </Link>
              </div>
              <p className="mt-5 text-xs text-slate-500">
                Your files are processed by your DocuMind backend.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-lg">
              <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-indigo-400/15 via-transparent to-cyan-300/10 blur-2xl" />
              <div className="relative rounded-[1.75rem] border border-white/10 bg-[#111722]/90 p-5 shadow-2xl shadow-black/40 sm:p-7">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-300/10 text-indigo-200">
                      <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
                        <path d="M7 3.75h6.5L19 9.25v11H7a2 2 0 0 1-2-2v-12.5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        <path d="M13 4v5.5h5.5M9 14h6m-6 3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">Research brief.pdf</p>
                      <p className="mt-1 text-xs text-slate-500">Ready to search</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.08] px-2.5 py-1 text-[10px] font-medium text-emerald-200">
                    INDEXED
                  </span>
                </div>

                <div className="mt-6 flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-indigo-400 px-4 py-3 text-sm leading-6 text-slate-950">
                    What were the main findings?
                  </div>
                </div>
                <div className="mt-4 flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-indigo-300/15 bg-indigo-300/[0.08] text-xs font-bold text-indigo-200">
                    D
                  </span>
                  <div className="rounded-2xl rounded-tl-md border border-white/[0.07] bg-white/[0.035] p-4">
                    <p className="text-sm leading-6 text-slate-200">
                      The report highlights three key findings across its
                      analysis. Here&apos;s a concise summary…
                    </p>
                    <div className="mt-4 flex items-center gap-2 border-t border-white/[0.08] pt-3 text-xs text-indigo-200/80">
                      <span className="size-1.5 rounded-full bg-indigo-300" />
                      Research brief.pdf · Page 4
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-[#090d15] px-4 py-3">
                  <span className="flex-1 text-sm text-slate-500">
                    Ask something about your files…
                  </span>
                  <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-400 text-slate-950">
                    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                      <path d="m5 12 14-7-4.5 14-2.7-5.8L5 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
              </div>
              <p className="mt-4 text-center text-xs text-slate-600">
                Ask questions. Get answers with sources.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.07] bg-white/[0.015]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20">
            <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-300">A simpler way to work</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  From document to discovery
                </h2>
              </div>
              <Link href="/chat" className="text-sm text-slate-400 transition hover:text-white">
                Try the assistant <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {highlights.map((highlight) => (
                <article
                  key={highlight.number}
                  className="rounded-2xl border border-white/[0.08] bg-[#0d121b] p-6"
                >
                  <p className="text-xs font-semibold tracking-[0.16em] text-indigo-300">
                    {highlight.number}
                  </p>
                  <h3 className="mt-5 text-lg font-semibold text-white">{highlight.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{highlight.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
