import { useState } from "react";
import { Brain, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, HelpCircle, Activity, Stethoscope, Sparkles, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateMedicalReasoning } from "@/lib/medicalReasoning";
import { cn } from "@/lib/utils";

export function MedicalReasoningCard({ values, summary, className }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const reasoning = generateMedicalReasoning(values, summary);
  if (!reasoning || !reasoning.step1.observations.length) {
    return null;
  }

  const handleCopyQuestions = () => {
    const text = reasoning.step4.questions.map((q, i) => `${i + 1}. ${q}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Physician questions copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className={cn("freud-card rounded-3xl border-indigo-500/30 overflow-hidden shadow-xl", className)}>
      <CardHeader className="p-6 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-card flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md freud-glow-indigo">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg font-bold text-foreground">Clinical Medical Reasoning Chain</CardTitle>
              <Badge className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-500/30 text-[10px] uppercase font-bold tracking-wider">
                4-Step Reasoning Engine
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Structured clinical rationale, biological mechanisms, and physician consultation questions.
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="border-border bg-card text-foreground hover:bg-muted rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0"
        >
          {expanded ? (
            <>Hide Reasoning <ChevronUp className="h-4 w-4" /></>
          ) : (
            <>View Reasoning <ChevronDown className="h-4 w-4" /></>
          )}
        </Button>
      </CardHeader>

      {expanded && (
        <CardContent className="p-6 space-y-6 border-t border-border/60 bg-card/40 animate-in fade-in duration-200">
          {/* Step 1: Observation & Triaging */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <Activity className="h-4 w-4" /> {reasoning.step1.title}
            </h4>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {reasoning.step1.observations.map((obs, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3 text-xs">
                  <span className="font-bold text-foreground">{obs.marker}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-mono">{obs.value}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "capitalize text-[10px] font-bold px-2 py-0.5 rounded-full border",
                        obs.status === "normal"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      )}
                    >
                      {obs.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 2: Pathophysiological Mechanisms */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <Stethoscope className="h-4 w-4" /> {reasoning.step2.title}
            </h4>
            <div className="space-y-3">
              {reasoning.step2.patterns.map((p, i) => (
                <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-1.5 shadow-xs">
                  <div className="font-bold text-xs text-foreground flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-500 inline-block"></span>
                    {p.pattern}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.description}</p>
                  <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-xl inline-block mt-1">
                    💡 Clinical Correlation: {p.clinicalNote}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Step 3: Differential Considerations */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> {reasoning.step3.title}
            </h4>
            <div className="space-y-2">
              {reasoning.step3.differentials.map((d, i) => (
                <div key={i} className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/30 p-3 text-xs">
                  <HelpCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-foreground">{d.finding}</div>
                    <div className="text-muted-foreground mt-0.5">{d.explanation}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step 4: Clinical Action Plan & Physician Questions */}
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" /> {reasoning.step4.title}
              </h4>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyQuestions}
                className="text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/10 rounded-xl flex items-center gap-1.5 h-8"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                Copy Questions for Doctor
              </Button>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="text-xs font-bold text-foreground">Suggested Questions for Your Physician:</div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                {reasoning.step4.questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
                      {i + 1}
                    </span>
                    <span className="font-medium text-foreground">{q}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
