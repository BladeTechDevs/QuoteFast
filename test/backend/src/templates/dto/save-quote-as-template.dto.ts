import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class SaveQuoteAsTemplateDto {
  @IsNotEmpty({ message: 'Name must not be empty' })
  @IsString()
  @MaxLength(255)
  name: string;
}
