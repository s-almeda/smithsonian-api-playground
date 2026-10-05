# Smithsonian Open Access API — reference

Source: https://edan.si.edu/openaccess/apidocs/ + live tests 2026-10-04. Behaviour below is verified; it overrides the official docs. Real responses: `docs/samples/`.

## Basics
- Base `https://api.si.edu/openaccess/api/v1.0`. GET only. Auth: `?api_key=` (api.data.gov key; signup https://edan.si.edu/openaccess/signup/form).
- Rate limit 1000/hr; header `x-ratelimit-remaining`. `DEMO_KEY` = 10/hr.
- CORS `Access-Control-Allow-Origin: *` on api.si.edu and ids.si.edu (images). No preflight for plain GET.
- Envelope `{status, responseCode, response}`. Use HTTP status; `responseCode` is unreliable.

## Endpoints
| Path | Params | `response` |
|---|---|---|
| `/search` | `q` required (`*`=all; missing→400); `start`=0; `rows`=10 (0–1000); `sort`∈relevancy,id,newest,updated,random; `type`∈edanmdm(default),ead_collection,ead_component,all; `row_group`∈objects(default),archives; `fqs` | `{rows[], rowCount, facets:{}, message}` |
| `/category/{art_design\|history_culture\|science_technology}/search` | same as /search (`type` works too); missing `q`→200 empty | same |
| `/content/{id}` | `id` = row.`id` or row.`url` (`edanmdm:nmah_1119490`) | one record; not found → 404 |
| `/terms/{category}` | category∈culture,data_source,date,object_type,online_media_type,place,topic,unit_code; `starts_with` (case-sensitive prefix) | `{terms: string[], message}` |
| `/stats` | none | see Stats |

## Query rules
- `q` supports: terms (implicit AND), `field:value`, `field:"multi word"`, `"phrase"`, `prefix*`, `AND`, `NOT`. **`OR` is ignored — behaves as AND.**
- `fqs` must be a JSON array string, entries ANDed: `fqs=["unit_code:NASM","online_media_type:Images"]`. `OR` works inside one entry: `["unit_code:NASM OR unit_code:NMAH"]`.
- Filterable fields: unit_code, data_source, online_media_type, media_usage, place, date (decades e.g. `1980s`), topic, object_type, type. `culture` returned 0 for a listed term (unreliable). Not filterable: name, tax_*, scientific_name.
- Records with displayable CC0 images: `fqs=["media_usage:CC0","online_media_type:Images"]`.
- `q=*` rowCount = 14,520,210. Deep `start` (1e6) works; `start` ≥ rowCount → `rows:[]`.

## Silent failures / error shapes
- `fqs` that is not valid JSON array → ignored (unfiltered results).
- `rows`>1000 → 10. Invalid `sort` → relevancy. Unknown fqs field → 0 rows.
- `facets` always `{}`.
- Bad `:cat` → 400 `{status:400,responseCode:0,response:{error:"bad request: ..."}}`.
- Bad terms category → 200 `{response:{message:"Your request is missing parameters..."}}`.
- Bad/missing key → 403 `{error:{code:"API_KEY_INVALID"|"API_KEY_MISSING"|"OVER_RATE_LIMIT", message}}` (no envelope).
- `/terms/object_type` → 403 HTML firewall page. Responses are not always JSON.

## Terms sizes
unit_code 48 · online_media_type 10 · data_source 46 · date 202 · culture 8,684 (250KB) · place 114,951 (3.2MB, ~7s) · topic 133,162 (3.8MB, ~10s) · object_type blocked.

## Stats (fixed shape, monthly)
```json
{"time":"2026-10","total_objects":42812606,
 "metrics":{"CC0_records":17447826,"CC0_records_with_CC0_media":5257947,"CC0_media":4781579,"CC0_media_percentage":30},
 "units":[{"unit":"NMNHBOTANY","data_source":"NMNH - Botany Dept.","total_objects":4588378,
           "metrics":{"CC0_records":4588378,"CC0_records_with_CC0_media":3590125}}]}
```
48 units, sorted by CC0_records desc. Unit metrics have only the 2 keys. `with_CC0_media` can exceed `CC0_records` (OCIO_DPO3D).

## Record
Top level: `id`, `url` (`{type}:{record_ID}`), `title`, `unitCode`, `type`, `timestamp`, `lastTimeUpdated` (unix seconds as strings), `hash`, `docSignature`, `version`, `content`.

### type `edanmdm` → `content`
- `descriptiveNonRepeating`: `title{label,content}`, `record_ID`, `unit_code`, `data_source`, `title_sort`, `metadata_usage{access}`, `record_link` (~80%), `guid` (~25%), `online_media` (only if CC0 media).
- `indexedStructured`: string arrays — object_type, name, date, topic, language, place, culture, online_media_type, tax_kingdom…scientific_name, common_name; `geoLocation[]{L2,L3,L4,Other:{type,content}, points.point.{latitude,longitude}.content}`.
- `freetext`: `{[key]: {label, content}[]}`; keys incl. dataSource, name, objectType, date, identifier, notes, physicalDescription, place, topic, setName, publisher, title, taxonomicName, creditLine, objectRights, language, culture. Labels are display-ready.

### type `ead_collection` / `ead_component` → `content`
`{id, guid, type, level, title, boost, freetext}`; no descriptiveNonRepeating, no media. freetext items `{label, content, indexedContent?, flag?[]}` (`flag:"inherited"` = from parent). Extra keys: unitdate, container, creator, acqinfo, prefercite, userestrict.

### Media: `descriptiveNonRepeating.online_media = {mediaCount, media[]}`
- `media[]`: `{id, guid, type, idsId, usage{access}, content, thumbnail, altTextAccessibility, resources[]}`.
- `type:"Images"`: `content` = `https://ids.si.edu/ids/deliveryService/id/{ark}` (≤2000px). Append `/{N}` for max N px edge (`/400`). Query params (`?max=`) ignored. `resources[]{label: "High-resolution TIFF"|"High-resolution JPEG"|"Screen Image"|"Thumbnail Image", url, width?, height?}`.
- `type:"3d_voyager"`: `content` = `https://3d-api.si.edu/voyager/3d_package:{uuid}` (embeddable viewer); `resources[]{url,title,category,filename,attributes}` (usdz/obj/stl/glb).
- `indexedStructured.online_media_type:["Images"]` does NOT imply `online_media` exists (non-CC0 media is stripped).
- No CC0 sound/video results exist.

## Perf
Search 0.5–0.9s; ~3–10KB per row; `rows=1000` ≈ 4MB.
