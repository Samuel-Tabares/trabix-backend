import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, IsBoolean, IsEnum, IsUUID } from 'class-validator';
import { ModalidadVentaMayor } from '@prisma/client';

/**
 * DTO para registrar una venta al mayor
 * Según sección 7 del documento
 */
export class RegistrarVentaMayorDto {
  @ApiProperty({
    description: 'ID del vendedor para quien se registra la venta',
    example: 'uuid-del-vendedor',
  })
  @IsUUID('4', { message: 'vendedorId debe ser un UUID válido' })
  vendedorId!: string;

  @ApiProperty({
    description: 'Cantidad de unidades (debe ser mayor a 20)',
    example: 49,
    minimum: 20,
  })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(10, { message: 'La cantidad para venta al mayor debe ser mayor o igual a 10' })
  cantidadUnidades!: number;

  @ApiProperty({
    description: 'Indica si es con licor (true) o sin licor (false)',
    example: true,
  })
  @IsBoolean({ message: 'conLicor debe ser un booleano' })
  conLicor!: boolean;

  @ApiProperty({
    description: 'Modalidad de pago',
    enum: ['ANTICIPADO', 'CONTRAENTREGA'],
    example: 'ANTICIPADO',
  })
  @IsEnum(['ANTICIPADO', 'CONTRAENTREGA'], {
    message: 'La modalidad debe ser ANTICIPADO o CONTRAENTREGA',
  })
  modalidad!: ModalidadVentaMayor;
}
