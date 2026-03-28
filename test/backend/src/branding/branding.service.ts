import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertBrandingDto } from './dto/upsert-branding.dto';

@Injectable()
export class BrandingService {
  constructor(private readonly prisma: PrismaService) {}

  async getBranding(userId: string) {
    const branding = await this.prisma.brandingSettings.findUnique({
      where: { userId },
    });
    return branding ?? this.defaultBranding();
  }

  async upsertBranding(userId: string, dto: UpsertBrandingDto) {
    return this.prisma.brandingSettings.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: { ...dto },
    });
  }

  /** Fetch branding for a quote's owner (used in public view) */
  async getBrandingByQuotePublicId(publicId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { publicId },
      select: { user: { select: { brandingSettings: true } } },
    });
    return quote?.user?.brandingSettings ?? this.defaultBranding();
  }

  private defaultBranding() {
    return {
      logoUrl: null,
      primaryColor: '#2563eb',
      accentColor: '#1d4ed8',
      footerText: null,
      companyName: null,
    };
  }
}
