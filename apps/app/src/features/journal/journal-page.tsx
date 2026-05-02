import { useState } from 'react';

import { useCreateJournalEntry } from './api/use-create-journal-entry';
import { JournalAssistant } from './components/journal-assistant';
import { JournalEditor } from './components/journal-editor';
import { JournalGuidePanel } from './components/journal-guide-panel';
import { JournalHeader } from './components/journal-header';
import { JournalSidebar } from './components/journal-sidebar';
import { useJournalDraft } from './use-journal-draft';

export const JournalPage = () => {
  const { body, setBody, setTitle, title, wordCount } = useJournalDraft();
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const handleAssistantClose = () => {
    setIsAssistantOpen(false);
  };
  const handleAssistantToggle = () => {
    setIsAssistantOpen((currentValue) => !currentValue);
  };

  const createJournalMutation = useCreateJournalEntry();

  const handleJournalSave = () => {
    createJournalMutation.mutate({
      data: {
        content: body,
      },
    });
  };

  return (
    <main className="bg-stoic-background text-primary flex min-h-screen overflow-hidden">
      <JournalSidebar />

      <section className="flex min-w-0 flex-1 flex-col">
        <JournalHeader
          title={title}
          wordCount={wordCount}
          onSave={handleJournalSave}
        />
        <JournalEditor
          body={body}
          onBodyChange={setBody}
          onTitleChange={setTitle}
          title={title}
        />
      </section>

      <JournalGuidePanel />
      <JournalAssistant
        isOpen={isAssistantOpen}
        onClose={handleAssistantClose}
        onToggle={handleAssistantToggle}
      />
    </main>
  );
};
