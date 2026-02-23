import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para refresh token.
 * El refresh token se lee de la HttpOnly cookie 'rt' del servidor.
 * El campo en body es ignorado; se mantiene por compatibilidad con Swagger/Postman.
 */
export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'No es necesario enviarlo: se lee automáticamente de la cookie HttpOnly "rt".',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}
