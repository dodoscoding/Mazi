# Parallel You source blueprint

Preserved owner input from 1 November 2026. The owner pasted two documents: a first concept note and a v1.0 product and technical blueprint written for the hybrid direction. The text is kept as supplied, in Turkish. Image links to external inspiration pages and interactive-widget labels were removed; nothing else was edited. [The Parallel You plan](../PARALLEL_YOU.md) reconciles this blueprint with the Mazi repository. Keep this file unchanged.

## Document 1: concept note

Parallel You — Ya Başka Bir Hayat Yaşasaydın?
İnteraktif alternatif hayat simülatörü · AI + Karar Ağaçları + Görsel Hikâye Anlatımı

Temel fikir: Hayatında verdiğin bir kararı değiştiriyorsun. AI, o karardan sonra yaşayabileceğin alternatif bir hayatı hikâyeleştiriyor.

Ancak uygulama sadece sana hikâye anlatmıyor. Verdiğin her yeni karar başka bir evren oluşturuyor. Böylece kendi hayatının alternatif versiyonlarını keşfedebiliyorsun.

Örneğin: "2022 yılında Danimarka yerine Japonya'da üniversiteye başlasaydım hayatım nasıl olurdu?"

Uygulama sana yeni bir zaman çizelgesi oluşturuyor. Arkadaşlıkların, kariyerin, yaşadığın şehir ve karşılaştığın fırsatlar farklılaşabiliyor.

Önemli nokta: Bu bir gelecek tahmin sistemi değil. AI tarafından üretilen kurgusal, olasılıklardan ilham alan alternatif hayat hikâyeleri.

### 1. Kullanıcı deneyimi nasıl olacak?

- Aşama 1 — Kırılma noktasını seç. Kullanıcı geçmişteki bir kararı giriyor. Örneğin "Üniversiteye gitmek yerine kendi şirketimi kurdum."
- Aşama 2 — Yeni hayatın oluşuyor. AI ilk 6 ay, 1 yıl ve 3 yıl için olaylar oluşturuyor. Bunlar mantıksal açıdan birbiriyle tutarlı, bazen olumlu bazen olumsuz gelişmeler içeriyor.
- Aşama 3 — Alternatif bir karar daha ver. Örneğin şirketin yatırım alıyor. "Büyümeyi dene" veya "Şirketi küçük tut" seçeneklerinden birini seçiyorsun.
- Aşama 4 — Paralel evrenleri karşılaştır. Farklı hayatların kariyer, ilişkiler, maddi durum, özgürlük ve yaşam tarzı gibi kurgusal özelliklerini yan yana görüyorsun.

### 2. Küçük bir interaktif örnek

Diyelim ki 2026 yılında yazılım mühendisisin. Hayatının yönünü değiştirecek bir seçim yapıyorsun.

2026: Kırılma Noktası. İlk kararını seç: Kendi AI şirketimi kuruyorum / Büyük bir teknoloji şirketine giriyorum / Bir yıl boyunca dünyayı geziyorum.

Alternatif evren · 2027: 2027'de iki arkadaşınla küçük bir AI yazılım şirketi kurdun. İlk müşterini buldun, fakat ikinci müşteriye ulaşmak tahmin ettiğinden zor. Birikimlerin azalmaya başladı. Şimdi hangi yolu seçiyorsun? Büyük bir müşteriye odaklan / Küçük bir SaaS ürünü geliştir / Simülasyonu sıfırla.

Gerçek uygulamada bu hikâyeler önceden yazılmış olmak yerine, kullanıcının girdiği kararlara göre AI tarafından oluşturulacak.

### 3. Uygulamanın en etkileyici özelliği: Evren Haritası

Bence projeyi özel yapan şey hikâyeler değil, hayatını Git branch'leri gibi görebilmen.

Her dal farklı bir kurgusal hayatı temsil eder. Bir düğüme tıklayınca o evrenin hikâyesi açılır.

Bir evrenden yeni bir karar verdiğinde mevcut hikâye silinmez. Yeni bir dal oluşur. Böylece aynı başlangıç noktasından farklı sonuçları keşfedebilirsin.

### 4. AI nasıl çalışacak?

Burada önemli bir mühendislik kararı var: AI'ya sadece "alternatif hayat hikâyesi yaz" dememeliyiz. Bu, tekrarlayan ve tutarsız hikâyeler üretir.

Bunun yerine her evren için yapılandırılmış bir kayıt tutacağız:

```json
{
  "year": 2027,
  "location": "Copenhagen",
  "career": "Startup Founder",
  "money": 35,
  "socialLife": 60,
  "happiness": 75,
  "decision": "Start an AI company",
  "events": ["Found first customer", "Struggled with cash flow"]
}
```

Bunlar gerçek hayata ilişkin ölçümler değil, oyunun kurgusal durum değerleri.

Her yeni karar verildiğinde:

1. Önceki evrenin durumu AI'ya gönderilir.
2. AI seçimin olası olumlu ve olumsuz sonuçlarını içeren bir sonraki bölümü üretir.
3. Sonuç, doğrulanan bir JSON şemasına göre alınır.
4. Yeni evren düğümü oluşturulur ve önceki düğüme bağlanır.

Bu yapı sayesinde hikâyeler arasında tutarlılık sağlamak ve daha sonra gelişmiş özellikler eklemek kolaylaşır.

### 5. İki haftalık gerçekçi MVP

- Gün 1–2 — Tasarım ve proje kurulumu: Next.js, Tailwind, React Flow ve temel veri modelleri.
- Gün 3–4 — AI hikâye üretimi: LLM entegrasyonu, yapılandırılmış çıktı, sunucu tarafında API anahtarı güvenliği.
- Gün 5–6 — Evren haritası: Dallanabilen ve tıklanabilen interaktif zaman çizelgesi.
- Gün 7–8 — Karar mekanizması: Yeni seçenek üretme, seçim yapma ve evrenin devamını oluşturma.
- Gün 9–10 — Evrenleri saklama: Yerel kayıt ve kaldığın yerden devam etme.
- Gün 11–12 — Görsel tasarım: Koyu sinematik tema, animasyonlar ve mobil uyumluluk.
- Gün 13–14 — Test ve yayınlama: Hatalı AI yanıtlarını ele alma, uçtan uca testler ve deployment.

İlk sürümü özellikle sınırlı tutardım: metin tabanlı hikâyeler, en fazla üç karar derinliği, tek kullanıcı, basit yerel kayıt ve 2D evren haritası. Böylece iki haftada bitirme şansımız yüksek olur.

### 6. Daha sonra eklenebilecek özellikler

- Universe Comparison: İki farklı hayatın kurgusal kariyer, sosyal yaşam, maddi durum ve mutluluk skorlarını karşılaştırma.
- AI Memory Generator: Alternatif evrenden bir fotoğraf veya anı kartı oluşturma.
- Random Universe: Kullanıcının seçmediği rastgele bir karar üzerinden tamamen beklenmedik bir hikâye oluşturma.
- Life Book: Bir evrenin tüm hikâyesini bölümler halinde dijital bir kitaba dönüştürme.

### Bir tasarım kararı daha var

Bence Parallel You iki farklı yöne gidebilir:

- A — Cinematic Life Simulator. Oyun gibi. Sürpriz olaylar, kurgusal hayat istatistikleri, dramatik kararlar ve farklı sonlar. Daha eğlenceli ve paylaşılabilir.
- B — What If? Daha kişisel ve düşündürücü. Kullanıcı geçmişte verdiği kararları keşfeder, alternatif hikâyeler okur ve hayat tercihleri üzerine düşünür.
- C — İkisinin birleşimi. Sinematik deneyim ve oyun mekanikleri, ama anlamlı hikâyeler ve kişisel kararlarla.

Owner selection: "Bu yönde tasarımı detaylandır. Ben C — Hibrit yaklaşımını seçerdim. Ama oyun tarafını biraz daha güçlü tutardım. Böylece proje sadece bir AI hikâye üreticisi değil, tekrar tekrar kullanılabilecek küçük bir interaktif deneyim olur."

## Document 2: Product Design & Technical Blueprint v1.0

Parallel You, kullanıcıların geçmişte verdikleri veya gelecekte verebilecekleri kararların alternatif sonuçlarını keşfettikleri, AI destekli interaktif bir hayat simülatörü.

Ürünü iki deneyimin birleşimi olarak tasarlayacağız:

- %60 simülasyon: Kararlar, beklenmedik olaylar, farklı yollar, sonuçlar ve alternatif evrenler.
- %40 kişisel hikâye: Gerçek hayattan ilham alan durumlar, duygusal bağ, düşündürücü olaylar ve seçimlerin anlamı.

Bu oranlar ürünün tasarım hedefi; algoritmik olarak ölçülen oranlar değil.

### 1. Ürün vizyonu

Ürünün ana mesajı: "One decision. Infinite possibilities." Bir karar. Sonsuz ihtimal.

Kullanıcı tek bir hayat yaşamış olabilir. Parallel You'da ise yaşayabileceği birçok farklı hayatın hikâyesini keşfedebilir.

Temel ürün ilkeleri:

- Her karar yeni bir hikâye dalı oluşturabilir.
- Seçimlerin hem avantajları hem bedelleri vardır.
- Geçmişteki olaylar sonraki bölümlere etki eder.
- Kullanıcı kendini yargılanmış değil, meraklandırılmış hissetmeli.
- AI, alternatif hayatların gerçek olasılıklarını bildiğini iddia etmemeli.

### 2. Görsel tasarım ve uygulama ekranları

Klasik bir dashboard yerine, bilim kurgu filmlerindeki evren keşfi hissini veren premium ve minimalist bir tasarım öneriyorum.

- 01 — Landing / Enter Your Universe. Tam ekran sinematik giriş. Ortada bir kapı veya ışık yarığı. "What if you chose differently?" mesajı. Tek ana eylem: Begin Your Journey.
- 02 — Your Origin. Kullanıcı alternatif hayatının başlangıcını belirler. Kim olduğu, yaşam dönemi, neyi değiştirmek istediği. İsteğe bağlı kısa profil ve örnek senaryolar.
- 03 — Story Experience. AI tarafından üretilen kısa ve etkileyici hikâye bölümleri. Olay, karar ve sonuç kartları. Kullanıcı kendi kaderini seçiyormuş gibi ilerler.
- 04 — Multiverse Map. Tüm kararlar ve oluşan evrenler bir haritada görünür. Her düğüm geçmiş bir olayı temsil eder. Kullanıcı herhangi bir düğümden yeni bir dal başlatabilir.
- 05 — Universe Comparison. İki farklı hayatı yan yana gösterir. Kariyer, özgürlük, sosyal ilişkiler ve maddi istikrar gibi kurgusal metrikler karşılaştırılır. V1.1 özelliği; ilk MVP için zorunlu değil.

Tasarım dili:

- Renkler: Void Black #0B0F19, Parallel Violet #7569F5, Timeline Teal #36C7BE, Fate Amber #E9B66B, Starlight #ECEEF6.
- Font: Space Grotesk başlıklar, Inter arayüz metinleri.
- Animasyon: Düğümler arasında ışık akışı, yumuşak geçişler, hafif parallax.
- Görsel stil: Dark cinematic, glassmorphism sınırlı, güçlü tipografi ve bol negatif alan.
- Önemli karar: MVP'de 3D motor yok. Güzel tasarlanmış 2D animasyonlar daha hızlı ve daha performanslı.

### 3. Kullanıcı akışı

İlk kullanımda sorulacak bilgiler (Your Origin, örnek form, adım 1/3):

- Şu an kendini nasıl tanımlarsın? Örnek: "Yazılım mühendisliği öğrencisiyim".
- Kararın başlangıç yılı.
- What if...? Örnek: "Üniversite yerine kendi şirketimi kursaydım?"
- Hikâyenin atmosferi: Gerçekçi ve dengeli / Sinematik ve dramatik / Beklenmedik ve çılgın.
- Eylem: Örnek hayatımı oluştur. Bu form ürün tasarımını denemek içindir; henüz gerçek uygulamanın AI altyapısına bağlı değildir.

Bu aşamada doğum tarihi, tam isim veya adres gibi hassas kişisel bilgiler istemeye gerek yok.

### 4. MVP özellikleri ve kapsam

Hedef: Tek geliştiriciyle, yaklaşık 14 günde çalışır ve paylaşılabilir bir web uygulaması.

Feature scope (P0 zorunlu · P1 opsiyonel · P2 sonraki sürüm):

- Kişisel başlangıç senaryosu — Kullanıcının kendi What If sorusunu girmesi — P0.
- AI hikâye motoru — Seçime bağlı, tutarlı kurgusal hikâyeler üretme — P0.
- Üç karar seçeneği — Her hikâye bölümünde 2–3 farklı ilerleme yolu — P0.
- Dallanabilen evren haritası — Karar düğümlerini görme ve eski düğümlerden yeniden başlama — P0.
- Kaydet / devam et — Tarayıcıda senaryoları saklama — P0.

MVP sınırları: Maksimum 3 karar derinliği, 2–3 seçenek/düğüm, tek aktif hikâye ve yalnızca metin tabanlı AI üretimi. Önceki bir düğüme geri dönülebilir; ancak yeni dal, ayrı bir hikâye kaydı oluşturur.

### 5. Teknik mimari

Modüler monolit yaklaşımı: Tek uygulama, ayrı sorumluluklara sahip modüller. AI çağrıları yalnızca sunucu üzerinden yapılır; tarayıcı tarafındaki durum ve kayıt yönetimi ayrıdır.

| Katman         | Teknoloji                      | Görev                              |
| -------------- | ------------------------------ | ---------------------------------- |
| Web framework  | Next.js + TypeScript           | UI ve sunucu endpoint'leri         |
| Styling        | Tailwind CSS                   | Responsive tasarım                 |
| Animasyon      | Motion                         | Ekran ve kart geçişleri            |
| Evren haritası | React Flow (`@xyflow/react`)   | Karar ağacı görselleştirme         |
| State          | Zustand                        | Aktif evren ve kullanıcı seçimleri |
| Veri doğrulama | Zod                            | AI çıktısı ve API istekleri        |
| AI             | Structured output destekli LLM | Yeni bölüm ve karar seçenekleri    |
| Persistence    | localStorage                   | Yerel hikâye kayıtları             |
| Testing        | Vitest + Playwright            | Birim ve uçtan uca testler         |
| Deployment     | Vercel                         | Web uygulamasını yayınlama         |

İlk sürümde Supabase veya başka bir veritabanı eklemezdim. Hesap ve bulut senkronizasyonu olmadığı için ek karmaşıklık yaratır.

### 6. Veri modeli

Ürünün belki de en önemli teknik kararı: Dalları bağımsız hikâyeler yerine birbirine bağlı düğümler olarak saklamak.

```ts
type StoryTone = "realistic" | "cinematic" | "chaotic";

interface Universe {
  id: string;
  origin: string;
  startYear: number;
  tone: StoryTone;
  rootNodeId: string;
  createdAt: string;
}

interface StoryNode {
  id: string;
  universeId: string;
  parentId: string | null;
  selectedChoiceId: string | null;
  depth: number;
  year: number;

  title: string;
  narrative: string;

  state: LifeState;
  choices: StoryChoice[];
}

interface StoryChoice {
  id: string;
  label: string;
  description: string;
}

interface LifeState {
  location: string;
  career: string;
  finances: number;
  relationships: number;
  freedom: number;
  wellbeing: number;
  keyEvents: string[];
}
```

`parentId` ile hikâyenin bir önceki düğümüne dönüyoruz. `selectedChoiceId`, o düğüme hangi kararla ulaşıldığını gösteriyor. `depth` ise ilk sürümde izin verilen üç karar seviyesini sınırlıyor.

AI tarafından üretilmesini istediğimiz veri buna benzer olacak:

```json
{
  "title": "The First Customer",
  "year": 2027,
  "narrative": "Six months after launching your company...",
  "stateChanges": {
    "finances": -12,
    "relationships": 5,
    "freedom": 8,
    "wellbeing": -4
  },
  "keyEvents": ["Signed your first customer", "Lost an important partnership"],
  "choices": [
    {
      "id": "a",
      "label": "Expand aggressively",
      "description": "Take a risk and hire a team."
    },
    {
      "id": "b",
      "label": "Stay independent",
      "description": "Grow slowly without outside funding."
    }
  ]
}
```

Puan değişimlerini sunucuda izin verilen sınırlar içine alacağız. Mevcut state değerleriyle toplayıp 0–100 aralığında tutacağız. Böylece AI'nın keyfî veya bozuk JSON üretmesi uygulamayı bozmaz.

Kritik tasarım kararı: AI sadece hikâye içeriğini önerir. Düğüm kimlikleri, parent ilişkileri, derinlik, kayıt kuralları ve karar ağacının bütünlüğü uygulama tarafından yönetilir.

### 7. Hikâye motorunun kuralları

Başarılı bir ürünün en önemli parçası iyi prompt yazmak değil, hikâye tutarlılığını kontrol etmek.

Her AI isteğine şu bilgiler gönderilecek:

- Kullanıcının başlangıç profili ve ilk alternatif kararı.
- Mevcut düğüme kadar yaşanan önemli olaylar.
- Seçilen son karar.
- Mevcut yaşam durumu ve kurgusal puanlar.
- Hikâye tonu ve üretim sınırları.

AI'nın uyması gereken kurallar:

1. Daha önce yaşanan olaylarla çelişme.
2. Her seçimi otomatik olarak başarılı veya başarısız gösterme.
3. Gerçekçi hikâyelerde makul zaman geçişleri kullan.
4. Her bölümde yeni bir çatışma, gelişme veya fırsat sun.
5. Kısa bölümler üret: yaklaşık 120–200 kelime.
6. İki veya üç anlamlı karar seçeneği sun.
7. Alternatif hayatın bir kurgu olduğunu açık tut.

Üç hikâye tonu için aynı motoru kullanacağız. Sadece olayların ne kadar sıra dışı olduğu ve anlatım biçimi değişecek.

### 8. Güvenlik, gizlilik ve maliyet

Bu küçük bir eğlence projesi olsa da birkaç önemli mühendislik kararı var.

- Güvenlik: API anahtarı tarayıcıya gönderilmemeli. Sunucu endpoint'inde istek doğrulama, makul giriş uzunluğu, çıktı şeması kontrolü ve istek limiti olmalı. Herkese açık demoda ücretli LLM endpoint'i sınırsız bırakılmamalı.
- Gizlilik: Kullanıcının girdiği kişisel hikâyeler üçüncü taraf AI sağlayıcısına gönderilebilir. Bunun için açık bilgilendirme yapılmalı. MVP'de hassas bilgiler istememek ve yerel kayıtları kolayca silebilmek daha doğru.
- Maliyet: Metin üretimi, görsel üretimine göre genellikle daha ekonomik olur. Fakat gerçek maliyet seçilen modelin token fiyatına, hikâye uzunluğuna ve kullanım miktarına bağlı. Başlangıçta kullanıcı başına sınırlı üretim ve demo bütçe limiti öneriyorum.

### 9. İki haftalık geliştirme stratejisi

- Faz 1 — Çalışan çekirdek (Gün 1–4): Önce sabit örnek hikâyelerle başlangıç formunu, karar seçimini ve React Flow haritasını çalıştır. Bu aşamada AI entegrasyonu yok.
- Faz 2 — Gerçek simülasyon (Gün 5–9): AI entegrasyonu, geçmiş olayların aktarımı, dallanma mantığı, JSON doğrulama, yükleme durumları ve yerel kayıt.
- Faz 3 — Ürün kalitesi (Gün 10–14): Sinematik tasarım, mobil görünüm, edge-case testleri, hata yönetimi, performans, yayınlama ve kısa demo.

MVP'nin başarılı olduğunu nasıl anlayacağız? Aşağıdaki senaryonun baştan sona çalışması yeterli bir kabul testi olur:

Bir kullanıcı geçmişteki kararını girer, AI ilk hikâyeyi oluşturur, üç karar seçeneğinden birini seçer, yeni bölüme ulaşır, eski düğüme geri döner, farklı bir karar seçerek ikinci bir dal oluşturur, sayfayı yeniler ve iki dalın da korunduğunu görür.

Ek olarak test etmemiz gereken durumlar: AI yanıt vermediğinde uygulamanın çökmeden hata göstermesi, bozuk JSON yanıtının reddedilmesi, fazla uzun kullanıcı girişlerinin kontrol edilmesi ve üçüncü karar seviyesinden sonra yeni üretimin durdurulması.

### 10. Sonuç

Parallel You v0.1 — tek cümlelik ürün tanımı: AI tarafından üretilen hikâyelerle alternatif hayatlarını keşfettiğin, seçimlerinle yeni evrenler oluşturduğun sinematik bir web deneyimi. Platform: Web / Mobile responsive. Geliştirme hedefi: 14 gün. Ana özellik: Branching stories. Mimari: Next.js monolith.

Bence bu projede en önemli tasarım kararı şu: Kullanıcı bir AI chatbot ile konuştuğunu değil, kendi alternatif evrenlerini keşfettiğini hissetmeli.

Bu nedenle ilk geliştireceğimiz ekran AI sohbet arayüzü değil, evren haritası ve sinematik hikâye deneyimi olmalı. AI, ürünün görünen yüzü değil, arka plandaki hikâye motoru olacak.

Bir de kapsamı korumak önemli: İki haftalık sürümde 3D, kullanıcı hesapları, görsel üretimi veya karmaşık ekonomi sistemi eklemeyeceğiz. Önce dallanan hikâye deneyimini gerçekten eğlenceli ve güvenilir hale getireceğiz.
