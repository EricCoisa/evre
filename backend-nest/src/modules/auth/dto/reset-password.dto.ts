import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    description: 'Token de recuperação de senha recebido por email',
    example: 'abc123def456...',
  })
  @IsString({ message: 'auth.validation.token_invalid' })
  @IsNotEmpty({ message: 'auth.validation.token_required' })
  token: string;

  @ApiProperty({
    description: 'Nova senha do usuário',
    example: 'NovaSenha@123',
    minLength: 8,
  })
  @IsString({ message: 'auth.validation.password_string' })
  @IsNotEmpty({ message: 'auth.validation.password_required' })
  @MinLength(8, { message: 'auth.validation.password_min_length' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/,
    {
      message: 'auth.validation.password_weak',
    },
  )
  password: string;
}
