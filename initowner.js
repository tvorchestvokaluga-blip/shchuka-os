const { PrismaClient, UserRole } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const tempPassword = process.argv[2];
  if (!tempPassword) {
    console.error('Usage: node initowner.js <tempPassword>');
    process.exit(1);
  }

  let school = await prisma.school.findFirst({ where: { slug: 'schuka' } });
  if (!school) {
    school = await prisma.school.create({
      data: {
        name: 'Художественная школа «Щука»',
        slug: 'schuka',
        address: 'Калуга, ул. Театральная, 35/8',
        phone: '+7 953 332-53-62',
        email: 'hsh_40@mail.ru',
        timezone: 'Europe/Moscow',
      },
    });
    console.log('Школа создана:', school.id);
  } else {
    console.log('Школа уже существует:', school.id);
  }

  const email = 'hsh_40@mail.ru';
  const pwd = await bcrypt.hash(tempPassword, 10);

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: pwd, isActive: true, role: UserRole.OWNER } });
    console.log('Пользователь обновлён:', email);
  } else {
    await prisma.user.create({
      data: {
        schoolId: school.id,
        email,
        fullName: 'Екатерина Шелгунова',
        role: UserRole.OWNER,
        passwordHash: pwd,
        isActive: true,
      },
    });
    console.log('Владелец создан:', email);
  }
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
