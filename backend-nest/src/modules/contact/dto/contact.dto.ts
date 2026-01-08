import { ApiProperty } from '@nestjs/swagger';
import { Contact } from 'src/domain/contact/contact.entity';

export class ContactDto {
	constructor(contact?: Contact) {
		if (!contact) return;
		Object.assign(this, {
			id: contact.id,
			name: contact.name,
			email: contact.email,
			telefone: contact.telefone,
			text: contact.text,
			createdAt: contact.createdAt,
			updatedAt: contact.updatedAt,
		});
	}

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
