import { Button } from '../../../shared/ui';

interface JournalHeaderProps {
  title: string;
  wordCount: number;
}

export const JournalHeader = ({ title, wordCount }: JournalHeaderProps) => {
  return (
    <header className="border-stoic-black/10 bg-stoic-background/80 flex h-16 shrink-0 items-center justify-between gap-4 border-b px-6 backdrop-blur-sm lg:px-12">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="text-secondary shrink-0 text-[11px] font-semibold tracking-[0.1em] uppercase">
          October 25, 2026
        </span>
        <span className="bg-stoic-black/20 h-1 w-1 shrink-0 rounded-full" />
        <span className="truncate text-sm font-medium">
          {title || 'Untitled Reflection'}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-6">
        <span className="text-secondary hidden text-[10px] font-semibold tracking-[0.1em] uppercase sm:inline">
          Word Count: {wordCount}
        </span>
        <Button
          type="button"
          size="sm"
          className="hidden h-8 rounded-lg px-5 text-[10px] font-semibold tracking-[0.1em] uppercase sm:inline-flex"
        >
          Save Entry
        </Button>
      </div>
    </header>
  );
}
