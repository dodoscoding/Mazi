import { useEffect, useRef } from "react";
import { mountLabelEditor } from "./labelEditor";
export default function PhotoLabels({
  group,
  asset,
  close,
}: {
  group: string;
  asset: string;
  close: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      mountLabelEditor(host.current!, {
        group,
        assets: [asset],
        onClose: close,
        onSaved: () => window.dispatchEvent(new Event("mazi:archive-changed")),
      }),
    [group, asset],
  );
  return <div ref={host} />;
}
