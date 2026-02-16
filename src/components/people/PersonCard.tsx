"use client";
import { User, Lock, Minus } from "lucide-react";
import Image from "next/image";

interface PersonCardProps {
  person: {
    id: string;
    firstName: string;
    lastName: string;
    firstNameAr?: string | null;
    lastNameAr?: string | null;
    nickname?: string | null;
    birthYear?: number | null;
    deathYear?: number | null;
    photoUrl?: string | null;
    gender?: string | null;
    isPrivate?: boolean;
  };
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export default function PersonCard({ person, selected, compact, onClick }: PersonCardProps) {
  const fullName = `${person.firstName} ${person.lastName}`;
  const isDeceased = person.deathYear != null;

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
        selected
          ? "bg-blue-50 border-2 border-[#2b6cb0] shadow-sm"
          : "bg-white border border-[#e2e8f0] hover:border-[#2b6cb0] hover:shadow-sm"
      } ${compact ? "p-2" : ""}`}
    >
      <div className={`relative flex-shrink-0 ${compact ? "w-8 h-8" : "w-11 h-11"} rounded-full overflow-hidden bg-gray-100`}>
        {person.photoUrl ? (
          <Image src={person.photoUrl} alt={fullName} fill className="object-cover" />
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${
            person.gender === "male" ? "bg-blue-100 text-blue-600" :
            person.gender === "female" ? "bg-pink-100 text-pink-600" :
            "bg-gray-100 text-gray-400"
          }`}>
            <User className={compact ? "w-4 h-4" : "w-5 h-5"} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`font-medium truncate ${compact ? "text-sm" : "text-sm"}`}>{fullName}</span>
          {person.isPrivate && <Lock className="w-3 h-3 text-[#718096] flex-shrink-0" />}
          {isDeceased && <Minus className="w-3 h-3 text-[#718096] flex-shrink-0" />}
        </div>
        {(person.firstNameAr || person.lastNameAr) && (
          <p className="text-xs text-[#718096] truncate" dir="rtl">
            {person.firstNameAr || ""} {person.lastNameAr || ""}
          </p>
        )}
        {!compact && (person.birthYear || person.nickname) && (
          <p className="text-xs text-[#718096] truncate">
            {person.nickname ? `"${person.nickname}" ` : ""}
            {person.birthYear ? `b. ${person.birthYear}` : ""}
            {person.deathYear ? ` - d. ${person.deathYear}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}
