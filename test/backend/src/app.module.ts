import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ClientsModule } from './clients/clients.module';
import { QuotesModule } from './quotes/quotes.module';
import { QuoteItemsModule } from './quote-items/quote-items.module';
import { PublicModule } from './public/public.module';
import { TrackingModule } from './tracking/tracking.module';
import { TemplatesModule } from './templates/templates.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BrandingModule } from './branding/branding.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    // Config validation — fails fast if required env vars are missing
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting — global defaults, overridable per controller/route
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 20 },   // 20 req/sec
      { name: 'long',  ttl: 60000, limit: 300 },  // 300 req/min
    ]),

    // Cron jobs (follow-up reminders, expiry checks)
    ScheduleModule.forRoot(),

    PrismaModule,
    AuthModule,
    ClientsModule,
    QuotesModule,
    QuoteItemsModule,
    PublicModule,
    TrackingModule,
    TemplatesModule,
    DashboardModule,
    BrandingModule,
    NotificationsModule,
  ],
})
export class AppModule {}
