"use client";
import { useState, useRef } from "react";
import { Upload, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Image from "next/image";

interface PersonFormData {
  firstName: string;
  lastName: string;
  firstNameAr: string;
  lastNameAr: string;
  nickname: string;
  birthYear: string;
  deathYear: string;
  bio: string;
  gender: string;
  photoUrl: string;
  tags: string;
  isPrivate: boolean;
  hideBirthYear: boolean;
}

interface PersonFormProps {
  initial?: Partial<PersonFormData>;
  onSubmit: (data: PersonFormData) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function PersonForm({ initial, onSubmit, onCancel, loading }: PersonFormProps) {
  const [form, setForm] = useState<PersonFormData>({
    firstName: initial?.firstName || "",
    lastName: initial?.lastName || "",
    firstNameAr: initial?.firstNameAr || "",
    lastNameAr: initial?.lastNameAr || "",
    nickname: initial?.nickname || "",
    birthYear: initial?.birthYear || "",
    deathYear: initial?.deathYear || "",
    bio: initial?.bio || "",
    gender: initial?.gender || "",
    photoUrl: initial?.photoUrl || "",
    tags: initial?.tags || "",
    isPrivate: initial?.isPrivate || false,
    hideBirthYear: initial?.hideBirthYear || false,
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) setForm((f) => ({ ...f, photoUrl: data.url }));
    } catch {
      // handle error silently
    }
    setUploading(false);
  };

  const update = (key: keyof PersonFormData, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
      className="space-y-4"
    >
      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border-2 border-dashed border-[#e2e8f0]">
          {form.photoUrl ? (
            <>
              <Image src={form.photoUrl} alt="Photo" fill className="object-cover" />
              <button
                type="button"
                onClick={() => update("photoUrl", "")}
                className="absolute top-0 right-0 p-0.5 bg-red-500 text-white rounded-full"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full h-full flex flex-col items-center justify-center text-[#718096] hover:text-[#2b6cb0] transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">Photo</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
        {uploading && <span className="text-sm text-[#718096]">Uploading...</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">First Name *</label>
          <input
            required
            value={form.firstName}
            onChange={(e) => update("firstName", e.target.value)}
            className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b6cb0]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Last Name *</label>
          <input
            required
            value={form.lastName}
            onChange={(e) => update("lastName", e.target.value)}
            className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b6cb0]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">الاسم الأول (Arabic)</label>
          <input
            dir="rtl"
            value={form.firstNameAr}
            onChange={(e) => update("firstNameAr", e.target.value)}
            className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b6cb0]"
            placeholder="الاسم الأول"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">اسم العائلة (Arabic)</label>
          <input
            dir="rtl"
            value={form.lastNameAr}
            onChange={(e) => update("lastNameAr", e.target.value)}
            className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b6cb0]"
            placeholder="اسم العائلة"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Nickname</label>
        <input
          value={form.nickname}
          onChange={(e) => update("nickname", e.target.value)}
          className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b6cb0]"
          placeholder="Optional"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Gender</label>
        <select
          value={form.gender}
          onChange={(e) => update("gender", e.target.value)}
          className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b6cb0]"
        >
          <option value="">Not specified</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Birth Year</label>
          <input
            type="number"
            value={form.birthYear}
            onChange={(e) => update("birthYear", e.target.value)}
            className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b6cb0]"
            placeholder="e.g., 1985"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Death Year</label>
          <input
            type="number"
            value={form.deathYear}
            onChange={(e) => update("deathYear", e.target.value)}
            className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b6cb0]"
            placeholder="Leave empty if living"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Bio</label>
        <textarea
          value={form.bio}
          onChange={(e) => update("bio", e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b6cb0] resize-none"
          placeholder="Optional biography..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Tags</label>
        <input
          value={form.tags}
          onChange={(e) => update("tags", e.target.value)}
          className="w-full px-3 py-2 border border-[#e2e8f0] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2b6cb0]"
          placeholder="e.g., paternal, maternal (comma-separated)"
        />
      </div>

      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.isPrivate}
            onChange={(e) => update("isPrivate", e.target.checked)}
            className="rounded border-[#e2e8f0] text-[#2b6cb0] focus:ring-[#2b6cb0]"
          />
          Private person
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.hideBirthYear}
            onChange={(e) => update("hideBirthYear", e.target.checked)}
            className="rounded border-[#e2e8f0] text-[#2b6cb0] focus:ring-[#2b6cb0]"
          />
          Hide birth year
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={loading || !form.firstName || !form.lastName}>
          {loading ? "Saving..." : initial?.firstName ? "Update" : "Add Person"}
        </Button>
      </div>
    </form>
  );
}
