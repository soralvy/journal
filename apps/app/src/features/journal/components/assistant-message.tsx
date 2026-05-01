import { Bot } from 'lucide-react';

import type { AssistantMessageAuthor } from '../journal-mock-data';

type AssistantMessageProps = {
  author: AssistantMessageAuthor;
  text: string;
};

export function AssistantMessage({ author, text }: AssistantMessageProps) {
  const isUser = author === 'user';

  return (
    <article
      className={[
        'flex w-full gap-4',
        isUser ? 'justify-end' : 'justify-start',
      ].join(' ')}
    >
      {!isUser && (
        <div className="mt-6 flex size-8 shrink-0 items-center justify-center rounded-full bg-black text-white">
          <Bot className="size-4" aria-hidden="true" />
        </div>
      )}

      <div
        className={[
          'flex max-w-[78%] flex-col gap-2',
          isUser ? 'items-end' : 'items-start',
        ].join(' ')}
      >
        <span className="text-[13px] tracking-[0.02em] text-[#444748]">
          {isUser ? 'You' : 'Assistant'}
        </span>
        <p
          className={[
            'rounded-b-xl px-4 py-4 text-base leading-relaxed shadow-[0_1px_1px_rgba(0,0,0,0.05)]',
            isUser
              ? 'rounded-tl-xl rounded-tr-sm bg-black text-white'
              : 'border-stoic-black/10 text-primary rounded-tl-sm rounded-tr-xl border bg-white',
          ].join(' ')}
        >
          {text}
        </p>
      </div>

      {isUser && (
        <div className="bg-stoic-black/10 text-primary mt-6 flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
          JD
        </div>
      )}
    </article>
  );
}
