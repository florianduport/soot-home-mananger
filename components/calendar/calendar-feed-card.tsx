import { CalendarFeedCopyButton } from "@/components/calendar/calendar-feed-copy-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CalendarFeedCard({
  feedUrl,
  title,
  description,
  privacyNote,
  copyLabel,
  copiedLabel,
  regenerateLabel,
  regenerateAction,
}: {
  feedUrl: string;
  title: string;
  description: string;
  privacyNote: string;
  copyLabel: string;
  copiedLabel: string;
  regenerateLabel: string;
  regenerateAction: () => Promise<void>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input readOnly value={feedUrl} aria-label={title} />
        <p className="text-xs text-muted-foreground">{privacyNote}</p>
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        <CalendarFeedCopyButton
          url={feedUrl}
          labelCopy={copyLabel}
          labelCopied={copiedLabel}
        />
        <form action={regenerateAction}>
          <Button type="submit" variant="secondary">
            {regenerateLabel}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
