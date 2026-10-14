import type { Memory } from "../memories";

export function MemoryMeta({ memory }: { memory: Memory }) {
  return (
    <p className="memory-meta">
      <span>{memory.date}</span>
      <span>
        {memory.photos.length} {memory.photos.length === 1 ? "photo" : "photos"}
      </span>
      <span>
        {memory.source ? "Shared with your circle" : `Added by ${memory.by}`}
      </span>
    </p>
  );
}
