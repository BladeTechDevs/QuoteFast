import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class SignQuoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  signerName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^data:image\/(png|jpeg|jpg|webp);base64,/, {
    message: 'Signature image must be a valid base64 data URI with image MIME type (png, jpeg, jpg, or webp)',
  })
  signatureImage: string;
}
