import { Module } from '@nestjs/common';
import { BookmarkController } from './bookmark.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { BookmarksService } from './bookmark.service';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

@Module({
  imports: [AuthModule, PrismaModule, RedisModule],
  controllers: [BookmarkController],
  providers: [
    BookmarksService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class BookmarkModule {}
