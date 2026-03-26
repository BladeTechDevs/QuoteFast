import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateTemplateDto {
  @IsNotEmpty({ message: 'Name must not be empty' })
  @IsString()
  name: string;

  @IsObject()
  content: Record<string, any>;
}
