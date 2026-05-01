import { useMemo, useState } from 'react';

export function useJournalDraft() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(
    'What is within my control today?\nHow shall I act with virtue?',
  );

  const wordCount = useMemo(() => {
    const text = `${title} ${body}`.trim();

    if (!text) {
      return 0;
    }

    return text.split(/\s+/).length;
  }, [body, title]);

  return {
    body,
    setBody,
    setTitle,
    title,
    wordCount,
  };
}
