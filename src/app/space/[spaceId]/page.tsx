import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SpaceClient from "./SpaceClient";

export default async function SpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;

  const space = await prisma.familySpace.findUnique({
    where: { id: spaceId },
    include: {
      people: { orderBy: { firstName: "asc" } },
      memberships: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!space) redirect("/");

  const relationships = await prisma.relationship.findMany({ where: { spaceId } });

  // Check session optionally — public viewers get VIEWER role
  const session = await auth();
  let role = "VIEWER";
  let userId = "";
  let userName = "";
  let claimedPersonId: string | null = null;
  let isLoggedIn = false;

  if (session?.user?.id) {
    isLoggedIn = true;
    userId = session.user.id;
    userName = session.user.name || session.user.email || "User";

    // Check membership
    const membership = await prisma.membership.findUnique({
      where: { userId_spaceId: { userId: session.user.id, spaceId } },
    });

    if (membership) {
      role = membership.role;
    }

    // Check if user has a claimed person
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { personId: true },
    });
    if (user?.personId) {
      claimedPersonId = user.personId;
      // If not already OWNER/EDITOR, give them CLAIMER role
      if (role === "VIEWER") {
        role = "CLAIMER";
      }
    }
  }

  return (
    <SpaceClient
      space={space}
      people={space.people}
      relationships={relationships}
      role={role}
      userId={userId}
      userName={userName}
      isLoggedIn={isLoggedIn}
      claimedPersonId={claimedPersonId}
    />
  );
}
