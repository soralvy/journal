import { SendHorizontal, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '../../../shared/ui';
import { assistantMessages } from '../journal-mock-data';
import { AssistantMessage } from './assistant-message';

interface JournalAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
}

export const JournalAssistant = ({
  isOpen,
  onClose,
  onToggle,
}: JournalAssistantProps) => {
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const animationFrame = globalThis.requestAnimationFrame(() => {
      messagesRef.current?.scrollTo({
        top: messagesRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });

    return () => { globalThis.cancelAnimationFrame(animationFrame); };
  }, [isOpen]);

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-4 sm:right-6 sm:bottom-6">
      <section
        aria-hidden={!isOpen}
        className={[
          'border-stoic-black/10 shadow-card flex h-[min(620px,calc(100vh-7rem))] w-[min(384px,calc(100vw-2rem))] origin-bottom-right flex-col overflow-hidden rounded-xl border bg-white transition-all duration-300 ease-out',
          isOpen
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0',
        ].join(' ')}
      >
        <header className="border-stoic-black/10 bg-stoic-background flex h-16 shrink-0 items-center justify-between border-b px-6">
          <h2 className="font-heading text-2xl leading-none">
            Stoic Assistant
          </h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="hover:bg-stoic-black/5 border-transparent bg-transparent text-[#444748]"
            onClick={onClose}
            aria-label="Close assistant"
          >
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>

        <div
          ref={messagesRef}
          className="bg-stoic-background flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto scroll-smooth px-4 py-6 sm:px-6"
        >
          {assistantMessages.map((message, index) => (
            <AssistantMessage
              author={message.author}
              text={message.text}
              key={`${message.author}-${index}`}
            />
          ))}
        </div>

        <footer className="border-stoic-black/10 bg-stoic-background border-t p-4">
          <div className="border-stoic-black/10 flex items-center rounded-xl border bg-white py-1 pr-2 pl-4">
            <input
              aria-label="Ask the assistant"
              className="text-primary placeholder:text-secondary/50 min-w-0 flex-1 bg-transparent py-3 text-base outline-none"
              placeholder="Ask a question..."
              readOnly
            />
            <Button
              type="button"
              size="icon"
              className="text-primary hover:bg-stoic-black/5 size-9 rounded-full bg-transparent"
              aria-label="Send message"
            >
              <SendHorizontal
                className="fill-primary size-5"
                aria-hidden="true"
              />
            </Button>
          </div>
        </footer>
      </section>

      <Button
        type="button"
        size="icon"
        className="size-12 rounded-full shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-4px_rgba(0,0,0,0.1)] transition-transform duration-200 hover:scale-105"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Hide assistant' : 'Show assistant'}
      >
        <Sparkles className="size-6" aria-hidden="true" />
      </Button>
    </div>
  );
}
