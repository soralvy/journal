import { useCreateJournal } from '@api/journal/journal';
import { toast } from 'sonner';

export const useCreateJournalEntry = () => {
  return useCreateJournal({
    mutation: {
      onSuccess: () => {
        toast.success('Journal saved');
      },
      onError: () => {
        toast.error('Could not save journal');
      },
    },
  });
};
