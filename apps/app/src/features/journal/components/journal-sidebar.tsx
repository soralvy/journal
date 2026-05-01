import { BarChart3, BookOpen } from 'lucide-react';

import { recentReflections } from '../journal-mock-data';

export function JournalSidebar() {
  return (
    <aside className="border-stoic-black/10 hidden w-72 shrink-0 flex-col border-r bg-[#f2f2f2] px-6 py-6 lg:flex">
      <div className="pb-10">
        <h1 className="font-heading text-2xl font-semibold">Aura</h1>
        <p className="text-secondary mt-1 text-[10px] tracking-[0.1em] uppercase">
          Stoic Companion
        </p>
      </div>

      <nav className="flex flex-1 flex-col gap-8">
        <section className="flex flex-col gap-4">
          <h2 className="text-secondary text-[10px] font-semibold tracking-[0.1em] uppercase">
            Menu
          </h2>
          <div className="flex flex-col gap-3">
            <a
              className="flex items-center gap-3 text-sm font-medium"
              href="/journal"
            >
              <BookOpen className="size-4" aria-hidden="true" />
              Daily Journal
            </a>
            <button
              type="button"
              className="text-secondary flex cursor-pointer items-center gap-3 text-left text-sm font-medium"
            >
              <BarChart3 className="size-4" aria-hidden="true" />
              Progress
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-secondary text-[10px] font-semibold tracking-[0.1em] uppercase">
            Recent Reflections
          </h2>
          <div className="flex flex-col gap-4">
            {recentReflections.map((reflection) => (
              <button
                type="button"
                className="group flex cursor-pointer flex-col gap-1 text-left"
                key={reflection.title}
              >
                <span className="text-secondary/70 text-[11px]">
                  {reflection.date}
                </span>
                <span className="group-hover:text-primary text-sm leading-5 font-medium text-slate-700">
                  {reflection.title}
                </span>
              </button>
            ))}
          </div>
        </section>
      </nav>

      <section className="border-stoic-black/10 flex items-center gap-3 border-t pt-6">
        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-[10px] font-semibold">
          JD
        </div>
        <div className="min-w-0">
          <p className="text-primary truncate text-sm font-medium">John Doe</p>
          <p className="text-secondary text-[10px]">Stoic Initiate</p>
        </div>
      </section>
    </aside>
  );
}
