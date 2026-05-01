import { Body, Controller, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiTags } from '@nestjs/swagger';

import { CreateJournalDto } from './dto/create-journal.dto';
import { Journal } from './entities/journal.entity';
import { JournalService } from './journal.service';

@ApiTags('journal')
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post()
  @ApiCreatedResponse({ type: Journal })
  async create(@Body() createJournalDto: CreateJournalDto): Promise<Journal> {
    return this.journalService.create(createJournalDto);
  }
}
