import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO para logout.
 * El refresh token ahora se lee de la HttpOnly cookie 'rt' del servidor.
 * El access token es opcional: si se envía, se agrega a la blacklist inmediatamente
 * (en lugar de esperar a que expire en 15 minutos).
 */
export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Access token a invalidar (opcional, se blacklistea de inmediato si se envía)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsOptional()
  accessToken?: string;
}
