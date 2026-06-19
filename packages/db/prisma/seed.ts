import { PrismaClient } from '../src/generated/public';
import { provisionTenantSchema } from '../src/provision-tenant';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  const org = await db.organization.upsert({
    where: { slug: 'default' },
    update: {},
    create: { name: 'Default Organisation', slug: 'default', plan: 'FREE' },
  });

  await db.user.upsert({
    where: { email: 'admin@signflow.local' },
    update: {},
    create: {
      email: 'admin@signflow.local',
      name: 'Super Admin',
      passwordHash: await bcrypt.hash('changeme', 12),
      role: 'SUPER_ADMIN',
      orgId: org.id,
      emailVerified: new Date(),
    },
  });

  await provisionTenantSchema(org.slug, db);

  console.log('Seeded: admin@signflow.local / changeme');
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
