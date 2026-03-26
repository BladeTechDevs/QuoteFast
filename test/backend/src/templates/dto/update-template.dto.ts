import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, any>;
}
