import { ApiProperty } from '@nestjs/swagger';

export class Contact {
	@ApiProperty()
	id: string;

	@ApiProperty()
	name: string;

	@ApiProperty()
	email: string;

	@ApiProperty()
	telefone: string;

	@ApiProperty()
	text: string;

	@ApiProperty()
	createdAt: Date;

	@ApiProperty()
	updatedAt: Date;
}
