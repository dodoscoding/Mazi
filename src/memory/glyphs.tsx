import type { ReactNode } from "react";
import { Icon, IconFrame } from "../ui/icons";
import type { IconName } from "../ui/icons";

/** Glyphs the shared icon set lacks, drawn in its 1.6 stroke. */
const paths = {
  photos: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M21 16l-5-5-8 8" />
    </>
  ),
  chat: <path d="M4 20l1.5-4A8 8 0 1112 20a8 8 0 01-4-1z" />,
  discord: <path d="M5 5h14v10H9l-4 4z" />,
  messenger: (
    <path d="M12 4c4.4 0 8 3 8 7s-3.6 7-8 7l-5 2 1-3.5C5.5 15 4 13 4 11c0-4 3.6-7 8-7z" />
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </>
  ),
  "photo-failed": (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 5l18 14" />
    </>
  ),
  "chevron-left": <path d="M15 5l-7 7 7 7" />,
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof paths;

/** Memory glyphs, or any shared icon name, in the shared icon frame. */
export function Glyph({
  name,
  size = 16,
  stroke = 1.6,
}: {
  name: GlyphName | IconName;
  size?: number;
  stroke?: number;
}) {
  if (!(name in paths)) return <Icon name={name as IconName} size={size} />;
  return (
    <IconFrame size={size} strokeWidth={stroke}>
      {paths[name as GlyphName]}
    </IconFrame>
  );
}
