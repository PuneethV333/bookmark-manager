import { Module } from '@nestjs/common';
import { BookmarkController } from './bookmark.controller';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { BookmarksService } from './bookmark.service';

@Module({
  imports: [AuthModule, PrismaModule, RedisModule],
  controllers: [BookmarkController],
  providers: [BookmarksService],
})
export class BookmarkModule {}
