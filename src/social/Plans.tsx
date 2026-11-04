import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Sheet } from "../ui/Sheet";
import { PlanForm } from "./PlanForm";
import { planDate, wallTime } from "./time";
import { attendanceLabels, emptyDraft, planDraft } from "./types";
import type { Attendance, Draft, Plan, PlanPage } from "./types";
import "./plans.css";

type Content =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "denied" }
  | { kind: "list"; page: PlanPage }
  | { kind: "detail"; plan: Plan };
type Command = { path: string; body: Record<string, unknown> };
class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const base = "/circle?section=plans";
const planLink = (group: string, plan: string) =>
  base + "&" + new URLSearchParams({ group, plan });
function message(error: unknown) {
  if (error instanceof ApiError && error.status === 400) {
    if (error.message.includes("does not exist"))
      return "Bu yerel saat bulunmuyor. Başka bir saat seç.";
    if (
      error.message.includes("occurs twice") ||
      error.message.includes("UTC offset")
    )
      return "Bu saat için geçerli UTC farkını seç.";
    if (error.message.includes("end must follow"))
      return "Bitiş başlangıçtan sonra olmalı.";
    return "Bilgileri kontrol et. Başlık, tarih, saat dilimi ve anı bağlantısı geçerli olmalı.";
  }
  return "Bağlantı kurulamadı. Tekrar deneyebilirsin.";
}
export default function Plans({
  group,
  search,
  demo,
  navigate,
}: {
  group: string;
  search: string;
  demo: boolean;
  navigate: (url: string, animate?: boolean, replace?: boolean) => void;
}) {
  const params = new URLSearchParams(search);
  const identity = params.get("plan") || "";
  const creating = params.get("new") === "1";
  const scope = params.get("scope") === "all" ? "all" : "upcoming";
  const wrongGroup = !!params.get("group") && params.get("group") !== group;
  const [content, setContent] = useState<Content>({ kind: "loading" });
  const [draft, setDraft] = useState<Draft | null>(
    creating ? { ...emptyDraft } : null,
  );
  const [notice, setNotice] = useState("");
  const [conflict, setConflict] = useState(false);
  const [retry, setRetry] = useState<Command | null>(null);
  const [pending, setPending] = useState(false);
  const [reading, setReading] = useState(false);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const controller = useRef(new AbortController());
  const generation = useRef(0);
  const writing = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const active = () => !controller.current.signal.aborted;
  async function request(path: string, body?: object) {
    const signal = controller.current.signal;
    const response = await fetch(path, {
      signal,
      cache: "no-store",
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    const value = await response.json();
    if (signal.aborted) throw new DOMException("Disposed", "AbortError");
    if (!response.ok)
      throw new ApiError(response.status, value.error || "Request failed");
    return value;
  }
  function denied() {
    controller.current.abort();
    generation.current++;
    setPending(false);
    setReading(false);
    setContent({ kind: "denied" });
    setDraft(null);
    setRetry(null);
    setConfirm(null);
    setNotice("");
  }
  function handleError(error: unknown) {
    if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
      denied();
      if (error.status === 401)
        window.dispatchEvent(new Event("mazi:access-lost"));
      return true;
    }
    return false;
  }
  async function load(cursor?: string) {
    if (demo || wrongGroup || writing.current || !active()) return;
    const version = ++generation.current;
    setReading(true);
    try {
      const query = new URLSearchParams({
        group,
        ...(identity
          ? { plan: identity }
          : { scope, limit: "20", ...(cursor ? { cursor } : {}) }),
      });
      const value = await request(
        "/api/social/" + (identity ? "plan" : "plans") + "?" + query,
      );
      if (!active() || version !== generation.current) return;
      setContent((previous) =>
        identity
          ? { kind: "detail", plan: value as Plan }
          : {
              kind: "list",
              page: {
                ...value,
                items:
                  cursor && previous.kind === "list"
                    ? [...previous.page.items, ...value.items]
                    : value.items,
              },
            },
      );
    } catch (error) {
      if (!active() || version !== generation.current || handleError(error))
        return;
      if (cursor)
        setNotice(
          "Diğer planlar yüklenemedi. Aynı sayfayı yeniden deneyebilirsin.",
        );
      else setContent({ kind: "error", message: message(error) });
    } finally {
      if (active() && version === generation.current) setReading(false);
    }
  }
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    controller.current = new AbortController();
    if (wrongGroup) denied();
    else if (!demo && !creating) void load();
    else setContent({ kind: "list", page: { items: [], next_cursor: null } });
    const clear = denied;
    const refresh = () => {
      if (!document.hidden && !creating) void load();
    };
    window.addEventListener("mazi:group", clear);
    window.addEventListener("mazi:session", clear);
    window.addEventListener("mazi:access-lost", clear);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.current.abort();
      generation.current++;
      window.removeEventListener("mazi:group", clear);
      window.removeEventListener("mazi:session", clear);
      window.removeEventListener("mazi:access-lost", clear);
      window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  async function execute(command: Command) {
    if (demo || wrongGroup || writing.current || !active()) return;
    writing.current = true;
    setPending(true);
    setNotice("");
    setConflict(false);
    setConfirm(null);
    try {
      const value = await request(command.path, command.body);
      if (!active()) return;
      generation.current++;
      setReading(false);
      setRetry(null);
      setDraft(null);
      if (value.deleted) {
        navigate(base, false, true);
        return;
      }
      setContent({ kind: "detail", plan: value });
      if (creating) navigate(planLink(group, value.id), false, true);
      else setNotice("Kaydedildi.");
    } catch (error) {
      if (!active() || handleError(error)) return;
      if (error instanceof ApiError && error.status === 409) {
        setRetry(null);
        setConflict(true);
        setNotice("Plan değişti. Güncel planı yükle ve taslağını karşılaştır.");
      } else if (error instanceof ApiError && error.status === 400) {
        setRetry(null);
        setNotice(message(error));
      } else {
        setRetry(command);
        setNotice(
          "İşlemin sonucu doğrulanamadı. Aynı işlemi yeniden dene; taslağın burada duruyor.",
        );
      }
    } finally {
      writing.current = false;
      if (active()) setPending(false);
    }
  }
  const command = (path: string, body: Record<string, unknown>) =>
    execute({
      path: "/api/social/" + path,
      body: { ...body, group, request_key: crypto.randomUUID() },
    });
  const plan = content.kind === "detail" ? content.plan : null;
  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || retry) return;
    const start = wallTime(draft.start_local, draft.timezone),
      end = wallTime(draft.end_local, draft.timezone);
    if (start.kind !== "valid" || (draft.end_local && end.kind !== "valid")) {
      setNotice("Geçerli bir yerel tarih ve saat dilimi seç.");
      return;
    }
    const rawMemory = draft.memory.trim();
    const memory = rawMemory.includes("/memory/")
      ? rawMemory.split("/memory/")[1].split(/[?#]/)[0]
      : rawMemory;
    const fields = {
      ...draft,
      memory: memory || null,
      start_offset: draft.start_offset || undefined,
      end_local: draft.end_local || null,
      end_offset: draft.end_local ? draft.end_offset || undefined : undefined,
    };
    if (plan)
      void command("plans/update", {
        plan: plan.id,
        revision: plan.revision,
        patch: fields,
      });
    else void command("plans/create", fields);
  }
  const blocked = pending || !!retry;
  const header = (
    <header className="landing-heading">
      <div>
        <a className="landing-text-link" href="#/circle">
          Grubumuz
        </a>
        <h1 ref={heading} tabIndex={-1}>
          Planlar
        </h1>
        <p>Birlikte geçireceğimiz zamana yer açalım.</p>
      </div>
      {!creating && !draft && !demo && content.kind !== "denied" ? (
        <a className="button button--primary" href={`#${base}&new=1`}>
          Buluşma planla
        </a>
      ) : null}
    </header>
  );
  if (demo)
    return (
      <section className="plans-page">
        {header}
        <div className="landing-status">
          <h2>Planlar grubunuza özel</h2>
          <p>
            Örnek arşivde plan oluşturulmaz. Kendi grubunda fotoğraf eklemeden
            de bir buluşma planlayabilirsin.
          </p>
        </div>
      </section>
    );
  return (
    <section className="plans-page">
      {header}
      {notice ? (
        <div className="plan-notice" role="status">
          <p>{notice}</p>
          {retry ? (
            <button
              className="button button--secondary"
              disabled={pending}
              onClick={() => void execute(retry)}
            >
              Aynı işlemi yeniden dene
            </button>
          ) : null}
          {conflict ? (
            <button
              className="button button--secondary"
              disabled={reading || pending}
              onClick={() => void load()}
            >
              Güncel planı yükle
            </button>
          ) : null}
        </div>
      ) : null}
      {pending ? <p role="status">Kaydediliyor…</p> : null}
      {content.kind === "denied" ? (
        <div className="landing-status" role="alert">
          <h2>Bu plan kullanılamıyor</h2>
          <p>
            Plan bu gruba ait değil veya erişimin değişti. Grubumuz'a dönüp
            güncel planları aç.
          </p>
          <a className="landing-text-link" href="#/circle">
            Grubumuza dön
          </a>
        </div>
      ) : content.kind === "loading" ? (
        <p role="status">Planlar yükleniyor…</p>
      ) : content.kind === "error" ? (
        <div className="landing-status" role="alert">
          <h2>Planlar yüklenemedi</h2>
          <p>{content.message}</p>
          <button
            className="button button--secondary"
            onClick={() => void load()}
          >
            Yeniden yükle
          </button>
        </div>
      ) : (
        <>
          {draft ? (
            <section aria-labelledby="plan-form-heading">
              <h2 id="plan-form-heading">
                {plan ? "Buluşmayı düzenle" : "Buluşma planla"}
              </h2>
              <PlanForm
                draft={draft}
                onChange={setDraft}
                onSubmit={save}
                disabled={blocked}
                editing={!!plan}
                onCancel={() => (plan ? setDraft(null) : navigate(base))}
              />
            </section>
          ) : null}
          {content.kind === "list" && !draft ? (
            <>
              <nav className="plan-tabs" aria-label="Plan görünümü">
                <a
                  href={`#${base}`}
                  aria-current={scope === "upcoming" ? "page" : undefined}
                >
                  Yaklaşan
                </a>
                <a
                  href={`#${base}&scope=all`}
                  aria-current={scope === "all" ? "page" : undefined}
                >
                  Tüm planlar
                </a>
              </nav>
              {content.page.items.length ? (
                <ul className="plan-list">
                  {content.page.items.map((item) => (
                    <li key={item.id}>
                      <a href={`#${planLink(group, item.id)}`}>
                        <span className="plan-when">{planDate(item)}</span>
                        <h2>{item.title}</h2>
                        <span>{item.place || "Yer henüz belirlenmedi"}</span>
                        <span className="plan-hint">
                          {item.status === "cancelled"
                            ? "İptal edildi"
                            : `${item.attendance.yes} kişi geliyor`}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="landing-status">
                  <h2>
                    {scope === "all"
                      ? "Henüz bir plan yok"
                      : "Yaklaşan bir buluşma yok"}
                  </h2>
                  <p>İlk buluşmayı fotoğraf eklemeden de planlayabilirsin.</p>
                </div>
              )}
              {content.page.next_cursor ? (
                <button
                  className="button button--secondary"
                  disabled={reading}
                  onClick={() => void load(content.page.next_cursor!)}
                >
                  {reading ? "Yükleniyor…" : "Diğer planlar"}
                </button>
              ) : null}
            </>
          ) : null}
          {plan ? (
            <article className="plan-detail">
              <a className="landing-text-link" href={`#${base}`}>
                Tüm planlara dön
              </a>
              {draft ? <p className="plan-hint">Kaydedilmiş plan</p> : null}
              <p className="plan-when">{planDate(plan)}</p>
              <h2>{plan.title}</h2>
              <p className="plan-hint">
                {plan.timezone} · UTC{plan.start_offset}
              </p>
              {plan.end_local ? (
                <p>
                  Bitiş: {plan.end_local.replace("T", " ").slice(0, 16)} · UTC
                  {plan.end_offset}
                </p>
              ) : null}
              <p>{plan.place || "Yer henüz belirlenmedi"}</p>
              {plan.description ? (
                <p className="plan-description">{plan.description}</p>
              ) : null}
              <p className="plan-hint">Düzenleyen: {plan.organizer.name}</p>
              {plan.memory ? (
                <a
                  className="landing-text-link"
                  href={`#/memory/${encodeURIComponent(plan.memory.id)}`}
                >
                  {plan.memory.title}
                </a>
              ) : null}
              <section aria-labelledby="attendance-heading">
                <h3 id="attendance-heading">
                  {plan.status === "cancelled"
                    ? "Buluşma iptal edildi"
                    : "Sen de geliyor musun?"}
                </h3>
                <div className="plan-actions">
                  {(Object.keys(attendanceLabels) as Attendance[]).map(
                    (state) => (
                      <button
                        key={state}
                        className="button button--secondary"
                        disabled={blocked || plan.status === "cancelled"}
                        aria-pressed={plan.attendance.mine === state}
                        onClick={() =>
                          void command("attendance", { plan: plan.id, state })
                        }
                      >
                        {attendanceLabels[state]}{" "}
                        <span>{plan.attendance[state]}</span>
                      </button>
                    ),
                  )}
                  {plan.attendance.mine ? (
                    <button
                      className="button button--secondary"
                      disabled={blocked || plan.status === "cancelled"}
                      onClick={() =>
                        void command("attendance", {
                          plan: plan.id,
                          state: null,
                        })
                      }
                    >
                      Yanıtımı kaldır
                    </button>
                  ) : null}
                </div>
                {plan.participants.length ? (
                  <ul
                    className="plan-participants"
                    aria-label="Katılım yanıtları"
                  >
                    {plan.participants.map((person) => (
                      <li key={person.id}>
                        <span>{person.name}</span>
                        <span>{attendanceLabels[person.state]}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="plan-hint">Henüz kimse yanıt vermedi.</p>
                )}
              </section>
              <div className="plan-actions">
                <button
                  className="button button--secondary"
                  disabled={pending || reading}
                  onClick={() => void load()}
                >
                  Planı yenile
                </button>
                {plan.editable && !draft ? (
                  <>
                    {plan.status === "active" ? (
                      <>
                        <button
                          className="button button--secondary"
                          disabled={blocked}
                          onClick={() => setDraft(planDraft(plan))}
                        >
                          Düzenle
                        </button>
                        <button
                          className="button button--secondary"
                          disabled={blocked}
                          onClick={() => setConfirm("cancel")}
                        >
                          Buluşmayı iptal et
                        </button>
                      </>
                    ) : null}
                    <button
                      className="button button--secondary"
                      disabled={blocked}
                      onClick={() => setConfirm("delete")}
                    >
                      Buluşmayı sil
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ) : null}
        </>
      )}
      <Sheet
        closeLabel="Kapat"
        open={!!confirm}
        onClose={() => setConfirm(null)}
        label={confirm === "delete" ? "Buluşmayı sil" : "Buluşmayı iptal et"}
      >
        <h2>
          {confirm === "delete"
            ? "Buluşma silinsin mi?"
            : "Buluşma iptal edilsin mi?"}
        </h2>
        <p>
          {confirm === "delete"
            ? "Plan ve bağlı katılım yanıtları silinir."
            : "Plan listede kalır; yeni katılım yanıtları kapanır."}
        </p>
        <div className="plan-actions">
          <button
            className="button button--secondary"
            onClick={() => setConfirm(null)}
          >
            Vazgeç
          </button>
          <button
            className="button button--primary"
            onClick={() => {
              if (plan && confirm)
                void command("plans/" + confirm, {
                  plan: plan.id,
                  revision: plan.revision,
                });
            }}
          >
            {confirm === "delete" ? "Buluşmayı sil" : "Buluşmayı iptal et"}
          </button>
        </div>
      </Sheet>
    </section>
  );
}
