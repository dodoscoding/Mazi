export type PhotoLabels = Partial<
  Record<"people_present" | "screenshot" | "ai", string>
>;
export function labelBadges(labels?: PhotoLabels) {
  return [
    labels?.screenshot === "yes" ? "Ekran görüntüsü" : "",
    labels?.ai === "generated"
      ? "AI üretimi"
      : labels?.ai === "edited"
        ? "AI ile düzenlendi"
        : "",
  ].filter(Boolean);
}
