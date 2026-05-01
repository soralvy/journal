import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from './journal.service';

type CreatedJournalEntry = {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
};

const createJournalEntryMock = jest.fn<() => Promise<CreatedJournalEntry>>();

const prismaService = {
  journalEntry: {
    create: createJournalEntryMock,
  },
};

describe('JournalService', () => {
  const createdAt = new Date('2026-05-01T12:00:00.000Z');
  const updatedAt = new Date('2026-05-01T12:05:00.000Z');

  let service: JournalService;

  beforeEach(async () => {
    prismaService.journalEntry.create.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get(JournalService);
  });

  it('creates a journal entry and maps dates to ISO strings', async () => {
    prismaService.journalEntry.create.mockResolvedValue({
      id: 'journal-entry-id',
      content: 'A focused reflection',
      createdAt,
      updatedAt,
    });

    await expect(service.create({ content: 'A focused reflection' })).resolves.toEqual({
      id: 'journal-entry-id',
      content: 'A focused reflection',
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });

    expect(prismaService.journalEntry.create).toHaveBeenCalledWith({
      data: {
        content: 'A focused reflection',
        user: {
          connect: {
            id: 'demo-user',
          },
        },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });
});
