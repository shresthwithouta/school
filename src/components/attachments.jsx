"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Paperclip,
  Mic,
  Square,
  Loader2,
  X,
  FileText,
  Download,
  FolderPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn, formatDateTime } from "@/lib/utils";
import {
  formatBytes,


} from "@/lib/attachment";

export function AttachmentUploader({
  onAdd,
  disabled,
}


) {
  const inputRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);

  async function uploadFile(file) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Upload failed");
      return;
    }
    onAdd(data );
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        const stamp = new Date().toISOString().slice(11, 19).replace(/:/g, "-");
        uploadFile(new File([blob], `voice-${stamp}.webm`, { type: "audio/webm" }));
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Couldn't access the microphone.");
    }
  }

  function stopRecording() {
    recRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) uploadFile(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || uploading || recording}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Paperclip className="size-4" />
        )}
        Attach file
      </Button>
      {recording ? (
        <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
          <Square className="size-4" />
          Stop ({"recording…"})
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || uploading}
          onClick={startRecording}
        >
          <Mic className="size-4" />
          Record voice
        </Button>
      )}
    </div>
  );
}

export function AttachmentList({
  attachments,
  onRemove,
  canRemove,
  onSave,
  savingId,
}



) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <ul className="space-y-2">
      {attachments.map((a) => (
        <li key={a.id} className="rounded-lg border p-2">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{a.name}</span>
              </a>
              <p className="text-xs text-muted-foreground">
                {formatBytes(a.bytes)} · {a.uploadedByName} ·{" "}
                {formatDateTime(a.createdAt)}
              </p>
            </div>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title="Download"
            >
              <Download className="size-4" />
            </a>
            {onSave && (
              <button
                type="button"
                onClick={() => onSave(a)}
                disabled={savingId === a.id}
                className="text-muted-foreground hover:text-primary disabled:opacity-50"
                title="Save to repository"
              >
                {savingId === a.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FolderPlus className="size-4" />
                )}
              </button>
            )}
            {onRemove && (!canRemove || canRemove(a)) && (
              <button
                type="button"
                onClick={() => onRemove(a.id)}
                className="text-muted-foreground hover:text-destructive"
                title="Remove"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {a.kind === "image" && (
            <a href={a.url} target="_blank" rel="noopener noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.url}
                alt={a.name}
                className="mt-2 max-h-48 rounded-md border object-contain"
              />
            </a>
          )}
          {a.kind === "audio" && (
            <audio controls src={a.url} className="mt-2 w-full" />
          )}
          {a.kind === "video" && (
            <video controls src={a.url} className={cn("mt-2 max-h-56 w-full rounded-md")} />
          )}
        </li>
      ))}
    </ul>
  );
}
