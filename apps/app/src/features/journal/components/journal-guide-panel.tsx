import { RotateCw } from 'lucide-react';

import { Button } from '../../../shared/ui';

export function JournalGuidePanel() {
  return (
    <aside className="border-stoic-black/10 bg-stoic-white hidden w-80 shrink-0 flex-col border-l xl:flex">
      <section className="border-stoic-black/10 border-b px-8 py-8">
        <div className="mb-6 flex items-center gap-2">
          <span className="bg-stoic-black/20 size-1.5 rounded-full" />
          <h2 className="text-secondary text-[10px] font-semibold tracking-[0.1em] uppercase">
            AI Guided Prompt
          </h2>
        </div>
        <p className="text-primary text-sm leading-6">
          “Imagine you are starting your day anew. If this were your last day,
          how would you prioritize your tasks differently?”
        </p>
        <button
          type="button"
          className="text-secondary mt-6 inline-flex cursor-pointer items-center gap-2 text-[10px] font-semibold tracking-[0.1em] uppercase"
          aria-label="Refresh prompt"
        >
          Refresh Prompt
          <RotateCw className="size-3" aria-hidden="true" />
        </button>
      </section>

      <section className="flex flex-1 flex-col bg-[#f2f2f2]/30 px-8 py-8">
        <h2 className="text-secondary mb-6 text-[10px] font-semibold tracking-[0.1em] uppercase">
          Daily Wisdom
        </h2>
        <blockquote className="pb-6">
          <p className="text-primary text-base leading-6">
            “The happiness of your life depends upon the quality of your
            thoughts.”
          </p>
          <cite className="text-secondary mt-4 block text-[10px] font-semibold tracking-[0.1em] uppercase not-italic">
            — Marcus Aurelius
          </cite>
        </blockquote>

        <div className="border-stoic-black/10 bg-stoic-white rounded-lg border p-4">
          <h3 className="text-secondary mb-2 text-[9px] font-semibold tracking-[0.1em] uppercase">
            Practice
          </h3>
          <p className="text-secondary text-xs leading-5">
            Take 3 deep breaths before writing. Notice the weight of your body
            in the chair.
          </p>
        </div>
      </section>

      <section className="p-8">
        <Button
          type="button"
          variant="outline"
          className="border-stoic-black/10 text-secondary hover:bg-stoic-black/5 h-8 w-full rounded-lg bg-transparent text-[10px] font-semibold tracking-[0.1em] uppercase"
        >
          Open Toolkit
        </Button>
      </section>
    </aside>
  );
}
