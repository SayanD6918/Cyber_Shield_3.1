import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, FileImage, LoaderCircle, Upload } from "lucide-react";
import { toast } from "sonner";
import { DecisionBadge } from "@/components/decision-badge";
import { RiskRing } from "@/components/risk-ring";
import { ScanChecks } from "@/components/scan-checks";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { analyzeDocument } from "@/lib/analyze-document";
import { prepareDocumentImage } from "@/lib/document-image";
import { formatCaseTime, maskDocumentNumber, titleCaseDocType } from "@/lib/format";
import { useAppStore } from "@/lib/store";
import type { CaseRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/verify")({
  component: VerifyPage,
});

const STEPS = [
  "Preprocessing document image",
  "Extracting visible text",
  "Checking document integrity",
  "Comparing identity features",
  "Writing an explainable risk score",
];

function VerifyPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const addCase = useAppStore((s) => s.addCase);
  const cases = useAppStore((s) => s.cases);
  const watchlist = useAppStore((s) => s.watchlist);
  const autoHold = useAppStore((s) => s.settings.autoHoldWatchlist);
  const hydrated = useAppStore((s) => s.hydrated);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [step, setStep] = useState(0);
  const [latest, setLatest] = useState<CaseRecord | null>(null);
  const [simulated, setSimulated] = useState(false);

  const displayed = latest ?? cases[0] ?? null;

  async function acceptFile(file: File) {
    try {
      const prepared = await prepareDocumentImage(file);
      setFileName(prepared.fileName);
      setPreview(prepared.previewUrl);
      setPayload(prepared.dataUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read that file.");
    }
  }

  async function runScan() {
    if (!payload || !fileName) {
      toast.error("Drop a document image first.");
      return;
    }
    setScanning(true);
    setStep(0);
    const timer = window.setInterval(() => {
      setStep((current) => Math.min(STEPS.length - 1, current + 1));
    }, 700);
    try {
      const result = await analyzeDocument({
        data: {
          imageDataUrl: payload,
          fileName,
          watchlistNames: watchlist.map((item) => item.name),
          autoHoldWatchlist: autoHold,
        },
      });
      const created = addCase({
        ...result.record,
        createdAt: new Date().toISOString(),
      });
      setLatest(created);
      setSimulated(result.simulated);
      toast.success(`Case ${created.id} filed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Scan failed. Try another image.");
    } finally {
      window.clearInterval(timer);
      setScanning(false);
      setStep(STEPS.length);
    }
  }

  const progress = scanning
    ? Math.round(((step + 1) / STEPS.length) * 90)
    : latest && step >= STEPS.length
      ? 100
      : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Verify document</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Scan a travel document to begin an AI-assisted identity check. Results are for training
          and demonstration only.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Document intake</CardTitle>
            <CardDescription>PNG or JPG · maximum 10 MB · one page at a time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                const file = event.dataTransfer.files[0];
                if (file) void acceptFile(file);
              }}
              className={cn(
                "rounded-xl bg-muted px-6 py-10 text-center shadow-panel transition-[box-shadow,background-color] duration-150",
                dragging && "shadow-panel-hover bg-accent",
              )}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Selected travel document"
                  className="mx-auto max-h-48 rounded-lg object-contain outline outline-1 -outline-offset-1 outline-foreground/10"
                />
              ) : (
                <div className="mx-auto grid size-12 place-items-center rounded-lg bg-secondary text-primary">
                  <Upload className="size-5" />
                </div>
              )}
              <p className="mt-4 text-sm font-medium">
                {fileName ?? "Drop passport, visa, or permit here"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Visible biodata page works best. PDFs are not accepted.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-5"
                onClick={() => inputRef.current?.click()}
              >
                <FileImage />
                Browse files
              </Button>
              <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void acceptFile(file);
                }}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="flex-1" onClick={() => void runScan()} disabled={scanning}>
                {scanning ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
                {scanning ? "Analyzing document" : "Run verification scan"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={scanning || (!fileName && !preview)}
                onClick={() => {
                  setFileName(null);
                  setPreview(null);
                  setPayload(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                Clear
              </Button>
            </div>

            {scanning || progress > 0 ? (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-center text-xs text-primary">
                  {scanning ? STEPS[step] : "Verification complete"}
                </p>
              </div>
            ) : null}

            <p className="rounded-lg border-l-2 border-warning bg-warning/10 px-3 py-2.5 text-xs text-warning">
              Prototype mode: never use these scores for a real identity or border decision.
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Latest scan</CardTitle>
            <CardDescription>
              {displayed
                ? `${displayed.id}${hydrated ? ` · ${formatCaseTime(displayed.createdAt)}` : ""}`
                : "No scan on this desk yet"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {displayed ? (
              <div className="space-y-5">
                <ScanChecks checks={displayed.checks} />
                <div className="flex items-center gap-4">
                  <RiskRing score={displayed.riskScore} decision={displayed.decision} />
                  <div>
                    <DecisionBadge decision={displayed.decision} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Risk score · {displayed.riskScore} / 100
                    </p>
                    <p className="mt-2 text-sm">
                      {titleCaseDocType(displayed.documentType)} ·{" "}
                      {maskDocumentNumber(displayed.documentNumber)}
                    </p>
                    {displayed.holderName ? (
                      <p className="mt-1 text-sm text-muted-foreground">{displayed.holderName}</p>
                    ) : null}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{displayed.rationale}</p>
                {simulated ? (
                  <p className="text-xs text-warning">
                    AI service fell back to a simulated result for this file.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Run a scan to populate OCR, expiry, tamper, and face-match checks.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
