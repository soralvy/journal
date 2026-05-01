import { createFileRoute } from '@tanstack/react-router';

import { JournalPage } from '../features/journal';

export const Route = createFileRoute('/journal')({
  component: JournalPage,
});
