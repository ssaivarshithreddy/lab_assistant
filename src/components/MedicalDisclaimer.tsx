import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MedicalDisclaimerProps {
  className?: string;
  variant?: "default" | "critical";
}

export function MedicalDisclaimer({ className, variant = "default" }: MedicalDisclaimerProps) {
  const isCritical = variant === "critical";

  return (
    <Card
      className={cn(
        "border-l-4 p-4",
        isCritical
          ? "border-l-destructive bg-destructive/10"
          : "border-l-warning bg-warning/10",
        className
      )}
    >
      <div className="flex gap-3">
        <AlertTriangle className={cn("h-5 w-5 shrink-0 mt-0.5", isCritical ? "text-destructive" : "text-warning")} />
        <div className="space-y-2 text-sm">
          <div className="font-semibold">
            {isCritical ? "⚠️ Critical Alert" : "📋 Medical Disclaimer"}
          </div>
          <p className="text-foreground/90">
            {isCritical
              ? "This tool detects potentially critical values. Seek immediate medical attention if you have symptoms."
              : "This AI assistant provides educational information only. It is NOT a substitute for professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider before making any medical decisions."}
          </p>
          <p className="text-foreground/80">
            {isCritical
              ? "Do not delay seeking emergency care based on these results."
              : "By using this tool, you acknowledge that you understand the limitations and accept full responsibility for your health decisions."}
          </p>
        </div>
      </div>
    </Card>
  );
}
