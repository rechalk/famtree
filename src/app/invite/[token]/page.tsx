import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TreePine, CheckCircle, XCircle } from "lucide-react";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  const { token } = await params;

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/invite/${token}`);
  }

  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (!invitation || invitation.used || invitation.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Invalid Invitation</h1>
          <p className="text-[#718096] mb-6">This invitation link is invalid or has expired.</p>
          <Link href="/" className="text-[#2b6cb0] hover:underline">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  // Accept invitation
  const existing = await prisma.membership.findUnique({
    where: { userId_spaceId: { userId: session.user.id, spaceId: invitation.spaceId } },
  });

  if (!existing) {
    await prisma.membership.create({
      data: { userId: session.user.id, spaceId: invitation.spaceId, role: invitation.role },
    });
  }

  await prisma.invitation.update({ where: { id: invitation.id }, data: { used: true } });

  const space = await prisma.familySpace.findUnique({ where: { id: invitation.spaceId } });

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Welcome!</h1>
        <p className="text-[#718096] mb-6">
          You&apos;ve joined <strong>{space?.name || "Family Space"}</strong> as {invitation.role.toLowerCase()}.
        </p>
        <Link
          href={`/space/${invitation.spaceId}`}
          className="inline-flex items-center gap-2 bg-[#2b6cb0] text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <TreePine className="w-5 h-5" /> View Family Tree
        </Link>
      </div>
    </div>
  );
}
