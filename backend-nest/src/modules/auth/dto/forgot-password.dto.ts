import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({
    description: 'Email do usuário que deseja recuperar a senha',
    example: 'usuario@exemplo.com',
  })
  @IsEmail({}, { message: 'auth.validation.email_invalid' })
  @IsNotEmpty({ message: 'auth.validation.email_required' })
  email: string;
}
