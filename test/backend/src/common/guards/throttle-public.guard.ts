import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Stricter throttle guard for public (unauthenticated) endpoints.
 * Applied at controller level on PublicController.
 */
@Injectable()
export class ThrottlePublicGuard extends ThrottlerGuard {}
