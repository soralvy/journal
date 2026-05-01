import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { INestApplication, VersioningType } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test, TestingModule } from '@nestjs/testing';

import { JournalController } from '../src/app/journal/journal.controller';
import { JournalService } from '../src/app/journal/journal.service';

describe('JournalController (e2e)', () => {
  let app: INestApplication & NestFastifyApplication;
  const journalService = {
    create: jest.fn(),
  };

  beforeEach(async () => {
    journalService.create.mockReset();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [JournalController],
      providers: [
        {
          provide: JournalService,
          useValue: journalService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /api/v1/journal creates a journal entry', async () => {
    const responseBody = {
      id: 'journal-entry-id',
      content: 'A focused reflection',
      createdAt: '2026-05-01T12:00:00.000Z',
      updatedAt: '2026-05-01T12:05:00.000Z',
    };

    journalService.create.mockResolvedValue(responseBody);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/journal',
      payload: { content: 'A focused reflection' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual(responseBody);

    expect(journalService.create).toHaveBeenCalledWith({
      content: 'A focused reflection',
    });
  });
});
