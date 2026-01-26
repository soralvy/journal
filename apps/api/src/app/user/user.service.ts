import { Injectable } from '@nestjs/common';
import { paginate } from 'src/common/helpers/pagination';
import { PaginationDto } from 'src/common/validation';

import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(createUserDto: CreateUserDto) {
    const user = await this.prisma.user.create({
      data: createUserDto,
    });

    return user;
  }

  async getUsers(query: PaginationDto) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        take: limit,
        skip,
      }),
      this.prisma.user.count(),
    ]);

    return paginate(users, total, page, limit);
  }
}
