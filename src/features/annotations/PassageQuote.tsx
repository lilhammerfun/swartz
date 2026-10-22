import { Button } from "@/components/ui/button";
import { annotationColorStyle } from "./annotation-colors";

export function PassageQuote({
  quote,
  annotationId,
  onSelect,
}: {
  quote: string;
  annotationId?: string;
  onSelect?: () => void;
}) {
  return (
    <blockquote
      className="annotation-quote space-y-1"
      style={annotationId ? annotationColorStyle(annotationId) : undefined}
    >
      <p className="text-[10px] font-medium text-muted-foreground">
        Quoted passage
      </p>
      {onSelect ? (
        <Button
          variant="link"
          className="h-auto w-full justify-start whitespace-normal p-0 text-left text-xs leading-5 font-normal text-muted-foreground hover:text-foreground hover:no-underline"
          onClick={onSelect}
          aria-label="Go to quoted passage"
          title={quote}
        >
          <span className="line-clamp-2">{quote}</span>
        </Button>
      ) : (
        <p
          className="line-clamp-3 text-xs leading-5 text-muted-foreground"
          title={quote}
        >
          {quote}
        </p>
      )}
    </blockquote>
  );
}
