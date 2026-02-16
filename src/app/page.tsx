import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const space = await prisma.familySpace.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (space) {
    redirect(`/space/${space.id}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Aoudi Family Tree</h1>
        <p className="text-gray-500">No family tree has been created yet. Please run the seed script.</p>
        <code className="block mt-4 text-sm bg-gray-100 px-4 py-2 rounded">npm run db:seed</code>
      </div>
    </div>
  );
}
