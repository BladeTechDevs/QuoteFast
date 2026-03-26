import { IsEnum, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { QuoteStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListQuotesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: QuoteStatus })
  @IsOptional()
  @IsEnum(QuoteStatus)
  status?: QuoteStatus;

  @ApiPropertyOptional({ description: 'Search by title (case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'total', 'title', 'status'] })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'total', 'title', 'status'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
