export type Attendance = "yes" | "maybe" | "no";
export type Plan = {
  id: string;
  title: string;
  revision: number;
  status: "active" | "cancelled";
  start_local: string;
  start_offset: string;
  starts_at: string;
  timezone: string;
  end_local: string | null;
  end_offset: string | null;
  ends_at: string | null;
  place: string;
  description: string;
  editable: boolean;
  organizer: { id: string; name: string };
  attendance: {
    yes: number;
    maybe: number;
    no: number;
    mine: Attendance | null;
    revision: number;
  };
  participants: { id: string; name: string; state: Attendance }[];
  memory: { id: string; title: string } | null;
};
export type PlanPage = { items: Plan[]; next_cursor: string | null };
export type Draft = Record<
  | "title"
  | "start_local"
  | "start_offset"
  | "end_local"
  | "end_offset"
  | "timezone"
  | "place"
  | "description"
  | "memory",
  string
>;
export const emptyDraft: Draft = {
  title: "",
  start_local: "",
  start_offset: "",
  end_local: "",
  end_offset: "",
  timezone: "",
  place: "",
  description: "",
  memory: "",
};
export function planDraft(plan: Plan): Draft {
  return {
    title: plan.title,
    start_local: plan.start_local,
    start_offset: plan.start_offset,
    end_local: plan.end_local || "",
    end_offset: plan.end_offset || "",
    timezone: plan.timezone,
    place: plan.place,
    description: plan.description,
    memory: plan.memory?.id || "",
  };
}
export const attendanceLabels: Record<Attendance, string> = {
  yes: "Geliyorum",
  maybe: "Belki",
  no: "Gelemiyorum",
};
