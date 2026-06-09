import { cn } from "@/lib/cn";
import { initials, colorFromString } from "@/lib/utils";

interface AvatarProps {
  name: string;
  size?: number;
  className?: string;
}

export function Avatar({ name, size = 40, className }: AvatarProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-white/10",
        className
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${colorFromString(name)}, ${colorFromString(
          name + "x"
        )})`,
      }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
