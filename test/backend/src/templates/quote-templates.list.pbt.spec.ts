/**
 * Feature: products-catalog-and-quote-templates, Property 12: Lista de QuoteTemplates incluye plantillas del sistema
 * Feature: products-catalog-and-quote-templates, Property 13: TemplateItems ordenados por order
 *
 * Valida: Requisitos 4.3, 4.4
 */

import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { QuoteTemplatesService } from './quote-templates.service';
import { PrismaService } from '../prisma/prisma.service';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const templateItemArb = fc.record({
  id: fc.uuid(),
  templateId: fc.uuid(),
  name: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
  quantity: fc.float({ min: 0, max: 1000, noNaN: true }),
  unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
  discount: fc.float({ min: 0, max: 10000, noNaN: true }),
  taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
  internalCost: fc.float({ min: 0, max: 100000, noNaN: true }),
  order: fc.integer({ min: 0, max: 1000 }),
  createdAt: fc.constant(new Date()),
  updatedAt: fc.constant(new Date()),
});

// ─── Test setup ──────────────────────────────────────────────────────────────

describe('QuoteTemplatesService - Property 12 & 13: Lista y orden de ítems', () => {
  let service: QuoteTemplatesService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuoteTemplatesService,
        {
          provide: PrismaService,
          useValue: {
            quoteTemplate: {
              findMany: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            templateItem: {
              createMany: jest.fn(),
              deleteMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QuoteTemplatesService>(QuoteTemplatesService);
    prisma = module.get(PrismaService);
  });

  // ─── Property 12 ───────────────────────────────────────────────────────────

  /**
   * **Validates: Requirements 4.3**
   *
   * Para cualquier usuario, la lista de QuoteTemplates retornada debe incluir
   * todas las plantillas con `isDefault = true` (plantillas del sistema) además
   * de las plantillas propias del usuario, y cada plantilla debe incluir sus
   * TemplateItems.
   */
  it(
    'Property 12: findAll incluye plantillas del sistema y propias del usuario con sus TemplateItems',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              currency: fc.constantFrom('USD', 'EUR', 'MXN'),
              taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
              discount: fc.float({ min: 0, max: 10000, noNaN: true }),
              notes: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
              terms: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
              createdAt: fc.constant(new Date()),
              updatedAt: fc.constant(new Date()),
              items: fc.array(templateItemArb, { minLength: 0, maxLength: 5 }),
            }),
            { minLength: 0, maxLength: 5 },
          ), // user templates
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              currency: fc.constantFrom('USD', 'EUR', 'MXN'),
              taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
              discount: fc.float({ min: 0, max: 10000, noNaN: true }),
              notes: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
              terms: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
              createdAt: fc.constant(new Date()),
              updatedAt: fc.constant(new Date()),
              items: fc.array(templateItemArb, { minLength: 0, maxLength: 5 }),
            }),
            { minLength: 1, maxLength: 5 },
          ), // system templates (at least 1)
          async (userId, userTemplatesBases, systemTemplatesBases) => {
            // Build full template objects
            const userTemplates = userTemplatesBases.map((t) => ({
              ...t,
              userId,
              isDefault: false,
            }));

            const systemTemplates = systemTemplatesBases.map((t) => ({
              ...t,
              userId: null,
              isDefault: true,
            }));

            const allTemplates = [...userTemplates, ...systemTemplates];

            // Mock findMany to return the combined list (simulating Prisma's OR filter)
            (prisma.quoteTemplate.findMany as jest.Mock).mockResolvedValue(allTemplates);

            const result = await service.findAll(userId);

            // Property: result must include all system templates
            const resultIds = new Set(result.map((t) => t.id));
            for (const sysTemplate of systemTemplates) {
              expect(resultIds.has(sysTemplate.id)).toBe(true);
            }

            // Property: result must include all user's own templates
            for (const userTemplate of userTemplates) {
              expect(resultIds.has(userTemplate.id)).toBe(true);
            }

            // Property: total count equals user templates + system templates
            expect(result).toHaveLength(allTemplates.length);

            // Property: every template in the result has an `items` array
            for (const template of result) {
              expect(template).toHaveProperty('items');
              expect(Array.isArray(template.items)).toBe(true);
            }

            // Property: findMany was called with the correct OR filter
            expect(prisma.quoteTemplate.findMany).toHaveBeenCalledWith(
              expect.objectContaining({
                where: {
                  OR: [{ userId }, { isDefault: true, userId: null }],
                },
                include: expect.objectContaining({
                  items: expect.anything(),
                }),
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );

  // ─── Property 13 ───────────────────────────────────────────────────────────

  /**
   * **Validates: Requirements 4.4**
   *
   * Para cualquier QuoteTemplate con TemplateItems, el detalle de la plantilla
   * debe retornar los TemplateItems en orden ascendente por el campo `order`.
   */
  it(
    'Property 13: findOne retorna TemplateItems ordenados ascendentemente por order',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // userId
          fc.uuid(), // templateId
          fc.array(
            fc.record({
              id: fc.uuid(),
              name: fc.string({ minLength: 1, maxLength: 100 }),
              description: fc.option(fc.string({ minLength: 1, maxLength: 200 }), { nil: null }),
              quantity: fc.float({ min: 0, max: 1000, noNaN: true }),
              unitPrice: fc.float({ min: 0, max: 100000, noNaN: true }),
              discount: fc.float({ min: 0, max: 10000, noNaN: true }),
              taxRate: fc.float({ min: 0, max: 100, noNaN: true }),
              internalCost: fc.float({ min: 0, max: 100000, noNaN: true }),
              order: fc.integer({ min: 0, max: 1000 }),
              createdAt: fc.constant(new Date()),
              updatedAt: fc.constant(new Date()),
            }),
            { minLength: 1, maxLength: 20 },
          ), // items in random order
          async (userId, templateId, itemsUnsorted) => {
            // Assign consistent templateId to all items
            const items = itemsUnsorted.map((item) => ({ ...item, templateId }));

            // Simulate Prisma's orderBy: asc — sort items by order ascending
            const itemsSortedByOrder = [...items].sort((a, b) => a.order - b.order);

            const mockTemplate = {
              id: templateId,
              userId,
              name: 'Test Template',
              currency: 'USD',
              taxRate: 0,
              discount: 0,
              notes: null,
              terms: null,
              isDefault: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              // The mock simulates Prisma's orderBy behavior
              items: itemsSortedByOrder,
            };

            (prisma.quoteTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);

            const result = await service.findOne(userId, templateId);

            // Property: items must be sorted in ascending order by `order`
            for (let i = 1; i < result.items.length; i++) {
              expect(result.items[i].order).toBeGreaterThanOrEqual(result.items[i - 1].order);
            }

            // Property: all original items are present (no items lost)
            expect(result.items).toHaveLength(items.length);

            // Property: findFirst was called with orderBy: { order: 'asc' }
            expect(prisma.quoteTemplate.findFirst).toHaveBeenCalledWith(
              expect.objectContaining({
                include: expect.objectContaining({
                  items: expect.objectContaining({
                    orderBy: { order: 'asc' },
                  }),
                }),
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    },
  );
});
