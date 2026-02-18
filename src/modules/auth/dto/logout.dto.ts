import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para logout
 */
export class LogoutDto {
  @ApiProperty({
    description: 'Refresh token a invalidar (requerido para identificar la sesión)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'El refresh token debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El refresh token es requerido' })
  refreshToken!: string;

  @ApiPropertyOptional({
    description: 'Access token a invalidar (opcional, se agregará a blacklist si se proporciona)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString({ message: 'El access token debe ser una cadena de texto' })
  @IsOptional()
  accessToken?: string;
}
