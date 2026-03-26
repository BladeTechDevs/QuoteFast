import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Plan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

const DEFAULT_TEMPLATES = [
  {
    name: 'Propuesta de Servicios Profesionales',
    content: {
      currency: 'USD',
      taxRate: 16,
      discount: 0,
      notes: 'Gracias por considerar nuestros servicios. Este presupuesto es válido por 30 días.',
      terms:
        'El 50% del total se abona al inicio del proyecto. El 50% restante al finalizar. Los precios no incluyen IVA.',
    },
  },
  {
    name: 'Propuesta de Desarrollo de Software',
    content: {
      currency: 'USD',
      taxRate: 0,
      discount: 0,
      notes:
        'Incluye soporte técnico por 30 días tras la entrega. Revisiones ilimitadas durante el desarrollo.',
      terms:
        'Pago en 3 cuotas: 30% al inicio, 40% en entrega de versión beta, 30% en entrega final.',
    },
  },
];

@Injectable()
export class TemplatesService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultTemplates();
  }

  private async seedDefaultTemplates() {
    for (const tpl of DEFAULT_TEMPLATES) {
      const exists = await this.prisma.template.findFirst({
        where: { name: tpl.name, isDefault: true, userId: null },
      });
      if (!exists) {
        await this.prisma.template.create({
          data: { ...tpl, isDefault: true, userId: null },
        });
      }
    }
  }

  async create(userId: string, dto: CreateTemplateDto) {
    return this.prisma.template.create({
      data: {
        userId,
        name: dto.name,
        content: dto.content,
        isDefault: false,
      },
    });
  }

  async findAll(userId: string, userPlan: Plan) {
    const isTeamPlan = userPlan === Plan.TEAM || userPlan === Plan.BUSINESS;

    if (isTeamPlan) {
      // For TEAM/BUSINESS: include own templates + system defaults
      // (team sharing via same userId is handled here; a full team model
      //  would require a teamId field — for now we include own + defaults)
      return this.prisma.template.findMany({
        where: {
          OR: [
            { userId },
            { isDefault: true, userId: null },
          ],
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // FREE/PRO: own templates + system defaults
    return this.prisma.template.findMany({
      where: {
        OR: [
          { userId },
          { isDefault: true, userId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: string, id: string) {
    const template = await this.prisma.template.findFirst({
      where: {
        id,
        OR: [{ userId }, { isDefault: true, userId: null }],
      },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async update(userId: string, id: string, dto: UpdateTemplateDto) {
    // Only allow updating own (non-default) templates
    const template = await this.prisma.template.findFirst({
      where: { id, userId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const template = await this.prisma.template.findFirst({
      where: { id, userId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    await this.prisma.template.delete({ where: { id } });
  }
}
