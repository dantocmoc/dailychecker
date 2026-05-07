import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function Wrap() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Wrap</h1>
      <Card>
        <CardHeader>
          <CardTitle>End of day</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-[var(--muted-foreground)]">
          Step 11. Confetti, stats, level progress, badge reveals.
        </CardContent>
      </Card>
    </div>
  );
}
