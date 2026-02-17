"use server";

import { auth } from "./auth";
import { prisma } from "./prisma";
import { revalidatePath } from "next/cache";
import { generateInviteToken } from "./utils";

async function getAuthUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated");
  return session.user;
}

async function checkMembership(spaceId: string, minRole: "VIEWER" | "EDITOR" | "OWNER" = "VIEWER") {
  const user = await getAuthUser();
  const membership = await prisma.membership.findUnique({
    where: { userId_spaceId: { userId: user.id, spaceId } },
  });
  if (!membership) throw new Error("Not a member of this space");
  const roleHierarchy = { VIEWER: 0, EDITOR: 1, OWNER: 2 };
  if (roleHierarchy[membership.role as keyof typeof roleHierarchy] < roleHierarchy[minRole]) {
    throw new Error("Insufficient permissions");
  }
  return { user, membership };
}

// Check if user can edit a specific person (owner/editor = all, claimer = self + descendants)
async function checkEditPermission(spaceId: string, targetPersonId: string) {
  const user = await getAuthUser();

  // Check membership first
  const membership = await prisma.membership.findUnique({
    where: { userId_spaceId: { userId: user.id, spaceId } },
  });

  if (membership) {
    const roleHierarchy = { VIEWER: 0, EDITOR: 1, OWNER: 2 };
    if (roleHierarchy[membership.role as keyof typeof roleHierarchy] >= roleHierarchy["EDITOR"]) {
      return { user, membership }; // Owner/Editor can edit anything
    }
  }

  // Check if user has a claimed person and target is in their branch
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { personId: true },
  });

  if (!dbUser?.personId) throw new Error("No edit permission");

  const descendantIds = await getDescendantIds(dbUser.personId, spaceId);
  descendantIds.add(dbUser.personId); // Include self

  if (!descendantIds.has(targetPersonId)) {
    throw new Error("Can only edit your own branch");
  }

  return { user, membership };
}

// Walk PARENT_CHILD relationships downward to get all descendant IDs
async function getDescendantIds(personId: string, spaceId: string): Promise<Set<string>> {
  const allRels = await prisma.relationship.findMany({
    where: { spaceId, type: "PARENT_CHILD" },
    select: { fromId: true, toId: true },
  });

  const childrenOf = new Map<string, string[]>();
  allRels.forEach((r) => {
    if (!childrenOf.has(r.fromId)) childrenOf.set(r.fromId, []);
    childrenOf.get(r.fromId)!.push(r.toId);
  });

  const descendants = new Set<string>();
  const queue = [personId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = childrenOf.get(current) || [];
    for (const child of children) {
      if (!descendants.has(child)) {
        descendants.add(child);
        queue.push(child);
      }
    }
  }

  return descendants;
}

// Family Spaces
export async function createSpace(name: string, description?: string) {
  const user = await getAuthUser();
  const space = await prisma.familySpace.create({
    data: {
      name,
      description,
      memberships: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });
  revalidatePath("/");
  return space;
}

export async function getUserSpaces() {
  const user = await getAuthUser();
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { space: { include: { _count: { select: { people: true, memberships: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return memberships.map((m) => ({ ...m.space, role: m.role }));
}

export async function getSpace(spaceId: string) {
  // Public read - no auth required
  return prisma.familySpace.findUnique({
    where: { id: spaceId },
    include: {
      people: { orderBy: { firstName: "asc" } },
      memberships: { include: { user: { select: { id: true, name: true, email: true } } } },
      _count: { select: { people: true } },
    },
  });
}

// People
export async function createPerson(spaceId: string, data: {
  firstName: string;
  middleName?: string;
  lastName: string;
  firstNameAr?: string;
  middleNameAr?: string;
  lastNameAr?: string;
  nickname?: string;
  birthYear?: number;
  deathYear?: number;
  bio?: string;
  gender?: string;
  photoUrl?: string;
  tags?: string[];
  isPrivate?: boolean;
  hideBirthYear?: boolean;
}) {
  // For creating new people, need at least EDITOR or claimer with branch permission
  const user = await getAuthUser();
  const membership = await prisma.membership.findUnique({
    where: { userId_spaceId: { userId: user.id, spaceId } },
  });

  const isOwnerOrEditor = membership && (membership.role === "OWNER" || membership.role === "EDITOR");

  if (!isOwnerOrEditor) {
    // Check claimer - they can add children to people in their branch
    const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } });
    if (!dbUser?.personId) throw new Error("No permission to add people");
  }

  const person = await prisma.person.create({
    data: {
      ...data,
      tags: data.tags ? JSON.stringify(data.tags) : null,
      spaceId,
    },
  });
  revalidatePath(`/space/${spaceId}`);
  return person;
}

export async function updatePerson(personId: string, spaceId: string, data: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  firstNameAr?: string;
  middleNameAr?: string;
  lastNameAr?: string;
  nickname?: string;
  birthYear?: number | null;
  deathYear?: number | null;
  bio?: string;
  gender?: string;
  photoUrl?: string;
  tags?: string[];
  isPrivate?: boolean;
  hideBirthYear?: boolean;
}) {
  await checkEditPermission(spaceId, personId);
  const person = await prisma.person.update({
    where: { id: personId },
    data: {
      ...data,
      tags: data.tags ? JSON.stringify(data.tags) : undefined,
    },
  });
  revalidatePath(`/space/${spaceId}`);
  return person;
}

export async function deletePerson(personId: string, spaceId: string) {
  await checkEditPermission(spaceId, personId);
  await prisma.person.delete({ where: { id: personId } });
  revalidatePath(`/space/${spaceId}`);
}

// Relationships
export async function createRelationship(spaceId: string, data: {
  type: "PARENT_CHILD" | "SPOUSE";
  subtype?: string;
  fromId: string;
  toId: string;
  startYear?: number;
  endYear?: number;
}) {
  // For relationships, check edit permission on the "from" person
  await checkEditPermission(spaceId, data.fromId);
  const rel = await prisma.relationship.create({
    data: { ...data, spaceId },
  });
  revalidatePath(`/space/${spaceId}`);
  return rel;
}

export async function deleteRelationship(relationshipId: string, spaceId: string) {
  const rel = await prisma.relationship.findUnique({ where: { id: relationshipId } });
  if (!rel) throw new Error("Relationship not found");
  await checkEditPermission(spaceId, rel.fromId);
  await prisma.relationship.delete({ where: { id: relationshipId } });
  revalidatePath(`/space/${spaceId}`);
}

// Get full tree data (public)
export async function getTreeData(spaceId: string) {
  const [people, relationships] = await Promise.all([
    prisma.person.findMany({ where: { spaceId }, orderBy: { firstName: "asc" } }),
    prisma.relationship.findMany({ where: { spaceId } }),
  ]);
  return { people, relationships };
}

// Invitations
export async function createInvitation(spaceId: string, role: string = "VIEWER") {
  await checkMembership(spaceId, "OWNER");
  const token = generateInviteToken();
  const invitation = await prisma.invitation.create({
    data: {
      token,
      role,
      spaceId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return invitation;
}

export async function acceptInvitation(token: string) {
  const user = await getAuthUser();
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.used || invitation.expiresAt < new Date()) {
    throw new Error("Invalid or expired invitation");
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_spaceId: { userId: user.id, spaceId: invitation.spaceId } },
  });

  if (!existing) {
    await prisma.membership.create({
      data: { userId: user.id, spaceId: invitation.spaceId, role: invitation.role },
    });
  }

  await prisma.invitation.update({ where: { id: invitation.id }, data: { used: true } });
  revalidatePath("/");
  return invitation.spaceId;
}

export async function getSpaceMembers(spaceId: string) {
  const { membership } = await checkMembership(spaceId);
  const members = await prisma.membership.findMany({
    where: { spaceId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return members.map((m) => ({
    id: m.id,
    role: m.role,
    userName: m.user.name,
    userId: m.user.id,
    email: membership.role === "OWNER" ? m.user.email : undefined,
  }));
}

// Search (public)
export async function searchPeople(spaceId: string, query: string) {
  return prisma.person.findMany({
    where: {
      spaceId,
      OR: [
        { firstName: { contains: query } },
        { lastName: { contains: query } },
        { firstNameAr: { contains: query } },
        { lastNameAr: { contains: query } },
        { nickname: { contains: query } },
      ],
    },
    take: 20,
  });
}

// Claim system
export async function submitClaim(personId: string, spaceId: string) {
  const user = await getAuthUser();

  // Check if person exists
  const person = await prisma.person.findUnique({ where: { id: personId } });
  if (!person || person.spaceId !== spaceId) throw new Error("Person not found");

  // Check if user already has a claim
  const existingClaim = await prisma.claimRequest.findUnique({
    where: { userId_personId: { userId: user.id, personId } },
  });
  if (existingClaim) throw new Error("You already have a pending claim for this person");

  // Check if person is already claimed by someone
  const alreadyClaimed = await prisma.user.findFirst({
    where: { personId },
  });
  if (alreadyClaimed) throw new Error("This person has already been claimed");

  const claim = await prisma.claimRequest.create({
    data: { userId: user.id, personId },
  });

  revalidatePath(`/space/${spaceId}`);
  return claim;
}

export async function getPendingClaims(spaceId: string) {
  await checkMembership(spaceId, "OWNER");
  const claims = await prisma.claimRequest.findMany({
    where: { status: "PENDING", person: { spaceId } },
    include: {
      user: { select: { id: true, name: true, email: true } },
      person: { select: { id: true, firstName: true, lastName: true, firstNameAr: true, lastNameAr: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return claims;
}

export async function approveClaim(claimId: string, spaceId: string) {
  await checkMembership(spaceId, "OWNER");

  const claim = await prisma.claimRequest.findUnique({
    where: { id: claimId },
    include: { person: true },
  });
  if (!claim || claim.status !== "PENDING") throw new Error("Claim not found or already processed");

  // Set user.personId and update claim status
  await prisma.$transaction([
    prisma.user.update({
      where: { id: claim.userId },
      data: { personId: claim.personId },
    }),
    prisma.claimRequest.update({
      where: { id: claimId },
      data: { status: "APPROVED" },
    }),
  ]);

  revalidatePath(`/space/${spaceId}`);
}

export async function rejectClaim(claimId: string, spaceId: string) {
  await checkMembership(spaceId, "OWNER");
  await prisma.claimRequest.update({
    where: { id: claimId },
    data: { status: "REJECTED" },
  });
  revalidatePath(`/space/${spaceId}`);
}
