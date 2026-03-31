import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuoteTemplatesService } from './quote-templates.service';
import { PrismaService } from '../prisma/prisma.service';

const USER_ID = 'user-uuid-1';
const OTHER_USER_ID = 'user-uuid-2';
const TEMPLATE_ID = 'template-uuid-1';

const mockItem = {
  id: 'item-uuid-1',
  templateId: TEMPLATE_ID,
  name: 'Consultoría',
  description: 'Hora de consultoría',
  quantity: 2,
  unitPrice: 100,
  discount: 0,
  taxRate: 0.16,
  internalCost: 50,
  order: 0,
};

const mockTemplate = {
  id: TEMPLATE_ID,
  userId: USER_ID,
  name: 'Plantilla Básica',
  currency: 'USD',
  taxRate: 0.16,
  discount: 0,
  notes: null,
  terms: null,
  isDefault: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [mockItem],
};

const mockSystemTemplate = {
  ...mockTemplate,
  id: 'system-template-uuid',
  userId: null,
  isDefault: true,
  name: 'Plantilla del Sistema',
  items: [],
};

describe('QuoteTemplatesService', () => {
  let service: QuoteTemplatesService;
  let prisma: jest.Mocked<PrismaService>;

  // Shared transaction mock that captures the callback and runs it
  let txMock: Record<string, Record<string, jest.Mock>>;

  beforeEach(async () => {
    txMock = {
      quoteTemplate: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      templateItem: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteTemplatesService,
        {
          provide: PrismaService,
          useValue: {
            quoteTemplate: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              delete: jest.fn(),
            },
            templateItem: {},
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QuoteTemplatesService>(QuoteTemplatesService);
    prisma = module.get(PrismaService);

    // Default $transaction implementation: execute the callback with txMock
    (prisma.$transaction as jest.Mock).mockImplementation((cb: (tx: unknown) => unknown) =>
      cb(txMock),
    );
  });

  // ─── create ──────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a template with items and return it (Req 4.1)', async () => {
      txMock.quoteTemplate.create.mockResolvedValue(mockTemplate);
      txMock.templateItem.createMany.mockResolvedValue({ count: 1 });
      txMock.quoteTemplate.findUnique.mockResolvedValue(mockTemplate);

      const dto = {
        name: 'Plantilla Básica',
        items: [
          {
            name: 'Consultoría',
            description: 'Hora de consultoría',
            quantity: 2,
            unitPrice: 100,
            discount: 0,
            taxRate: 0.16,
            internalCost: 50,
            order: 0,
          },
        ],
      };

      const result = await service.create(USER_ID, dto);

      expect(txMock.quoteTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: USER_ID, name: dto.name, isDefault: false }),
        }),
      );
      expect(txMock.templateItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'Consultoría', unitPrice: 100 }),
          ]),
        }),
      );
      expect(txMock.quoteTemplate.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: mockTemplate.id } }),
      );
      expect(result).toEqual(mockTemplate);
    });

    it('should create a template without items when items array is empty (Req 4.1)', async () => {
      txMock.quoteTemplate.create.mockResolvedValue({ ...mockTemplate, items: [] });
      txMock.quoteTemplate.findUnique.mockResolvedValue({ ...mockTemplate, items: [] });

      await service.create(USER_ID, { name: 'Sin ítems' });

      expect(txMock.templateItem.createMany).not.toHaveBeenCalled();
    });

    it('should default currency to USD and numeric fields to 0 (Req 4.1)', async () => {
      txMock.quoteTemplate.create.mockResolvedValue(mockTemplate);
      txMock.quoteTemplate.findUnique.mockResolvedValue(mockTemplate);

      await service.create(USER_ID, { name: 'Defaults' });

      expect(txMock.quoteTemplate.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'USD', taxRate: 0, discount: 0 }),
        }),
      );
    });
  });

  // ─── findAll ─────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return own templates plus system templates (Req 4.3)', async () => {
      const templates = [mockTemplate, mockSystemTemplate];
      (prisma.quoteTemplate.findMany as jest.Mock).mockResolvedValue(templates);

      const result = await service.findAll(USER_ID);

      expect(prisma.quoteTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ userId: USER_ID }, { isDefault: true, userId: null }],
          },
          include: expect.objectContaining({ items: expect.anything() }),
        }),
      );
      expect(result).toHaveLength(2);
      expect(result).toContainEqual(expect.objectContaining({ isDefault: false, userId: USER_ID }));
      expect(result).toContainEqual(expect.objectContaining({ isDefault: true, userId: null }));
    });

    it('should include items ordered by order field (Req 4.3, 4.4)', async () => {
      (prisma.quoteTemplate.findMany as jest.Mock).mockResolvedValue([mockTemplate]);

      await service.findAll(USER_ID);

      expect(prisma.quoteTemplate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { items: { orderBy: { order: 'asc' } } },
        }),
      );
    });
  });

  // ─── findOne ─────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('should return the template with items ordered by order (Req 4.4)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);

      const result = await service.findOne(USER_ID, TEMPLATE_ID);

      expect(prisma.quoteTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: TEMPLATE_ID,
            OR: [{ userId: USER_ID }, { isDefault: true, userId: null }],
          },
          include: { items: { orderBy: { order: 'asc' } } },
        }),
      );
      expect(result).toEqual(mockTemplate);
    });

    it('should throw NotFoundException when template does not exist (Req 4.4)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.findOne(USER_ID, 'nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should return a system template when requested by any user (Req 4.3)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockSystemTemplate);

      const result = await service.findOne(OTHER_USER_ID, mockSystemTemplate.id);

      expect(result).toEqual(mockSystemTemplate);
    });
  });

  // ─── update ──────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update metadata and replace items (Req 4.5)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);
      txMock.quoteTemplate.update.mockResolvedValue(mockTemplate);
      txMock.templateItem.deleteMany.mockResolvedValue({ count: 1 });
      txMock.templateItem.createMany.mockResolvedValue({ count: 1 });
      const updatedTemplate = { ...mockTemplate, name: 'Actualizada', items: [mockItem] };
      txMock.quoteTemplate.findUnique.mockResolvedValue(updatedTemplate);

      const dto = {
        name: 'Actualizada',
        items: [{ name: 'Nuevo ítem', unitPrice: 200, order: 0 }],
      };

      const result = await service.update(USER_ID, TEMPLATE_ID, dto);

      expect(txMock.quoteTemplate.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TEMPLATE_ID } }),
      );
      expect(txMock.templateItem.deleteMany).toHaveBeenCalledWith({
        where: { templateId: TEMPLATE_ID },
      });
      expect(txMock.templateItem.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ name: 'Nuevo ítem', unitPrice: 200 }),
          ]),
        }),
      );
      expect(result).toEqual(updatedTemplate);
    });

    it('should not replace items when items field is not provided in dto (Req 4.5)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);
      txMock.quoteTemplate.update.mockResolvedValue(mockTemplate);
      txMock.quoteTemplate.findUnique.mockResolvedValue(mockTemplate);

      await service.update(USER_ID, TEMPLATE_ID, { name: 'Solo nombre' });

      expect(txMock.templateItem.deleteMany).not.toHaveBeenCalled();
      expect(txMock.templateItem.createMany).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when updating a system template (Req 4.6)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockSystemTemplate);

      await expect(
        service.update(USER_ID, mockSystemTemplate.id, { name: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when template does not exist (Req 4.5)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(USER_ID, 'nonexistent', { name: 'Ghost' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete the template when it belongs to the user (Req 4.7)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);
      (prisma.quoteTemplate.delete as jest.Mock).mockResolvedValue(mockTemplate);

      await service.remove(USER_ID, TEMPLATE_ID);

      expect(prisma.quoteTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: TEMPLATE_ID }) }),
      );
      expect(prisma.quoteTemplate.delete).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID } });
    });

    it('should throw ForbiddenException when deleting a system template (Req 4.8)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockSystemTemplate);

      await expect(service.remove(USER_ID, mockSystemTemplate.id)).rejects.toThrow(
        ForbiddenException,
      );

      expect(prisma.quoteTemplate.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when template does not exist (Req 4.7)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(USER_ID, 'nonexistent')).rejects.toThrow(NotFoundException);

      expect(prisma.quoteTemplate.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when template belongs to another user (Req 4.7)', async () => {
      (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(OTHER_USER_ID, TEMPLATE_ID)).rejects.toThrow(NotFoundException);
    });
  });
});
