"use client";

import { useState, useCallback, useTransition, useRef, useMemo, type ElementRef } from "react";
import {
  TreePine, Plus, Search, Users, ChevronLeft, ChevronRight,
  UserPlus, Link2, Download, Maximize, X, Trash2, Edit2, LogIn, LogOut,
  ShieldCheck, CheckCircle, XCircle, Hand
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import Modal from "@/components/ui/Modal";
import Drawer from "@/components/ui/Drawer";
import Button from "@/components/ui/Button";
import PersonForm from "@/components/people/PersonForm";
import PersonCard from "@/components/people/PersonCard";
import {
  createPerson, updatePerson, deletePerson, createRelationship,
  deleteRelationship, createInvitation, submitClaim, getPendingClaims,
  approveClaim, rejectClaim
} from "@/lib/actions";
import type { FamilyTreeCanvasHandle } from "@/components/tree/FamilyTreeCanvas";

const FamilyTreeCanvas = dynamic(() => import("@/components/tree/FamilyTreeCanvas"), { ssr: false });

interface Person {
  id: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  firstNameAr?: string | null;
  middleNameAr?: string | null;
  lastNameAr?: string | null;
  nickname?: string | null;
  birthYear?: number | null;
  deathYear?: number | null;
  bio?: string | null;
  photoUrl?: string | null;
  gender?: string | null;
  isPrivate: boolean;
  hideBirthYear: boolean;
  tags?: string | null;
  spaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Relationship {
  id: string;
  type: string;
  subtype?: string | null;
  fromId: string;
  toId: string;
  startYear?: number | null;
  endYear?: number | null;
  spaceId: string;
  createdAt: Date;
}

interface ClaimData {
  id: string;
  user: { id: string; name: string | null; email: string | null };
  person: { id: string; firstName: string; lastName: string; firstNameAr: string | null; lastNameAr: string | null };
  createdAt: Date;
}

interface SpaceClientProps {
  space: { id: string; name: string; description?: string | null };
  people: Person[];
  relationships: Relationship[];
  role: string;
  userId: string;
  userName: string;
  isLoggedIn: boolean;
  claimedPersonId?: string | null;
}

export default function SpaceClient({
  space, people, relationships, role, userId, userName, isLoggedIn, claimedPersonId
}: SpaceClientProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [personDrawer, setPersonDrawer] = useState<Person | null>(null);
  const [addRelOpen, setAddRelOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [claimsOpen, setClaimsOpen] = useState(false);
  const [claims, setClaims] = useState<ClaimData[]>([]);
  const [focusPersonId, setFocusPersonId] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<"ancestors" | "descendants" | "mixed">("mixed");
  const [generations, setGenerations] = useState(5);
  const [isPending, startTransition] = useTransition();
  const treeRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<FamilyTreeCanvasHandle>(null);

  // Relationship form state
  const [relType, setRelType] = useState<"PARENT_CHILD" | "SPOUSE">("PARENT_CHILD");
  const [relSubtype, setRelSubtype] = useState("biological");
  const [relFromId, setRelFromId] = useState("");
  const [relToId, setRelToId] = useState("");

  const isAdmin = role === "OWNER" || role === "EDITOR";
  const isClaimer = role === "CLAIMER";

  // Build descendant set for claimer permission checks
  const claimerEditableIds = useMemo(() => {
    if (!claimedPersonId) return new Set<string>();
    const ids = new Set<string>([claimedPersonId]);
    const parentChildRels = relationships.filter((r) => r.type === "PARENT_CHILD");
    const childrenOf = new Map<string, string[]>();
    parentChildRels.forEach((r) => {
      if (!childrenOf.has(r.fromId)) childrenOf.set(r.fromId, []);
      childrenOf.get(r.fromId)!.push(r.toId);
    });
    const queue = [claimedPersonId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = childrenOf.get(current) || [];
      for (const child of children) {
        if (!ids.has(child)) {
          ids.add(child);
          queue.push(child);
        }
      }
    }
    return ids;
  }, [claimedPersonId, relationships]);

  const canEditPerson = (personId: string) => {
    if (isAdmin) return true;
    if (isClaimer) return claimerEditableIds.has(personId);
    return false;
  };

  const canEditAny = isAdmin || isClaimer;

  const filteredPeople = people.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      (p.firstNameAr && p.firstNameAr.includes(searchQuery)) ||
      (p.lastNameAr && p.lastNameAr.includes(searchQuery)) ||
      (p.nickname && p.nickname.toLowerCase().includes(q))
    );
  });

  const handleAddPerson = useCallback(async (data: any) => {
    startTransition(async () => {
      await createPerson(space.id, {
        firstName: data.firstName,
        middleName: data.middleName || undefined,
        lastName: data.lastName,
        firstNameAr: data.firstNameAr || undefined,
        middleNameAr: data.middleNameAr || undefined,
        lastNameAr: data.lastNameAr || undefined,
        nickname: data.nickname || undefined,
        birthYear: data.birthYear ? parseInt(data.birthYear) : undefined,
        deathYear: data.deathYear ? parseInt(data.deathYear) : undefined,
        bio: data.bio || undefined,
        gender: data.gender || undefined,
        photoUrl: data.photoUrl || undefined,
        tags: data.tags ? data.tags.split(",").map((t: string) => t.trim()) : undefined,
        isPrivate: data.isPrivate,
        hideBirthYear: data.hideBirthYear,
      });
      setAddPersonOpen(false);
    });
  }, [space.id]);

  const handleEditPerson = useCallback(async (data: any) => {
    if (!editPerson) return;
    startTransition(async () => {
      await updatePerson(editPerson.id, space.id, {
        firstName: data.firstName,
        middleName: data.middleName || undefined,
        lastName: data.lastName,
        firstNameAr: data.firstNameAr || undefined,
        middleNameAr: data.middleNameAr || undefined,
        lastNameAr: data.lastNameAr || undefined,
        nickname: data.nickname || undefined,
        birthYear: data.birthYear ? parseInt(data.birthYear) : null,
        deathYear: data.deathYear ? parseInt(data.deathYear) : null,
        bio: data.bio || undefined,
        gender: data.gender || undefined,
        photoUrl: data.photoUrl || undefined,
        tags: data.tags ? data.tags.split(",").map((t: string) => t.trim()) : undefined,
        isPrivate: data.isPrivate,
        hideBirthYear: data.hideBirthYear,
      });
      setEditPerson(null);
      setPersonDrawer(null);
    });
  }, [editPerson, space.id]);

  const handleDeletePerson = useCallback(async (personId: string) => {
    if (!confirm("Delete this person and all their relationships?")) return;
    startTransition(async () => {
      await deletePerson(personId, space.id);
      setPersonDrawer(null);
    });
  }, [space.id]);

  const handleAddRelationship = useCallback(async () => {
    if (!relFromId || !relToId || relFromId === relToId) return;
    startTransition(async () => {
      await createRelationship(space.id, {
        type: relType,
        subtype: relSubtype,
        fromId: relFromId,
        toId: relToId,
      });
      setAddRelOpen(false);
      setRelFromId("");
      setRelToId("");
    });
  }, [space.id, relType, relSubtype, relFromId, relToId]);

  const handleDeleteRelationship = useCallback(async (relId: string) => {
    startTransition(async () => {
      await deleteRelationship(relId, space.id);
    });
  }, [space.id]);

  const handleInvite = useCallback(async (role: string) => {
    startTransition(async () => {
      const inv = await createInvitation(space.id, role);
      setInviteLink(`${window.location.origin}/invite/${inv.token}`);
    });
  }, [space.id]);

  const handleClaim = useCallback(async (personId: string) => {
    startTransition(async () => {
      try {
        await submitClaim(personId, space.id);
        alert("Claim request sent! The admin will review it.");
      } catch (err: any) {
        alert(err.message || "Failed to submit claim");
      }
    });
  }, [space.id]);

  const handleOpenClaims = useCallback(async () => {
    startTransition(async () => {
      const data = await getPendingClaims(space.id);
      setClaims(data as any);
      setClaimsOpen(true);
    });
  }, [space.id]);

  const handleApproveClaim = useCallback(async (claimId: string) => {
    startTransition(async () => {
      await approveClaim(claimId, space.id);
      const data = await getPendingClaims(space.id);
      setClaims(data as any);
    });
  }, [space.id]);

  const handleRejectClaim = useCallback(async (claimId: string) => {
    startTransition(async () => {
      await rejectClaim(claimId, space.id);
      const data = await getPendingClaims(space.id);
      setClaims(data as any);
    });
  }, [space.id]);

  const handleExportPng = useCallback(async () => {
    canvasRef.current?.captureFullTree();
  }, []);

  const handlePersonClick = useCallback((personId: string) => {
    const person = people.find((p) => p.id === personId);
    if (person) setPersonDrawer(person);
  }, [people]);

  const getPersonRelationships = (personId: string) => {
    return relationships.filter((r) => r.fromId === personId || r.toId === personId);
  };

  const getRelatedPerson = (rel: Relationship, personId: string) => {
    const otherId = rel.fromId === personId ? rel.toId : rel.fromId;
    return people.find((p) => p.id === otherId);
  };

  const formatName = (p: { firstName: string; middleName?: string | null; lastName: string }) => {
    return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(" ");
  };

  const formatNameAr = (p: { firstNameAr?: string | null; middleNameAr?: string | null; lastNameAr?: string | null }) => {
    if (!p.firstNameAr && !p.middleNameAr && !p.lastNameAr) return null;
    return [p.firstNameAr, p.middleNameAr, p.lastNameAr].filter(Boolean).join(" ");
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#e2e8f0] px-4 py-3 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 lg:hidden"
          >
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <TreePine className="w-6 h-6 text-[#2b6cb0]" />
            <div>
              <h1 className="font-semibold text-sm sm:text-base leading-tight">{space.name}</h1>
              {space.description && (
                <span className="text-xs text-[#718096] hidden sm:block" dir="rtl">{space.description}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout mode toggle */}
          <div className="hidden md:flex items-center bg-gray-100 rounded-lg p-0.5">
            {(["mixed", "ancestors", "descendants"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setLayoutMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  layoutMode === mode ? "bg-white shadow-sm text-[#2b6cb0]" : "text-[#718096] hover:text-[#1a202c]"
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Generations slider */}
          <div className="hidden md:flex items-center gap-2 text-xs text-[#718096]">
            <span>Gen:</span>
            <input
              type="range"
              min={1}
              max={10}
              value={generations}
              onChange={(e) => setGenerations(parseInt(e.target.value))}
              className="w-16 accent-[#2b6cb0]"
            />
            <span className="w-4 text-center">{generations}</span>
          </div>

          <button onClick={handleExportPng} className="p-2 rounded-lg hover:bg-gray-100 text-[#718096]" title="Export PNG">
            <Download className="w-4 h-4" />
          </button>

          {isAdmin && (
            <>
              <button onClick={() => setInviteOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 text-[#718096]" title="Invite">
                <UserPlus className="w-4 h-4" />
              </button>
              <button onClick={handleOpenClaims} className="p-2 rounded-lg hover:bg-gray-100 text-[#718096]" title="Pending Claims">
                <ShieldCheck className="w-4 h-4" />
              </button>
            </>
          )}

          {isLoggedIn ? (
            <>
              <span className="text-xs text-[#718096] hidden sm:inline">{userName}</span>
              <form action={async () => { const { signOut } = await import("next-auth/react"); signOut({ callbackUrl: "/" }); }}>
                <button className="p-2 rounded-lg hover:bg-gray-100 text-[#718096]" title="Sign Out">
                  <LogOut className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="flex items-center gap-1.5 text-xs text-[#2b6cb0] hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50">
              <LogIn className="w-4 h-4" /> Login
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`bg-white border-r border-[#e2e8f0] flex-shrink-0 flex flex-col transition-all duration-300 z-10 ${
            sidebarOpen ? "w-72" : "w-0 overflow-hidden"
          } absolute lg:relative h-[calc(100vh-57px)] lg:h-auto`}
        >
          <div className="p-3 border-b border-[#e2e8f0]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#718096]" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search / بحث..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-[#e2e8f0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2b6cb0] focus:bg-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2 border-b border-[#e2e8f0]">
            <span className="text-xs font-medium text-[#718096] uppercase tracking-wider">
              People ({people.length})
            </span>
            {canEditAny && (
              <button
                onClick={() => setAddPersonOpen(true)}
                className="p-1 rounded hover:bg-gray-100 text-[#2b6cb0]"
                title="Add Person"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredPeople.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                compact
                selected={focusPersonId === p.id}
                onClick={() => {
                  setFocusPersonId(p.id);
                  setPersonDrawer(p);
                }}
              />
            ))}
            {filteredPeople.length === 0 && (
              <p className="text-sm text-[#718096] text-center py-8">
                {searchQuery ? "No results found" : "No people added yet"}
              </p>
            )}
          </div>

          {canEditAny && (
            <div className="p-3 border-t border-[#e2e8f0] space-y-2">
              <button
                onClick={() => setAddPersonOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-[#2b6cb0] text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" /> Add Person
              </button>
              <button
                onClick={() => setAddRelOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-white border border-[#e2e8f0] text-[#1a202c] py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                <Link2 className="w-4 h-4" /> Add Relationship
              </button>
            </div>
          )}
        </aside>

        {/* Main tree canvas */}
        <main className="flex-1 relative" ref={treeRef}>
          <FamilyTreeCanvas
            ref={canvasRef}
            people={people}
            relationships={relationships}
            onPersonClick={handlePersonClick}
            onAddPerson={() => setAddPersonOpen(true)}
            focusPersonId={focusPersonId}
            layoutMode={layoutMode}
            generations={generations}
            spaceName={space.name}
          />

          {/* Mobile bottom controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white rounded-full shadow-lg border border-[#e2e8f0] px-3 py-2 md:hidden z-10">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 rounded-full hover:bg-gray-100">
              <Search className="w-5 h-5 text-[#718096]" />
            </button>
            {canEditAny && (
              <>
                <button onClick={() => setAddPersonOpen(true)} className="p-2 rounded-full hover:bg-gray-100">
                  <Plus className="w-5 h-5 text-[#2b6cb0]" />
                </button>
                <button onClick={() => setAddRelOpen(true)} className="p-2 rounded-full hover:bg-gray-100">
                  <Link2 className="w-5 h-5 text-[#718096]" />
                </button>
              </>
            )}
            <button onClick={handleExportPng} className="p-2 rounded-full hover:bg-gray-100">
              <Download className="w-5 h-5 text-[#718096]" />
            </button>
          </div>

          {/* Focus indicator */}
          {focusPersonId && (
            <div className="absolute top-3 left-3 bg-white rounded-lg shadow-sm border border-[#e2e8f0] px-3 py-1.5 flex items-center gap-2 z-10">
              <span className="text-xs text-[#718096]">
                Focused: {people.find((p) => p.id === focusPersonId)?.firstName}
              </span>
              <button onClick={() => setFocusPersonId(null)} className="text-[#718096] hover:text-[#1a202c]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Add Person Modal */}
      <Modal open={addPersonOpen} onClose={() => setAddPersonOpen(false)} title="Add Family Member">
        <PersonForm
          onSubmit={handleAddPerson}
          onCancel={() => setAddPersonOpen(false)}
          loading={isPending}
        />
      </Modal>

      {/* Edit Person Modal */}
      <Modal open={!!editPerson} onClose={() => setEditPerson(null)} title="Edit Person">
        {editPerson && (
          <PersonForm
            initial={{
              firstName: editPerson.firstName,
              middleName: editPerson.middleName || "",
              lastName: editPerson.lastName,
              firstNameAr: editPerson.firstNameAr || "",
              middleNameAr: editPerson.middleNameAr || "",
              lastNameAr: editPerson.lastNameAr || "",
              nickname: editPerson.nickname || "",
              birthYear: editPerson.birthYear?.toString() || "",
              deathYear: editPerson.deathYear?.toString() || "",
              bio: editPerson.bio || "",
              gender: editPerson.gender || "",
              photoUrl: editPerson.photoUrl || "",
              tags: editPerson.tags ? JSON.parse(editPerson.tags).join(", ") : "",
              isPrivate: editPerson.isPrivate,
              hideBirthYear: editPerson.hideBirthYear,
            }}
            onSubmit={handleEditPerson}
            onCancel={() => setEditPerson(null)}
            loading={isPending}
          />
        )}
      </Modal>

      {/* Add Relationship Modal */}
      <Modal open={addRelOpen} onClose={() => setAddRelOpen(false)} title="Add Relationship">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={relType}
              onChange={(e) => { setRelType(e.target.value as any); setRelSubtype(e.target.value === "SPOUSE" ? "married" : "biological"); }}
              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm"
            >
              <option value="PARENT_CHILD">Parent → Child</option>
              <option value="SPOUSE">Spouse / Partner</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Subtype</label>
            <select
              value={relSubtype}
              onChange={(e) => setRelSubtype(e.target.value)}
              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm"
            >
              {relType === "PARENT_CHILD" ? (
                <>
                  <option value="biological">Biological</option>
                  <option value="adoptive">Adoptive</option>
                  <option value="guardian">Guardian</option>
                  <option value="step">Step</option>
                </>
              ) : (
                <>
                  <option value="married">Married</option>
                  <option value="partner">Partner</option>
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {relType === "PARENT_CHILD" ? "Parent" : "Person A"}
            </label>
            <select
              value={relFromId}
              onChange={(e) => setRelFromId(e.target.value)}
              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm"
            >
              <option value="">Select person...</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatName(p)}{formatNameAr(p) ? ` - ${formatNameAr(p)}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {relType === "PARENT_CHILD" ? "Child" : "Person B"}
            </label>
            <select
              value={relToId}
              onChange={(e) => setRelToId(e.target.value)}
              className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm"
            >
              <option value="">Select person...</option>
              {people.filter((p) => p.id !== relFromId).map((p) => (
                <option key={p.id} value={p.id}>
                  {formatName(p)}{formatNameAr(p) ? ` - ${formatNameAr(p)}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddRelOpen(false)}>Cancel</Button>
            <Button onClick={handleAddRelationship} disabled={!relFromId || !relToId || isPending}>
              {isPending ? "Adding..." : "Add Relationship"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Modal */}
      <Modal open={inviteOpen} onClose={() => { setInviteOpen(false); setInviteLink(""); }} title="Invite to Space">
        <div className="space-y-4">
          {!inviteLink ? (
            <>
              <p className="text-sm text-[#718096]">Generate an invite link to share with family members.</p>
              <div className="flex gap-2">
                <Button onClick={() => handleInvite("VIEWER")} variant="secondary">Viewer Link</Button>
                <Button onClick={() => handleInvite("EDITOR")}>Editor Link</Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[#718096]">Share this link (expires in 7 days):</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3 py-2 bg-gray-50 border border-[#e2e8f0] rounded-lg text-sm font-mono"
                />
                <Button onClick={() => { navigator.clipboard.writeText(inviteLink); }} variant="secondary">Copy</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Pending Claims Modal (Admin only) */}
      <Modal open={claimsOpen} onClose={() => setClaimsOpen(false)} title="Pending Claim Requests">
        <div className="space-y-3">
          {claims.length === 0 ? (
            <p className="text-sm text-[#718096] text-center py-4">No pending claims</p>
          ) : (
            claims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">
                    {claim.user.name || claim.user.email} wants to claim:
                  </p>
                  <p className="text-sm text-[#2b6cb0]">
                    {claim.person.firstName} {claim.person.lastName}
                    {claim.person.firstNameAr && (
                      <span className="text-[#718096] mr-1" dir="rtl"> - {claim.person.firstNameAr} {claim.person.lastNameAr}</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleApproveClaim(claim.id)}
                    disabled={isPending}
                    className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"
                    title="Approve"
                  >
                    <CheckCircle className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleRejectClaim(claim.id)}
                    disabled={isPending}
                    className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
                    title="Reject"
                  >
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Person Detail Drawer */}
      <Drawer
        open={!!personDrawer}
        onClose={() => setPersonDrawer(null)}
        title={personDrawer ? formatName(personDrawer) : ""}
      >
        {personDrawer && (
          <div className="space-y-6">
            {/* Profile section */}
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                {personDrawer.photoUrl ? (
                  <img src={personDrawer.photoUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${
                    personDrawer.gender === "male" ? "bg-blue-100 text-blue-500" :
                    personDrawer.gender === "female" ? "bg-pink-100 text-pink-500" :
                    "bg-gray-100 text-gray-400"
                  }`}>
                    <Users className="w-8 h-8" />
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {formatName(personDrawer)}
                </h3>
                {formatNameAr(personDrawer) && (
                  <p className="text-sm text-[#718096]" dir="rtl">{formatNameAr(personDrawer)}</p>
                )}
                {personDrawer.nickname && (
                  <p className="text-sm text-[#718096]">&quot;{personDrawer.nickname}&quot;</p>
                )}
                <p className="text-sm text-[#718096]">
                  {!personDrawer.hideBirthYear && personDrawer.birthYear ? `Born ${personDrawer.birthYear}` : ""}
                  {personDrawer.deathYear ? ` - Died ${personDrawer.deathYear}` : ""}
                </p>
              </div>
            </div>

            {personDrawer.bio && (
              <div>
                <h4 className="text-sm font-medium text-[#718096] mb-1">Bio</h4>
                <p className="text-sm">{personDrawer.bio}</p>
              </div>
            )}

            {personDrawer.tags && (
              <div>
                <h4 className="text-sm font-medium text-[#718096] mb-1">Tags</h4>
                <div className="flex flex-wrap gap-1">
                  {JSON.parse(personDrawer.tags).map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-blue-50 text-[#2b6cb0] text-xs rounded-full">{tag}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Relationships */}
            <div>
              <h4 className="text-sm font-medium text-[#718096] mb-2">Relationships</h4>
              <div className="space-y-2">
                {getPersonRelationships(personDrawer.id).map((rel) => {
                  const other = getRelatedPerson(rel, personDrawer.id);
                  if (!other) return null;
                  const isParent = rel.type === "PARENT_CHILD" && rel.fromId === personDrawer.id;
                  const label = rel.type === "SPOUSE"
                    ? (rel.subtype === "partner" ? "Partner" : "Spouse")
                    : isParent ? "Parent of" : "Child of";

                  return (
                    <div key={rel.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#718096] w-16">{label}</span>
                        <button
                          onClick={() => {
                            setPersonDrawer(other);
                            setFocusPersonId(other.id);
                          }}
                          className="text-sm font-medium text-[#2b6cb0] hover:underline"
                        >
                          {formatName(other)}
                          {formatNameAr(other) && (
                            <span className="text-[#718096] text-xs ml-1" dir="rtl">{formatNameAr(other)}</span>
                          )}
                        </button>
                        {rel.subtype && rel.subtype !== "biological" && rel.subtype !== "married" && (
                          <span className="text-[10px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded">{rel.subtype}</span>
                        )}
                      </div>
                      {canEditPerson(personDrawer.id) && (
                        <button
                          onClick={() => handleDeleteRelationship(rel.id)}
                          className="p-1 text-[#718096] hover:text-red-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {getPersonRelationships(personDrawer.id).length === 0 && (
                  <p className="text-sm text-[#718096]">No relationships yet</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-[#e2e8f0] flex-wrap">
              {canEditPerson(personDrawer.id) && (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setEditPerson(personDrawer); }}
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDeletePerson(personDrawer.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                </>
              )}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFocusPersonId(personDrawer.id)}
              >
                <Maximize className="w-3.5 h-3.5" /> Focus
              </Button>
              {/* Claim button: shown when logged in, no claim yet, and person isn't already claimed */}
              {isLoggedIn && !claimedPersonId && !isAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleClaim(personDrawer.id)}
                  disabled={isPending}
                >
                  <Hand className="w-3.5 h-3.5" /> This is me
                </Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
