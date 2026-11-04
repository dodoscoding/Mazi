import type { IconName } from "./ui/icons";

export type MainSection = "home" | "explore" | "circle";
type Destination = {
  path: string;
  label: string;
  description: string;
};
type ExploreDestination = Destination & {
  group: "find" | "browse" | "remember";
};
type PrimaryDestination = {
  section: MainSection;
  path: string;
  label: string;
  icon: IconName;
};

export const primaryDestinations: readonly PrimaryDestination[] = [
  { section: "home", path: "/", label: "Ana sayfa", icon: "home" },
  { section: "explore", path: "/explore", label: "Keşfet", icon: "search" },
  { section: "circle", path: "/circle", label: "Grubumuz", icon: "people" },
];

export const exploreDestinations: readonly ExploreDestination[] = [
  {
    path: "/search",
    group: "find",
    label: "Anı ara",
    description: "Bir kelime, kişi, yer veya kaynakla arşivde ara.",
  },
  {
    path: "/atlas",
    group: "browse",
    label: "Atlas",
    description: "Anıları küre ve harita üzerinde gez. Yılları yeniden yaşa.",
  },
  {
    path: "/timeline",
    group: "browse",
    label: "Zaman çizelgesi",
    description: "Tarihlere göre ilerle; tarihi bilinmeyen anıları da bul.",
  },
  {
    path: "/memories",
    group: "find",
    label: "Fotoğraflar",
    description: "Tüm fotoğrafları anı, yer, kaynak ve yıla göre süz.",
  },
  {
    path: "/discover?section=people",
    group: "find",
    label: "Kişiler",
    description:
      "Kişi kayıtlarını, onaylanmış etiketleri ve kimlik bağlantılarını yönet.",
  },
  {
    path: "/discover",
    group: "remember",
    label: "Yeniden keşfet",
    description:
      "Arşivin sunduğu hatırlatma önerileriyle yeni bir başlangıç yap.",
  },
  {
    path: "/memories?section=stories",
    group: "remember",
    label: "Hikâyeler",
    description: "Ortak anılardaki notları oku ve kendi hatırladıklarını ekle.",
  },
  {
    path: "/memories?section=recap",
    group: "remember",
    label: "Yıllık özet",
    description: "Bir yılın anılarına dön ve birlikte bir hikâye başlat.",
  },
  {
    path: "/memories?section=capsules",
    group: "remember",
    label: "Zaman kapsülleri",
    description: "Gelecekte açılacak bir not ve fotoğraf bırak.",
  },
  {
    path: "/ask",
    group: "remember",
    label: "Arşive sor",
    description:
      "Kaynakları gösteren yanıtlarla geçmişi hatırla. İsteğe bağlı işlemeyi yönet.",
  },
  {
    path: "/places",
    group: "browse",
    label: "Yerler",
    description:
      "Fotoğrafların paylaşılan yerlerini harita veya liste üzerinde incele.",
  },
  {
    path: "/review",
    group: "browse",
    label: "Düzelt ve düzenle",
    description:
      "Tarihleri, yerleri, tekrarları ve önerilen anı gruplarını gözden geçir.",
  },
];

export const exploreGroups = [
  { id: "find", label: "Bul", description: "Bir fotoğrafı veya kişiyi bul." },
  { id: "browse", label: "Gez", description: "Bir zamana veya yere dön." },
  {
    id: "remember",
    label: "Birlikte hatırla",
    description: "Notları, hikâyeleri ve hatırlatma araçlarını aç.",
  },
] as const;

export const routeAliases: Readonly<Record<string, string>> = {
  "/people": "/discover?section=people",
  "/settings": "/circle?section=settings",
};

export const groupDestinations: readonly Destination[] = [
  {
    path: "/circle?section=plans",
    label: "Planlar",
    description:
      "Bir buluşma planla, katılımını bildir ve grubunla bir araya gel.",
  },
  {
    path: "/imports",
    label: "İçe aktarmalar",
    description: "Fotoğraf ekle, arşiv aktar ve aktarma geçmişini gör.",
  },
  {
    path: "/places?section=sources",
    label: "Kaynak bağlantıları",
    description: "Apple Photos ve Discord bağlantılarını yönet.",
  },
  {
    path: "/review",
    label: "Düzelt ve düzenle",
    description:
      "Paylaşılan arşivdeki tarihleri, yerleri ve gruplamaları düzelt.",
  },
  {
    path: "/about",
    label: "Yardım ve gizlilik",
    description: "Gizlilik, hesap ve uygulama bilgilerini aç.",
  },
  {
    path: "/introduction",
    label: "Tanıtımı izle",
    description: "Mazi'nin kısa tanıtımını yeniden izle.",
  },
];

const sectionPaths: Record<string, MainSection> = {
  "/": "home",
  "/explore": "explore",
  "/atlas": "explore",
  "/timeline": "explore",
  "/search": "explore",
  "/discover": "explore",
  "/memories": "explore",
  "/ask": "explore",
  "/answer-evidence": "explore",
  "/places": "explore",
  "/review": "explore",
  "/circle": "circle",
  "/imports": "circle",
  "/about": "circle",
  "/introduction": "circle",
};
export function sectionFor(url: string): MainSection | undefined {
  const [path, query] = url.split("?");
  if (
    path === "/places" &&
    new URLSearchParams(query).get("section") === "sources"
  )
    return "circle";
  return path.startsWith("/memory/") ? "explore" : sectionPaths[path];
}
