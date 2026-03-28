import { IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

export class UpsertBrandingDto {
  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.logoUrl !== null)
  @IsString()
  @MaxLength(2048)
  logoUrl?: string | null;

  @ApiPropertyOptional({ example: '#2563eb' })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'primaryColor must be a valid hex color' })
  primaryColor?: string;

  @ApiPropertyOptional({ example: '#1d4ed8' })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX, { message: 'accentColor must be a valid hex color' })
  accentColor?: string;

  @ApiPropertyOptional({ example: 'Gracias por su preferencia.', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.footerText !== null)
  @IsString()
  @MaxLength(500)
  footerText?: string | null;

  @ApiPropertyOptional({ example: 'Acme Corp', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.companyName !== null)
  @IsString()
  @MaxLength(200)
  companyName?: string | null;
}
