import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const space = await prisma.familySpace.findFirst({
      orderBy: { createdAt: "asc" },
    });

    if (space) {
      redirect(`/space/${space.id}`);
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Aoudi Family Tree</h1>
          <p className="text-gray-500">No family tree created yet.</p>
        </div>
      </div>
    );
  } catch (error: any) {
    if (error?.digest?.startsWith?.("NEXT_REDIRECT")) throw error;
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    const masked = dbUrl.replace(/:[^@]+@/, ":***@");
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-lg">
          <h1 className="text-2xl font-bold mb-2">Connection Error</h1>
          <pre className="text-xs bg-gray-100 p-4 rounded text-left overflow-x-auto whitespace-pre-wrap mb-4">{String(error?.message || error)}</pre>
          <p className="text-xs text-gray-400">URL: {masked}</p>
        </div>
      </div>
    );
  }
}
