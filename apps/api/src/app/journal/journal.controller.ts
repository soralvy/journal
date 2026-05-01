import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';

import { CreateJournalDto } from './dto/create-journal.dto';
import { JournalApiErrorResponseDto, JournalValidationErrorResponseDto } from './dto/journal-error-response.dto';
import { JournalResponseDto } from './dto/journal-response.dto';
import { JournalService } from './journal.service';

@ApiTags('journal')
@Controller('journal')
export class JournalController {
  constructor(private readonly journalService: JournalService) {}

  @Post()
  @ApiOperation({ operationId: 'createJournal', summary: 'Create journal entry' })
  @ZodSerializerDto(JournalResponseDto)
  @ApiCreatedResponse({ type: JournalResponseDto })
  @ApiBadRequestResponse({ type: JournalValidationErrorResponseDto })
  @ApiInternalServerErrorResponse({ type: JournalApiErrorResponseDto })
  async create(@Body() createJournalDto: CreateJournalDto): Promise<JournalResponseDto> {
    return this.journalService.create(createJournalDto);
  }
}
