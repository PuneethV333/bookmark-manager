import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirebaseUser } from '../common/guards/firebase-auth.guard';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(firebaseUser: FirebaseUser) {
    return this.prisma.user.upsert({
      where: { firebaseUid: firebaseUser.firebaseUid },
      create: {
        firebaseUid: firebaseUser.firebaseUid,
      },
      update: {},
      select: {
        id: true,
      },
    });
  }
}
