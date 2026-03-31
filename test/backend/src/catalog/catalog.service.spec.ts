import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

const USER_ID = 'user-uuid-1';
const OTHER_USER_ID = 'user-uuid-2';
const ITEM_ID = 'item-uuid-1';

const mockItem = {
  id: ITEM_ID,
  userId: USER_ID,
  name: 'Widget Pro',
  description: 'A great widget',
  unitPrice: 99.99,
  taxRate: 0.16,
  discount: 0,
  internalCost: 50,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: PrismaService,
          useValue: {
            catalogItem: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    prisma = module.get(PrismaService);
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create a catalog item and return it (Req 1.2)', async () => {
      (prisma.catalogItem.create as jest.Mock).mockResolvedValue(mockItem);

      const dto = {
        name: 'Widget Pro',
        description: 'A great widget',
        unitPrice: 99.99,
        taxRate: 0.16,
      };

      const result = await service.create(USER_ID, dto);

      expect(prisma.catalogItem.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          name: dto.name,
          description: dto.description,
          unitPrice: dto.unitPrice,
          taxRate: dto.taxRate,
          discount: 0,
          internalCost: 0,
        },
      });
      expect(result).toEqual(mockItem);
    });

    it('should default taxRate, discount and internalCost to 0 when not provided (Req 1.2)', async () => {
      (prisma.catalogItem.create as jest.Mock).mockResolvedValue(mockItem);

      await service.create(USER_ID, { name: 'Minimal', unitPrice: 10 });

      expect(prisma.catalogItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ taxRate: 0, discount: 0, internalCost: 0 }),
      });
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('should return paginated results for the user (Req 1.5, 1.6)', async () => {
      (prisma.catalogItem.findMany as jest.Mock).mockResolvedValue([mockItem]);
      (prisma.catalogItem.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(USER_ID, { page: 1, limit: 10 });

      expect(prisma.catalogItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: USER_ID }, skip: 0, take: 10 }),
      );
      expect(result).toEqual({ data: [mockItem], total: 1, page: 1, limit: 10 });
    });

    it('should apply search filter case-insensitively on name and description (Req 1.6)', async () => {
      (prisma.catalogItem.findMany as jest.Mock).mockResolvedValue([mockItem]);
      (prisma.catalogItem.count as jest.Mock).mockResolvedValue(1);

      await service.findAll(USER_ID, { search: 'widget' });

      expect(prisma.catalogItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: USER_ID,
            OR: [
              { name: { contains: 'widget', mode: 'insensitive' } },
              { description: { contains: 'widget', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should use default page=1 and limit=20 when not provided (Req 1.5)', async () => {
      (prisma.catalogItem.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.catalogItem.count as jest.Mock).mockResolvedValue(0);

      const result = await service.findAll(USER_ID, {});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(prisma.catalogItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should calculate correct skip for page 3 with limit 5 (Req 1.5)', async () => {
      (prisma.catalogItem.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.catalogItem.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(USER_ID, { page: 3, limit: 5 });

      expect(prisma.catalogItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update and return the item when it belongs to the user (Req 1.7, 1.8)', async () => {
      const updated = { ...mockItem, name: 'Updated Widget' };
      (prisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockItem);
      (prisma.catalogItem.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.update(USER_ID, ITEM_ID, { name: 'Updated Widget' });

      expect(prisma.catalogItem.findFirst).toHaveBeenCalledWith({
        where: { id: ITEM_ID, userId: USER_ID },
      });
      expect(prisma.catalogItem.update).toHaveBeenCalledWith({
        where: { id: ITEM_ID },
        data: expect.objectContaining({ name: 'Updated Widget' }),
      });
      expect(result).toEqual(updated);
    });

    it('should throw NotFoundException when item belongs to another user (Req 1.9, 1.10)', async () => {
      (prisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(OTHER_USER_ID, ITEM_ID, { name: 'Hack' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.catalogItem.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when item does not exist (Req 1.9)', async () => {
      (prisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update(USER_ID, 'nonexistent-id', { name: 'Ghost' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('should delete the item when it belongs to the user (Req 1.9)', async () => {
      (prisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(mockItem);
      (prisma.catalogItem.delete as jest.Mock).mockResolvedValue(mockItem);

      await service.remove(USER_ID, ITEM_ID);

      expect(prisma.catalogItem.findFirst).toHaveBeenCalledWith({
        where: { id: ITEM_ID, userId: USER_ID },
      });
      expect(prisma.catalogItem.delete).toHaveBeenCalledWith({ where: { id: ITEM_ID } });
    });

    it('should throw NotFoundException when item belongs to another user (Req 1.9, 1.10)', async () => {
      (prisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(OTHER_USER_ID, ITEM_ID)).rejects.toThrow(NotFoundException);

      expect(prisma.catalogItem.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when item does not exist (Req 1.9)', async () => {
      (prisma.catalogItem.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.remove(USER_ID, 'nonexistent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
