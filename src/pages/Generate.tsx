import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ImageIcon, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { storage } from "@/lib/storage";
import { fileToBase64, generatePlan } from "@/lib/anthropic";
import { detectTimezone, todayLocalISO } from "@/lib/time";
import { cn } from "@/lib/utils";

export function Generate() {
  const navigate = useNavigate();
  const settings = storage.getSettings();

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [blurb, setBlurb] = useState("");
  const [workingStart, setWorkingStart] = useState(settings.workingHoursStart);
  const [workingEnd, setWorkingEnd] = useState(settings.workingHoursEnd);
  const [targetDate, setTargetDate] = useState(todayLocalISO());
  const [timezone] = useState(detectTimezone());
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            setImageFile(file);
            return;
          }
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image");
      return;
    }
    setError(null);
    setImageFile(file);
  }

  async function handleGenerate() {
    if (!imageFile) {
      setError("Drop in a calendar screenshot first");
      return;
    }
    if (!blurb.trim()) {
      setError("Tell me what you need to do today");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const { data, mime_type } = await fileToBase64(imageFile);
      const plan = await generatePlan({
        image_base64: data,
        mime_type,
        blurb: blurb.trim(),
        working_hours_start: workingStart,
        working_hours_end: workingEnd,
        target_date: targetDate,
        timezone,
      });
      storage.setTasks(plan.tasks);
      navigate("/review");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New plan</h1>
        <p className="text-[var(--muted-foreground)] mt-1">
          Calendar screenshot in, time-blocked task list out.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Calendar screenshot</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "relative rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer",
              dragOver
                ? "border-[var(--primary)] bg-[var(--accent)]"
                : "border-[var(--border)] hover:border-[var(--ring)]",
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {imagePreview ? (
              <div className="flex items-start gap-4">
                <img
                  src={imagePreview}
                  alt="Calendar screenshot"
                  className="max-h-72 rounded-lg border border-[var(--border)]"
                />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                    <ImageIcon className="size-4" />
                    {imageFile?.name || "pasted image"}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImageFile(null);
                    }}
                  >
                    <X className="size-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 text-center py-6">
                <Upload className="size-8 text-[var(--muted-foreground)]" />
                <div className="text-sm">
                  Drop a screenshot, paste from clipboard, or click to browse
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  PNG, JPG, WebP — Outlook, Google Calendar, anything readable
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. What you need to do</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={
              "Need to finish the OCI scope doc, call Harry's producer about the May ep, gym at lunch, school pickup 3pm, draft MOC newsletter section on RBA..."
            }
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            className="min-h-32"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Working hours and date</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                Start
              </label>
              <Input
                type="time"
                value={workingStart}
                onChange={(e) => setWorkingStart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                End
              </label>
              <Input
                type="time"
                value={workingEnd}
                onChange={(e) => setWorkingEnd(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                Target date
              </label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>
          </div>
          <div className="text-xs text-[var(--muted-foreground)] mt-3">
            Timezone: {timezone}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--destructive)]">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="lg" onClick={handleGenerate} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Thinking...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate plan
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
