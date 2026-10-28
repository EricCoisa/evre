import { createZodDto } from 'nestjs-zod';
import { SetPageLayoutSchema } from './page-layout.dto';

/** Body de `PUT /page-builder/layout` — o mesmo schema que a tool `set_page_layout` recebe. */
export class SetPageLayoutBodyDto extends createZodDto(SetPageLayoutSchema) {}
