import DecodeHeading from "@/components/matrix/DecodeHeading";

/** A decorative shell command above a real h2, e.g. "~$ cat about.txt" then "About". */
export default function SectionHeading({
  id,
  command,
  title,
}: {
  id: string;
  command: string;
  title: string;
}) {
  return (
    <div className="sd-heading mb-6">
      <p className="prompt text-sm" aria-hidden="true">
        {command}
      </p>
      <DecodeHeading id={id} className="text-accent text-glow mt-1 text-2xl font-bold">
        {title}
      </DecodeHeading>
    </div>
  );
}
