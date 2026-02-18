import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsInt, Min, IsNotEmpty } from 'class-validator';

/**
 * DTO para crear un nuevo lote (Admin)
 * Según sección 3 del documento
 */
export class CreateLoteDto {
  @ApiProperty({
    description: 'ID del vendedor que compra el lote',
    example: 'uuid-del-vendedor',
  })
  @IsUUID('4', { message: 'El ID del vendedor debe ser un UUID válido' })
  @IsNotEmpty({ message: 'El ID del vendedor es requerido' })
  vendedorId!: string;

  @ApiProperty({
    description: 'Cantidad de TRABIX del lote',
    example: 100,
    minimum: 1,
  })
  @IsInt({ message: 'La cantidad debe ser un número entero' })
  @Min(1, { message: 'La cantidad mínima es 1 TRABIX' })
  cantidadTrabix!: number;
}
