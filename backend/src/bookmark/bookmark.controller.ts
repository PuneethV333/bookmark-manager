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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { GuestPayload } from '../auth/types/guest-payload.type';

@Controller('bookmark')
export class BookmarkController {
  constructor(private readonly bookmarkService: BookmarksService) {}

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
    @CurrentUser() user: GuestPayload,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const html = file.buffer.toString('utf-8');

    return this.bookmarkService.importFromHtml(html, user.sub);
  }

  @Get('check-all')
  async checkAll(@CurrentUser() user: GuestPayload) {
    return this.bookmarkService.batchCheck(user.sub);
  }

  @Get(':id/check')
  async checkOne(@Param('id') id: string, @CurrentUser() user: GuestPayload) {
    return this.bookmarkService.checkOne(id, user.sub);
  }
}
