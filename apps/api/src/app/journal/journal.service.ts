import { Injectable } from '@nestjs/common';
import { Prisma } from '@repo/database';

import { PrismaService } from '../prisma/prisma.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { JournalResponseDto } from './dto/journal-response.dto';

const DEMO_USER_ID = 'demo-user';

const journalEntrySelect = {
  id: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.JournalEntrySelect;

type JournalEntryResponse = Prisma.JournalEntryGetPayload<{
  select: typeof journalEntrySelect;
}>;

@Injectable()
export class JournalService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createJournalDto: CreateJournalDto): Promise<JournalResponseDto> {
    const journalEntry = await this.prisma.journalEntry.create({
      data: {
        content: createJournalDto.content,
        user: {
          connect: {
            id: DEMO_USER_ID,
          },
        },
      },
      select: journalEntrySelect,
    });

    return this.toJournalResponse(journalEntry);
  }

  private toJournalResponse(journalEntry: JournalEntryResponse): JournalResponseDto {
    return {
      id: journalEntry.id,
      content: journalEntry.content,
      createdAt: journalEntry.createdAt.toISOString(),
      updatedAt: journalEntry.updatedAt.toISOString(),
    };
  }
}
