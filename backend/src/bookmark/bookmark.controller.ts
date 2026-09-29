import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { BookmarksService } from './bookmark.service';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FirebaseUser } from '../common/guards/firebase-auth.guard';

@Controller('bookmark')
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarksService) {}

  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  @Post('import')
  @UseInterceptors(
    FileInterceptor('bookmarksFile', {
      storage: memoryStorage(),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_, file, cb) => {
        const isHtml =
          file.mimetype === 'text/html' ||
          file.originalname.toLowerCase().endsWith('.html');

        if (!isHtml) {
          return cb(
            new BadRequestException('Only .html bookmark exports are accepted'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async importBookmarks(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: FirebaseUser,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const html = file.buffer.toString('utf-8');

    return this.bookmarkService.importFromHtml(html, user.firebaseUid);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Get('check-all')
  async checkAll(@CurrentUser() user: FirebaseUser) {
    return this.bookmarkService.batchCheck(user.firebaseUid);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get(':id/check')
  async checkOne(@Param('id') id: string, @CurrentUser() user: FirebaseUser) {
    return this.bookmarkService.checkOne(id, user.firebaseUid);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get()
  async listBookmarks(@CurrentUser() user: FirebaseUser) {
    return this.bookmarkService.findAll(user.firebaseUid);
  }
}
