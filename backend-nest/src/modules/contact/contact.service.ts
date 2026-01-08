import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { IBaseService } from 'src/domain/interface/base-service.interface';
import { Contact } from 'src/domain/contact/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { PaginatedResponse } from 'src/common/types/pagination.types';
import type { PaginationQuery } from '../../common/schemas/pagination.schema';
import * as path from 'path';
import { renderTemplateFromFile } from 'src/utils/email.util';
import { EmailService } from '../email/email.service';
import { SystemConfigurationService } from '../system-configuration/system-configuration.service';

@Injectable()
export class ContactService implements Omit<IBaseService<Contact, CreateContactDto>, 'update' | 'remove'> {
  constructor(
    private readonly prisma: PrismaService,
    private emailService: EmailService,
    private systemConfigurationService: SystemConfigurationService,
  ) { }

  async findAll(params?: PaginationQuery): Promise<PaginatedResponse<Contact> | Contact[]> {
    const { page = 1, limit = 10, pagination = true, search } = params || {};

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { telefone: { contains: search, mode: 'insensitive' } },
        { text: { contains: search, mode: 'insensitive' } },
      ];
    }

    const select = {
      id: true,
      name: true,
      email: true,
      telefone: true,
      text: true,
      createdAt: true,
      updatedAt: true,
    };

    if (!pagination) {
      return await this.prisma.contact.findMany({ where, select, orderBy: { createdAt: 'desc' } });
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({ where, select, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.contact.count({ where }),
    ]);
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: { total, page, limit, totalPages },
    };
  }

  async findOne(id: string): Promise<Contact | null> {
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        telefone: true,
        text: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(data: CreateContactDto): Promise<Contact> {
    const contact = await this.prisma.contact.create({
      data: {
        ...data,
      },
      select: {
        id: true,
        name: true,
        email: true,
        telefone: true,
        text: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const emailContact = (
      await this.systemConfigurationService.findByLabelKey('SYSTEMCONFIG_CONTACT_EMAIL')
    ).value as string;

    if (emailContact) {
      const templateData = {
        name: contact.name,
        email: contact.email,
        telefone: contact.telefone,
        text: contact.text,
      };

      const templatePath = path.join(
        __dirname,
        '..',
        'email',
        'template',
        'contact.html',
      );
      const html = await renderTemplateFromFile(templatePath, templateData, {
        escapeHtml: false,
      });

      const r = this.emailService.send({
        subject: 'Contato pelo site - ' + contact.name,
        to: emailContact,
        html,
      });

      console.log('Email sent result:', r);
    }

    return contact;
  }
}