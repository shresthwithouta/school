"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";

/** Reads an image file and downscales it to a small square-ish JPEG data URL. */
function downscale(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function AvatarUpload({
  value,
  name,
  onChange,
}: {
  value: string;
  name: string;
  onChange: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setLoading(true);
    try {
      onChange(await downscale(file, 256));
    } catch {
      toast.error("Could not process that image.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        <AvatarImage src={value || undefined} alt={name} />
        <AvatarFallback className="bg-primary/10 text-lg text-primary">
          {getInitials(name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => inputRef.current?.click()}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Camera className="size-4" />
          )}
          {value ? "Change photo" : "Upload photo"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
          >
            <X className="size-4" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
