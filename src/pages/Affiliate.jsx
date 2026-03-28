import { Card, CardContent } from "@/components/ui/card";
import { Users, Sparkles } from "lucide-react";

export default function Affiliate() {
  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-2 shadow-lg">
        <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-full blur-2xl" />
            <div className="relative bg-gradient-to-br from-violet-500 to-fuchsia-500 p-6 rounded-2xl">
              <Users className="h-16 w-16 text-white" strokeWidth={1.5} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-3xl font-semibold tracking-tight">Affiliate Program</h2>
              <Sparkles className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="text-lg text-muted-foreground max-w-md">
              Earn rewards by sharing FirstSavvy with your friends and network
            </p>
          </div>

          <div className="pt-4">
            <span className="inline-flex items-center rounded-full bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-600 dark:text-violet-400 border border-violet-500/20">
              Coming Soon
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
