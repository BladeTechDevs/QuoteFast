import { PrismaClient, Plan } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const BCRYPT_SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Iniciando seed de base de datos...');

  // Crear usuarios de test
  const testUsers = [
    {
      email: 'test@quotefast.com',
      password: 'Test123!',
      name: 'Usuario Test',
      company: 'QuoteFast Demo',
      plan: Plan.FREE,
    },
    {
      email: 'admin@quotefast.com',
      password: 'Admin123!',
      name: 'Admin Test',
      company: 'QuoteFast Admin',
      plan: Plan.PRO,
    },
    {
      email: 'demo@quotefast.com',
      password: 'Demo123!',
      name: 'Demo User',
      company: 'Demo Company',
      plan: Plan.BUSINESS,
    },
  ];

  for (const userData of testUsers) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email },
    });

    if (existingUser) {
      console.log(`⏭️  Usuario ${userData.email} ya existe, saltando...`);
      continue;
    }

    const passwordHash = await bcrypt.hash(userData.password, BCRYPT_SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        name: userData.name,
        company: userData.company,
        plan: userData.plan,
      },
    });

    console.log(`✅ Usuario creado: ${user.email} (${user.plan})`);

    // Crear un cliente de ejemplo para cada usuario
    const client = await prisma.client.create({
      data: {
        userId: user.id,
        name: 'Cliente Ejemplo',
        email: 'cliente@example.com',
        company: 'Empresa Cliente SA',
        phone: '+1234567890',
        address: '123 Main St, City, Country',
        notes: 'Cliente de prueba creado por seed',
      },
    });

    console.log(`  📋 Cliente creado: ${client.name}`);

    // Crear una cotización de ejemplo
    const quote = await prisma.quote.create({
      data: {
        userId: user.id,
        clientId: client.id,
        title: 'Cotización de Ejemplo',
        status: 'DRAFT',
        currency: 'USD',
        taxRate: 10,
        notes: 'Esta es una cotización de ejemplo creada por el seed',
        terms: 'Pago a 30 días. Válido por 15 días.',
        validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 días
      },
    });

    console.log(`  💼 Cotización creada: ${quote.title}`);

    // Crear items de ejemplo para la cotización
    const items = [
      {
        name: 'Servicio de Consultoría',
        description: 'Consultoría técnica especializada',
        quantity: 10,
        unitPrice: 150,
        order: 1,
      },
      {
        name: 'Desarrollo de Software',
        description: 'Desarrollo de aplicación web personalizada',
        quantity: 40,
        unitPrice: 100,
        order: 2,
      },
      {
        name: 'Soporte Técnico',
        description: 'Soporte técnico mensual',
        quantity: 3,
        unitPrice: 500,
        order: 3,
      },
    ];

    for (const itemData of items) {
      const total = itemData.quantity * itemData.unitPrice;
      await prisma.quoteItem.create({
        data: {
          quoteId: quote.id,
          name: itemData.name,
          description: itemData.description,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          total,
          order: itemData.order,
        },
      });
    }

    // Calcular y actualizar totales de la cotización
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = subtotal * (10 / 100);
    const total = subtotal + taxAmount;

    await prisma.quote.update({
      where: { id: quote.id },
      data: {
        subtotal,
        taxAmount,
        total,
      },
    });

    console.log(`  📦 ${items.length} items agregados a la cotización`);
  }

  console.log('\n✨ Seed completado exitosamente!\n');
  console.log('📝 Usuarios creados:');
  console.log('   • test@quotefast.com / Test123! (Plan FREE)');
  console.log('   • admin@quotefast.com / Admin123! (Plan PRO)');
  console.log('   • demo@quotefast.com / Demo123! (Plan BUSINESS)');
  console.log('\n🚀 Puedes usar estos usuarios para hacer login en la aplicación.\n');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
