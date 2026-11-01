import type { IconName } from "./ui/icons";

export type MainSection = "home" | "explore" | "circle";
type Destination = { path: string; label: string; description: string };
type PrimaryDestination = {
  section: MainSection;
  path: string;
  label: string;
  icon: IconName;
};

export const primaryDestinations: readonly PrimaryDestination[] = [
  { section: "home", path: "/", label: "Home", icon: "home" },
  { section: "explore", path: "/explore", label: "Keşfet", icon: "search" },
  { section: "circle", path: "/circle", label: "Grubumuz", icon: "people" },
];

export const exploreDestinations: readonly Destination[] = [
  {
    path: "/search",
    label: "Anı ara",
    description: "Bir kelime, kişi, yer veya kaynakla arşivde ara.",
  },
  {
    path: "/atlas",
    label: "Atlas",
    description: "Anıları küre ve harita üzerinde gez. Yılları yeniden yaşa.",
  },
  {
    path: "/timeline",
    label: "Zaman çizelgesi",
    description: "Tarihlere göre ilerle; tarihi bilinmeyen anıları da bul.",
  },
  {
    path: "/memories",
    label: "Fotoğraflar",
    description: "Tüm fotoğrafları anı, yer, kaynak ve yıla göre süz.",
  },
  {
    path: "/discover?section=people",
    label: "Kişiler",
    description:
      "Kişi kayıtlarını, onaylanmış etiketleri ve kimlik bağlantılarını yönet.",
  },
  {
    path: "/discover",
    label: "Yeniden keşfet",
    description:
      "Arşivin sunduğu hatırlatma önerileriyle yeni bir başlangıç yap.",
  },
  {
    path: "/memories?section=stories",
    label: "Hikâyeler",
    description: "Ortak anılardaki notları oku ve kendi hatırladıklarını ekle.",
  },
  {
    path: "/memories?section=recap",
    label: "Yıllık özet",
    description: "Bir yılın anılarına dön ve birlikte bir hikâye başlat.",
  },
  {
    path: "/memories?section=capsules",
    label: "Zaman kapsülleri",
    description: "Gelecekte açılacak bir not ve fotoğraf bırak.",
  },
  {
    path: "/ask",
    label: "Arşive sor",
    description:
      "Kaynakları gösteren yanıtlarla geçmişi hatırla. İsteğe bağlı işlemeyi yönet.",
  },
  {
    path: "/places",
    label: "Yerler ve kaynaklar",
    description:
      "Yerleri incele, bağlı kaynakları ve aktarma durumlarını yönet.",
  },
  {
    path: "/review",
    label: "Düzelt ve düzenle",
    description:
      "Tarihleri, yerleri, tekrarları ve önerilen anı gruplarını gözden geçir.",
  },
];

export const groupDestinations: readonly Destination[] = [
  {
    path: "/imports",
    label: "İçe aktarmalar",
    description: "Fotoğraf ekle, arşiv aktar ve aktarma geçmişini gör.",
  },
  {
    path: "/places",
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
export function sectionFor(path: string): MainSection | undefined {
  return path.startsWith("/memory/") ? "explore" : sectionPaths[path];
}
