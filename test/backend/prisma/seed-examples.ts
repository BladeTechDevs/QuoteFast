import { PrismaClient, Plan, QuoteStatus } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Script para crear cotizaciones de ejemplo en diferentes estados del flujo
 * Ejecutar con: npx ts-node prisma/seed-examples.ts
 */

async function main() {
  console.log('🌱 Creando ejemplos de cotizaciones en diferentes estados...\n');

  // Buscar el usuario de prueba
  const user = await prisma.user.findUnique({
    where: { email: 'test@quotefast.com' },
  });

  if (!user) {
    console.error('❌ Usuario test@quotefast.com no encontrado. Ejecuta primero: npm run prisma:seed');
    process.exit(1);
  }

  // Buscar o crear clientes de ejemplo
  const client1 = await prisma.client.upsert({
    where: { id: 'example-client-1' },
    update: {},
    create: {
      id: 'example-client-1',
      userId: user.id,
      name: 'María González',
      email: 'maria@example.com',
      company: 'Tech Solutions SA',
      phone: '+52 55 1234 5678',
      address: 'Av. Reforma 123, CDMX, México',
    },
  });

  const client2 = await prisma.client.upsert({
    where: { id: 'example-client-2' },
    update: {},
    create: {
      id: 'example-client-2',
      userId: user.id,
      name: 'Carlos Ramírez',
      email: 'carlos@example.com',
      company: 'Innovación Digital',
      phone: '+52 33 9876 5432',
      address: 'Calle Principal 456, Guadalajara, México',
    },
  });

  const client3 = await prisma.client.upsert({
    where: { id: 'example-client-3' },
    update: {},
    create: {
      id: 'example-client-3',
      userId: user.id,
      name: 'Ana Martínez',
      email: 'ana@example.com',
      company: 'Startup Ventures',
      phone: '+52 81 5555 1234',
      address: 'Zona Industrial 789, Monterrey, México',
    },
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 1. COTIZACIÓN EN BORRADOR (DRAFT)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('📝 Creando cotización en estado DRAFT...');
  
  const draftQuote = await prisma.quote.create({
    data: {
      userId: user.id,
      clientId: client1.id,
      title: 'Desarrollo de Aplicación Móvil',
      status: QuoteStatus.DRAFT,
      currency: 'MXN',
      taxRate: 16,
      discount: 0,
      notes: 'Cotización preliminar para desarrollo de app iOS y Android',
      terms: 'Pago: 50% anticipo, 50% a la entrega. Válido por 30 días.',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    },
  });

  const draftItems = [
    { name: 'Diseño UI/UX', description: 'Diseño de interfaz y experiencia de usuario', quantity: 40, unitPrice: 800 },
    { name: 'Desarrollo iOS', description: 'Desarrollo nativo para iPhone y iPad', quantity: 80, unitPrice: 1200 },
    { name: 'Desarrollo Android', description: 'Desarrollo nativo para Android', quantity: 80, unitPrice: 1200 },
    { name: 'Backend API', description: 'Desarrollo de API REST', quantity: 60, unitPrice: 1000 },
  ];

  for (let i = 0; i < draftItems.length; i++) {
    const item = draftItems[i];
    await prisma.quoteItem.create({
      data: {
        quoteId: draftQuote.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        order: i,
      },
    });
  }

  const draftSubtotal = draftItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const draftTaxAmount = draftSubtotal * 0.16;
  const draftTotal = draftSubtotal + draftTaxAmount;

  await prisma.quote.update({
    where: { id: draftQuote.id },
    data: { subtotal: draftSubtotal, taxAmount: draftTaxAmount, total: draftTotal },
  });

  console.log(`   ✅ Cotización DRAFT creada: ${draftQuote.title}`);
  console.log(`   💰 Total: $${draftTotal.toLocaleString('es-MX')} MXN\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // 2. COTIZACIÓN ENVIADA (SENT)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('📤 Creando cotización en estado SENT...');
  
  const sentQuote = await prisma.quote.create({
    data: {
      userId: user.id,
      clientId: client2.id,
      title: 'Consultoría de Transformación Digital',
      status: QuoteStatus.SENT,
      currency: 'USD',
      taxRate: 0,
      discount: 5000,
      notes: 'Incluye análisis de procesos actuales y plan de implementación',
      terms: 'Pago mensual. Contrato mínimo de 6 meses.',
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Enviada hace 3 días
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    },
  });

  const sentItems = [
    { name: 'Análisis de Procesos', description: 'Evaluación completa de procesos actuales', quantity: 20, unitPrice: 150 },
    { name: 'Plan Estratégico', description: 'Desarrollo de roadmap de transformación', quantity: 30, unitPrice: 150 },
    { name: 'Capacitación', description: 'Talleres para el equipo', quantity: 16, unitPrice: 200 },
    { name: 'Soporte Mensual', description: 'Acompañamiento durante implementación', quantity: 6, unitPrice: 2000 },
  ];

  for (let i = 0; i < sentItems.length; i++) {
    const item = sentItems[i];
    await prisma.quoteItem.create({
      data: {
        quoteId: sentQuote.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        order: i,
      },
    });
  }

  const sentSubtotal = sentItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const sentTotal = sentSubtotal - 5000;

  await prisma.quote.update({
    where: { id: sentQuote.id },
    data: { subtotal: sentSubtotal, taxAmount: 0, total: sentTotal },
  });

  // Crear evento de tracking
  await prisma.trackingEvent.create({
    data: {
      quoteId: sentQuote.id,
      eventType: 'QUOTE_OPENED',
      ipAddress: '192.168.1.100',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    },
  });

  console.log(`   ✅ Cotización SENT creada: ${sentQuote.title}`);
  console.log(`   💰 Total: $${sentTotal.toLocaleString('en-US')} USD`);
  console.log(`   📅 Enviada hace 3 días\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // 3. COTIZACIÓN VISTA (VIEWED)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('👀 Creando cotización en estado VIEWED...');
  
  const viewedQuote = await prisma.quote.create({
    data: {
      userId: user.id,
      clientId: client3.id,
      title: 'Rediseño de Sitio Web Corporativo',
      status: QuoteStatus.VIEWED,
      currency: 'USD',
      taxRate: 0,
      discount: 0,
      notes: 'Incluye diseño responsive, optimización SEO y migración de contenido',
      terms: 'Pago: 40% anticipo, 30% a mitad de proyecto, 30% a la entrega.',
      validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Enviada hace 5 días
      viewedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Vista hace 2 días
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    },
  });

  const viewedItems = [
    { name: 'Diseño Web', description: 'Diseño de 10 páginas principales', quantity: 10, unitPrice: 500 },
    { name: 'Desarrollo Frontend', description: 'Implementación en React/Next.js', quantity: 60, unitPrice: 100 },
    { name: 'Desarrollo Backend', description: 'CMS y API', quantity: 40, unitPrice: 100 },
    { name: 'Optimización SEO', description: 'SEO técnico y contenido', quantity: 20, unitPrice: 80 },
    { name: 'Migración de Contenido', description: 'Migración desde sitio anterior', quantity: 15, unitPrice: 60 },
  ];

  for (let i = 0; i < viewedItems.length; i++) {
    const item = viewedItems[i];
    await prisma.quoteItem.create({
      data: {
        quoteId: viewedQuote.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        order: i,
      },
    });
  }

  const viewedSubtotal = viewedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  await prisma.quote.update({
    where: { id: viewedQuote.id },
    data: { subtotal: viewedSubtotal, taxAmount: 0, total: viewedSubtotal },
  });

  // Crear eventos de tracking
  await prisma.trackingEvent.createMany({
    data: [
      {
        quoteId: viewedQuote.id,
        eventType: 'QUOTE_OPENED',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        quoteId: viewedQuote.id,
        eventType: 'QUOTE_VIEWED',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        quoteId: viewedQuote.id,
        eventType: 'QUOTE_PDF_DOWNLOADED',
        ipAddress: '192.168.1.101',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log(`   ✅ Cotización VIEWED creada: ${viewedQuote.title}`);
  console.log(`   💰 Total: $${viewedSubtotal.toLocaleString('en-US')} USD`);
  console.log(`   📅 Enviada hace 5 días, vista hace 2 días`);
  console.log(`   📊 3 eventos de tracking registrados\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // 4. COTIZACIÓN ACEPTADA (ACCEPTED)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('✅ Creando cotización en estado ACCEPTED...');
  
  const acceptedQuote = await prisma.quote.create({
    data: {
      userId: user.id,
      clientId: client1.id,
      title: 'Sistema de Gestión de Inventario',
      status: QuoteStatus.ACCEPTED,
      currency: 'MXN',
      taxRate: 16,
      discount: 10000,
      notes: 'Sistema web para control de inventario con reportes en tiempo real',
      terms: 'Pago: 50% anticipo, 25% a mitad de proyecto, 25% a la entrega. Garantía de 3 meses.',
      validUntil: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      sentAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      viewedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      acceptedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Aceptada hace 1 día
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    },
  });

  const acceptedItems = [
    { name: 'Análisis y Diseño', description: 'Levantamiento de requerimientos y diseño de sistema', quantity: 40, unitPrice: 800 },
    { name: 'Desarrollo Backend', description: 'API REST con Node.js y PostgreSQL', quantity: 80, unitPrice: 1000 },
    { name: 'Desarrollo Frontend', description: 'Interfaz web con React', quantity: 60, unitPrice: 900 },
    { name: 'Módulo de Reportes', description: 'Dashboard con gráficas y exportación', quantity: 30, unitPrice: 850 },
    { name: 'Integración con ERP', description: 'Conexión con sistema existente', quantity: 20, unitPrice: 1200 },
    { name: 'Capacitación', description: 'Capacitación a usuarios finales', quantity: 8, unitPrice: 1500 },
  ];

  for (let i = 0; i < acceptedItems.length; i++) {
    const item = acceptedItems[i];
    await prisma.quoteItem.create({
      data: {
        quoteId: acceptedQuote.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        order: i,
      },
    });
  }

  const acceptedSubtotal = acceptedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const acceptedTaxAmount = (acceptedSubtotal - 10000) * 0.16;
  const acceptedTotal = acceptedSubtotal - 10000 + acceptedTaxAmount;

  await prisma.quote.update({
    where: { id: acceptedQuote.id },
    data: { subtotal: acceptedSubtotal, taxAmount: acceptedTaxAmount, total: acceptedTotal },
  });

  // Crear eventos de tracking
  await prisma.trackingEvent.createMany({
    data: [
      {
        quoteId: acceptedQuote.id,
        eventType: 'QUOTE_OPENED',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        quoteId: acceptedQuote.id,
        eventType: 'QUOTE_VIEWED',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      },
      {
        quoteId: acceptedQuote.id,
        eventType: 'QUOTE_ACCEPTED',
        ipAddress: '192.168.1.102',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log(`   ✅ Cotización ACCEPTED creada: ${acceptedQuote.title}`);
  console.log(`   💰 Total: $${acceptedTotal.toLocaleString('es-MX')} MXN`);
  console.log(`   📅 Aceptada hace 1 día`);
  console.log(`   🎉 Cliente confirmó el proyecto\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // 5. COTIZACIÓN RECHAZADA (REJECTED)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('❌ Creando cotización en estado REJECTED...');
  
  const rejectedQuote = await prisma.quote.create({
    data: {
      userId: user.id,
      clientId: client2.id,
      title: 'Desarrollo de E-commerce',
      status: QuoteStatus.REJECTED,
      currency: 'USD',
      taxRate: 0,
      discount: 0,
      notes: 'Tienda online con pasarela de pagos y gestión de productos',
      terms: 'Pago: 40% anticipo, 60% a la entrega.',
      validUntil: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // Ya expiró
      sentAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      viewedAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      rejectedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // Rechazada hace 15 días
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    },
  });

  const rejectedItems = [
    { name: 'Diseño de Tienda', description: 'Diseño personalizado de e-commerce', quantity: 30, unitPrice: 120 },
    { name: 'Desarrollo', description: 'Implementación con Shopify/WooCommerce', quantity: 50, unitPrice: 100 },
    { name: 'Integración de Pagos', description: 'Stripe, PayPal, etc.', quantity: 15, unitPrice: 150 },
  ];

  for (let i = 0; i < rejectedItems.length; i++) {
    const item = rejectedItems[i];
    await prisma.quoteItem.create({
      data: {
        quoteId: rejectedQuote.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        order: i,
      },
    });
  }

  const rejectedSubtotal = rejectedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  await prisma.quote.update({
    where: { id: rejectedQuote.id },
    data: { subtotal: rejectedSubtotal, taxAmount: 0, total: rejectedSubtotal },
  });

  await prisma.trackingEvent.createMany({
    data: [
      {
        quoteId: rejectedQuote.id,
        eventType: 'QUOTE_OPENED',
        ipAddress: '192.168.1.103',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000),
      },
      {
        quoteId: rejectedQuote.id,
        eventType: 'QUOTE_REJECTED',
        ipAddress: '192.168.1.103',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  console.log(`   ✅ Cotización REJECTED creada: ${rejectedQuote.title}`);
  console.log(`   💰 Total: $${rejectedSubtotal.toLocaleString('en-US')} USD`);
  console.log(`   📅 Rechazada hace 15 días\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // 6. COTIZACIÓN FIRMADA (SIGNED)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('✍️ Creando cotización en estado SIGNED...');
  
  const signedQuote = await prisma.quote.create({
    data: {
      userId: user.id,
      clientId: client3.id,
      title: 'Desarrollo de Dashboard Analítico',
      status: QuoteStatus.SIGNED,
      currency: 'USD',
      taxRate: 0,
      discount: 2000,
      notes: 'Dashboard interactivo con visualización de datos en tiempo real',
      terms: 'Pago: 50% anticipo, 50% a la entrega. Soporte incluido por 6 meses.',
      validUntil: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      viewedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      signedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Firmada hace 2 horas
      subtotal: 0,
      taxAmount: 0,
      total: 0,
    },
  });

  const signedItems = [
    { name: 'Diseño UI/UX', description: 'Diseño de interfaz de dashboard', quantity: 25, unitPrice: 120 },
    { name: 'Desarrollo Frontend', description: 'React + D3.js para visualizaciones', quantity: 60, unitPrice: 110 },
    { name: 'Desarrollo Backend', description: 'API para procesamiento de datos', quantity: 40, unitPrice: 120 },
    { name: 'Integración de Datos', description: 'Conexión con fuentes de datos', quantity: 20, unitPrice: 130 },
  ];

  for (let i = 0; i < signedItems.length; i++) {
    const item = signedItems[i];
    await prisma.quoteItem.create({
      data: {
        quoteId: signedQuote.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.quantity * item.unitPrice,
        order: i,
      },
    });
  }

  const signedSubtotal = signedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const signedTotal = signedSubtotal - 2000;

  await prisma.quote.update({
    where: { id: signedQuote.id },
    data: { subtotal: signedSubtotal, taxAmount: 0, total: signedTotal },
  });

  // Crear firma electrónica
  await prisma.signature.create({
    data: {
      quoteId: signedQuote.id,
      signerName: 'Ana Martínez',
      signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      ipAddress: '192.168.1.104',
      userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
      signedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    },
  });

  await prisma.trackingEvent.createMany({
    data: [
      {
        quoteId: signedQuote.id,
        eventType: 'QUOTE_OPENED',
        ipAddress: '192.168.1.104',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      },
      {
        quoteId: signedQuote.id,
        eventType: 'QUOTE_VIEWED',
        ipAddress: '192.168.1.104',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      },
      {
        quoteId: signedQuote.id,
        eventType: 'QUOTE_SIGNED',
        ipAddress: '192.168.1.104',
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
    ],
  });

  console.log(`   ✅ Cotización SIGNED creada: ${signedQuote.title}`);
  console.log(`   💰 Total: $${signedTotal.toLocaleString('en-US')} USD`);
  console.log(`   📅 Firmada hace 2 horas`);
  console.log(`   ✍️ Firma electrónica registrada\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // RESUMEN
  // ══════════════════════════════════════════════════════════════════════════
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('✨ Ejemplos creados exitosamente!\n');
  console.log('📊 Resumen de cotizaciones creadas:');
  console.log('   1. DRAFT    - Desarrollo de Aplicación Móvil');
  console.log('   2. SENT     - Consultoría de Transformación Digital');
  console.log('   3. VIEWED   - Rediseño de Sitio Web Corporativo');
  console.log('   4. ACCEPTED - Sistema de Gestión de Inventario');
  console.log('   5. REJECTED - Desarrollo de E-commerce');
  console.log('   6. SIGNED   - Desarrollo de Dashboard Analítico\n');
  console.log('🔗 Accede a la aplicación en http://localhost:3000');
  console.log('👤 Usuario: test@quotefast.com');
  console.log('🔑 Contraseña: Test123!\n');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('❌ Error creando ejemplos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
