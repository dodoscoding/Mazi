import type { RefObject } from "react";
import type { Memory } from "./memories";
import type { LinkFor } from "./useRoute";
import { DemoSearch } from "./browse/DemoSearch";
import { Timeline } from "./browse/Timeline";
import "./styles/browse.css";

export function Browse({
  isSearch,
  memories,
  demo,
  query,
  setQuery,
  link,
  heading,
}: {
  isSearch: boolean;
  memories: Memory[];
  demo: boolean;
  query: string;
  setQuery: (query: string) => void;
  link: LinkFor;
  heading: RefObject<HTMLHeadingElement | null>;
}) {
  return isSearch ? (
    <DemoSearch
      memories={memories}
      demo={demo}
      query={query}
      setQuery={setQuery}
      link={link}
      heading={heading}
    />
  ) : (
    <Timeline memories={memories} link={link} heading={heading} />
  );
}
