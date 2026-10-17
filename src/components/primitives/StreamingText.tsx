export default function StreamingText({
  content,
}: {
  content: { text: string }[];
}) {
  return (
    <p className="w-full whitespace-pre-line text-[13px] leading-[1.9] text-ink">
      {content.map((token, index) => (
        <span key={index}>{token.text}</span>
      ))}
    </p>
  );
}
