import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const emailHash = crypto.createHash("sha256").update("admin@aoudi.family").digest("hex");
  const user = await prisma.user.upsert({
    where: { email: "admin@aoudi.family" },
    update: {},
    create: {
      email: "admin@aoudi.family",
      emailHash,
      name: "Admin",
    },
  });

  // Create family space
  const space = await prisma.familySpace.create({
    data: {
      name: "Aoudi Family",
      description: "عائلة العودي",
      memberships: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  // Generation 1 - Grandparents
  const grandfather = await prisma.person.create({
    data: {
      firstName: "Ahmad",
      lastName: "Aoudi",
      firstNameAr: "أحمد",
      lastNameAr: "العودي",
      gender: "male",
      bio: "Family patriarch",
      spaceId: space.id,
    },
  });

  const grandmother = await prisma.person.create({
    data: {
      firstName: "Fatima",
      lastName: "Aoudi",
      firstNameAr: "فاطمة",
      lastNameAr: "العودي",
      gender: "female",
      bio: "Family matriarch",
      spaceId: space.id,
    },
  });

  // Spouse relationship
  await prisma.relationship.create({
    data: { type: "SPOUSE", subtype: "married", fromId: grandfather.id, toId: grandmother.id, spaceId: space.id },
  });

  // Generation 2 - Parents
  const father = await prisma.person.create({
    data: {
      firstName: "Mohammed",
      lastName: "Aoudi",
      firstNameAr: "محمد",
      lastNameAr: "العودي",
      gender: "male",
      spaceId: space.id,
    },
  });

  const mother = await prisma.person.create({
    data: {
      firstName: "Nour",
      lastName: "Aoudi",
      firstNameAr: "نور",
      lastNameAr: "العودي",
      gender: "female",
      spaceId: space.id,
    },
  });

  // Parent-child: grandparents -> father
  await prisma.relationship.create({
    data: { type: "PARENT_CHILD", subtype: "biological", fromId: grandfather.id, toId: father.id, spaceId: space.id },
  });
  await prisma.relationship.create({
    data: { type: "PARENT_CHILD", subtype: "biological", fromId: grandmother.id, toId: father.id, spaceId: space.id },
  });

  // Spouse: father & mother
  await prisma.relationship.create({
    data: { type: "SPOUSE", subtype: "married", fromId: father.id, toId: mother.id, spaceId: space.id },
  });

  // Generation 3 - Children
  const child1 = await prisma.person.create({
    data: {
      firstName: "Wael",
      lastName: "Aoudi",
      firstNameAr: "وائل",
      lastNameAr: "العودي",
      gender: "male",
      spaceId: space.id,
    },
  });

  const child2 = await prisma.person.create({
    data: {
      firstName: "Sara",
      lastName: "Aoudi",
      firstNameAr: "سارة",
      lastNameAr: "العودي",
      gender: "female",
      spaceId: space.id,
    },
  });

  // Parent-child: parents -> children
  for (const child of [child1, child2]) {
    await prisma.relationship.create({
      data: { type: "PARENT_CHILD", subtype: "biological", fromId: father.id, toId: child.id, spaceId: space.id },
    });
    await prisma.relationship.create({
      data: { type: "PARENT_CHILD", subtype: "biological", fromId: mother.id, toId: child.id, spaceId: space.id },
    });
  }

  console.log(`Created family space "${space.name}" with 6 people and relationships.`);
  console.log(`\nAdmin login: admin@aoudi.family`);
  console.log(`Space ID: ${space.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
