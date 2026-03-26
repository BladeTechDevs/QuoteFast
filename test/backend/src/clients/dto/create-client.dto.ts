import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClientDto {
  @IsNotEmpty({ message: 'Name must not be empty' })
  @IsString()
  name: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
