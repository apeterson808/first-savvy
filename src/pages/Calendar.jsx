import { Card, CardContent } from "@/components/ui/card";
import { Calendar as CalendarIcon, Sparkles } from "lucide-react";

export default function Calendar() {
  return (
    <div className="h-full w-full flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-2 shadow-lg">
        <CardContent className="flex flex-col items-center justify-center py-16 px-8 text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-emerald-500/20 rounded-full blur-2xl" />
            <div className="relative bg-gradient-to-br from-blue-500 to-emerald-500 p-6 rounded-2xl">
              <CalendarIcon className="h-16 w-16 text-white" strokeWidth={1.5} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-3xl font-semibold tracking-tight">Calendar</h2>
              <Sparkles className="h-5 w-5 text-yellow-500" />
            </div>
            <p className="text-lg text-muted-foreground max-w-md">
              Financial calendar with upcoming bills, recurring transactions, and payment reminders
            </p>
          </div>

          <div className="pt-4">
            <span className="inline-flex items-center rounded-full bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Coming Soon
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
