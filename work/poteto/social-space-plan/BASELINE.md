# Fotoğraf bilgilerinin görünürlüğü

3 Kasım 2026 tarihinde, uygulama kodu `985c6773aeb8ed3013a348aca93be158ba1ec043` üzerinde kontrol edildi. Kullanıcı eksikliği çoğu fotoğrafta görüyor. Aşağıdaki üç kontrol ayrı soruları cevaplıyor. [Uygulama planı](../../../docs/SOCIAL_SPACE_IMPLEMENTATION_PLAN.md)

## Canlı arşivde hangi kanıtlar var?

Yapılandırılmış ortak grubun mevcut üyelerine ait, geri çekilmemiş en az bir kaynağı olan tekil fotoğraflar sayıldı. Payda **961 fotoğraf**. Sayım, kişinin kendi keşif ekranında gizlediklerini veya birden fazla fotoğrafın tek anıda gruplanmasını uygulamaz. Bu nedenle bir üyeye görünen kart sayısı farklı olabilir.

| Fotoğraf başına en az bir kayıt | Adet |
| --- | ---: |
| Normalleştirilmiş kaynak çekim tarihi veya incelemede girilmiş çekim tarihi | 3 |
| Ham veya normalleştirilmiş paylaşım zamanı | 961 |
| Kaydedilmiş normalleştirilmiş paylaşım zamanı | 193 |
| Paylaşım zamanı yalnız ham biçimde kayıtlı | 768 |
| Etkin kaynaklarda paylaşılmış harita pini | 0 |
| İncelemede boş olmayan yer metni | 6 |
| Kaynaktan gelen şehir ifadesi | 0 |

Mevcut çekim tarihi kuralıyla 958 fotoğrafın çekim günü boş kalıyor. Uygulama ham paylaşım zamanını okurken çözebiliyor. 768, tarihi çözülemeyen fotoğraf sayısı olarak kullanılamaz. Altı yer metninin haritada tek bir şehre karşılık gelip gelmediği bu sayımda ölçülmedi.

Sayım, uygulamanın belgelenmiş `mazi_app` rolüyle özel `mazi` şemasında, doğrulanmış TLS üzerinden ve beş saniyelik sorgu sınırıyla çalıştırıldı. İşlemde `transaction_read_only=on` doğrulandı. Veritabanından yalnızca sayılar döndü. Özet sorgunun eşdeğeri aşağıda. [Bağlantı yapılandırması](../../../mazi/persistence.py) · [Arşiv şeması](../../../infra/hosted/supabase/migrations/20261014172936_application_archive.sql)

<details>
<summary>Sayımın kapsamı ve tekrar sorgusu</summary>

```sql
BEGIN READ ONLY;
SET LOCAL search_path TO mazi, pg_catalog;
SET LOCAL statement_timeout = '5s';
WITH origins AS (
  SELECT o.id, o.asset_id, o.group_id, o.payload::jsonb AS j
  FROM shared_policy cfg
  JOIN archive_origins o ON o.group_id = cfg.group_id AND o.withdrawn = 0
  JOIN archive_assets a ON a.id = o.asset_id AND a.group_id = o.group_id
  JOIN members m ON m.user_id = o.owner_id AND m.group_id = o.group_id
  WHERE cfg.singleton = 1
), photos AS (
  SELECT o.asset_id,
    bool_or(nullif(n.capture_date, '') IS NOT NULL OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(j->'capture_assertions') = 'array'
        THEN j->'capture_assertions' ELSE '[]'::jsonb END) c WHERE nullif(c->>'local', '') IS NOT NULL
    )) AS capture,
    bool_or(nullif(j#>>'{shared_at_assertion,raw}', '') IS NOT NULL) AS raw_share,
    bool_or(nullif(j#>>'{shared_at_assertion,local}', '') IS NOT NULL) AS local_share,
    bool_or(p.origin IS NOT NULL) AS pin,
    bool_or(nullif(btrim(n.place), '') IS NOT NULL) AS reviewed_place,
    bool_or(EXISTS (
      SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(j->'location_assertions') = 'array'
        THEN j->'location_assertions' ELSE '[]'::jsonb END) loc WHERE nullif(loc->>'city', '') IS NOT NULL
    )) AS source_city
  FROM origins o
  LEFT JOIN review_annotations n ON n.asset_id = o.asset_id AND n.group_id = o.group_id
  LEFT JOIN shared_places p ON p.origin = o.id
  GROUP BY o.asset_id
)
SELECT count(*) AS photos,
  count(*) FILTER (WHERE capture) AS capture,
  count(*) FILTER (WHERE raw_share OR local_share) AS any_share,
  count(*) FILTER (WHERE local_share) AS stored_local_share,
  count(*) FILTER (WHERE raw_share AND NOT local_share) AS raw_only_share,
  count(*) FILTER (WHERE pin) AS shared_pin,
  count(*) FILTER (WHERE reviewed_place) AS reviewed_place,
  count(*) FILTER (WHERE source_city) AS source_city
FROM photos;
ROLLBACK;
```

</details>

## Hangi arayüz yayında?

Canlı sitede `/`, `/explore`, `/atlas`, `/places`, `/memories`, `/circle` ve `/search` ayrı ayrı HTTP 200 verdi. Hepsi `/assets/index-Cd5iyiHo.js` dosyasını sundu. Bu dosyanın SHA-256 özeti yerel `npm run build` çıktısıyla aynıydı, `4c2ea3a017ebf8ec661b9ead5711a19acdd298ef7f894abd6ea3435461ec9c94`. Bu gözlem sunulan ön yüzü tanımlar. Belirli bir telefonun önbelleği, oturum ekranı ve çalışan Python sürümü ayrı doğrulanır. [Canlı giriş](https://mazi-three.vercel.app/) · [Dağıtım kaydı](../../../docs/DEPLOYMENT.md)

## Aynı fotoğraf farklı ekranlarda nasıl görünüyor?

Geçici SQLite arşivinde iki kontrol fotoğrafı ve bir sentetik Discord eki kullanıldı. Kırmızı kontrol fotoğrafında 2 Ocak 2020 ve incelemede eşleştirilmiş İstanbul var. Discord ekinde çekim tarihi ve konum yok. Kaynak mesajın zamanı `2024-01-02T10:00:02+00:00`. Chromium 153.0.8010.12, 1440 × 1024 masaüstü ve Pixel 7 emülasyonu, `en-GB` ve azaltılmış hareket ile aynı kontrollerden geçti.

| Ekran | Gözlenen sonuç |
| --- | --- |
| Home | Kırmızı kartta tarih ve İstanbul görünüyor. Discord kartında “Shared on 2 Jan 2024 · Capture date unknown” var. Boş yer için satır çıkmıyor. |
| Atlas ve Zaman çizelgesi | Discord fotoğrafı Atlas'ta konumsuz listede paylaşım günüyle bulunuyor. Zaman çizelgesinde 2024 altında görünüyor. |
| Anı detayı | Aynı Discord eki paylaşım gününü gösteriyor. Bilgi bölümünde “No place recorded” yazıyor. |
| Fotoğraflar, “By moment” | Kırmızı fotoğrafın grubunda “2 Jan 2020 · 1 photo · Shared by Alice” yazıyor. İstanbul başlıkta görünmüyor. |
| Fotoğraflar, “All photos” | Üç kutucuğun görünür metinleri sırasıyla boş, boş ve “About”. Bilinen tarih ve şehir bile kutucuğa ulaşmıyor. [Telefon görüntüsü](gallery-phone.png) |
| Arama, fotoğraf sonuçları | Kırmızı kontrol “2020-01-02 · istanbul” gösteriyor. Discord sonucu “Undated” diyor. 2 Ocak 2024 tek gün aralığında önceki Discord eşleşmesi 1'den 0'a düşüyor. |

İki görünümde de sentetik oturum açıkken `/people`, `/#/people`, `/settings` ve `/#/settings` adresleri “Memory not found” başlığına gitti. Her iki düz adresin belge isteği HTTP 200 döndü. `/#/discover?section=people` ise “People, confirmed by you” başlığını açtı ve klavye odağını oraya taşıdı. Sunucunun kabul ettiği iki yol için React tarafında yönlendirme eksik. [Sunulan yollar](../../../mazi/server.py) · [Ekran seçimi](../../../src/App.tsx)

### Yerel tekrar

Aşağıdaki komutlar kurulu bağımlılıklar ve Chromium ile repo kökünden çalışır. Arşiv, sunucu kapanınca temizlenir.

```sh
npm run build
MAZI_BACKEND=local .venv/bin/python - <<'PY'
from tests.backend.test_atlas import AtlasTests
from tests.browser.shared_fixture import configure_shared
from mazi.server import AppServer, handler_for

case = AtlasTests()
case.setUp()
try:
    case.store.correct_asset(case.alice, case.assets[0], title="Red",
                             capture_date="2020-01-02", place="Istanbul")
    chat = case._discord_card()
    asset = chat["id"].removeprefix("photo-")
    for bounds in ({}, {"start": "2024-01-02", "end": "2024-01-02"}):
        result = case.store.search(case.ben, case.group, **bounds)
        print(sum(item["id"] == asset for item in result["items"]), flush=True)
    configure_shared(case.store, case.group, {"Alice": case.alice, "Ben": case.ben})
    with AppServer(("127.0.0.1", 18573), handler_for(case.store)) as server:
        server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    case.tearDown()
PY
```

`http://127.0.0.1:18573` üzerinde sentetik `Ben` ve `synthetic-shared-code` ile gir. Home'dan Discord detayını aç. Keşfet'ten Atlas, Zaman çizelgesi ve Fotoğraflar'a geç. Fotoğraflar'da iki görünümü karşılaştır. Son olarak Arama'yı önce filtresiz, sonra `/#/search?from=2024-01-02&through=2024-01-02` ile aç. Aynı adımları telefon genişliğinde tekrarla.

Node 24.15.0 ve Python 3.14.7 ile `python -m unittest tests.backend.test_atlas tests.backend.test_atlas_place tests.backend.discovery.test_shared_by` sanal ortamda 45 testi geçti. `npm run test:unit` 20, `npm run test:dom` 153 testi geçti. Birim testlerinin dördü kronolojiyi kapsıyor. `npm run build`, `npm run lint` ve `npm run check:budgets` geçti. Bunlar mevcut davranışın ölçümüdür. Önerilen özelliklerin kabul koşulları [planda](../../../docs/SOCIAL_SPACE_IMPLEMENTATION_PLAN.md) yer alır.
