import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BrandingService } from './branding.service';
import { UpsertBrandingDto } from './dto/upsert-branding.dto';

@ApiTags('branding')
@Controller('branding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BrandingController {
  constructor(private readonly brandingService: BrandingService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user branding settings' })
  getBranding(@CurrentUser() user: { id: string }) {
    return this.brandingService.getBranding(user.id);
  }

  @Put()
  @ApiOperation({ summary: 'Create or update branding settings' })
  upsertBranding(
    @CurrentUser() user: { id: string },
    @Body() dto: UpsertBrandingDto,
  ) {
    return this.brandingService.upsertBranding(user.id, dto);
  }
}
