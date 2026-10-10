# Translations to review before the demo

Every Hindi, Telugu and Urdu message below was **machine-written** (by Claude, an AI model) on 9 Oct 2026.
**None has been checked by a native speaker.** They are marked `reviewed=false` in
`docs/translations/messages.csv`. Do not present them as checked.

13 messages x 3 languages = 39 translations.

## How to review

For each language, a native speaker (ideally one who has done delivery work or talks to riders) checks that the text:

1. says the same thing as the English: the same minutes, the same km, "no penalty" and "no pay cut" where the English has them;
2. is short and plain enough to read at a glance on a phone while riding (no formal or government words);
3. uses the words riders really use (for example "break", "order", "incentive", "target" may be better left in English).

Then:

1. Fix the text in `docs/translations/messages.csv`.
2. Set `reviewed` to `true` for that row (one flag covers all three languages of a row, so set it only when all three are checked).
3. Run `npm run export-messages` (it regenerates `engine/src/translations.ts`), then `npm test`, and commit both files.
4. Tick the row below and note who reviewed it.

Words chosen on purpose, to confirm: Hindi "आराम ब्रेक" / Telugu "విశ్రాంతి బ్రేక్" / Urdu "آرام کا وقفہ" for *cooling break*;
"पैसे सहित" / "జీతంతో" / "پیسوں کے ساتھ" for *paid*; "लू" / "వడగాల్పులు" / "لُو" for *heatwave*.

| Reviewer | Hindi | Telugu | Urdu |
| --- | --- | --- | --- |
| Name / date | | | |

## The messages

### [ ] `allow` (all, ALLOW)

- English: Order assigned.
- Hindi: ऑर्डर मिल गया।
- Telugu: ఆర్డర్ మీకు ఇవ్వబడింది.
- Urdu: آرڈر مل گیا۔

### [ ] `ndma-rest-in-progress` (ndma-2025, FORCE_REST)

- English: Your cooling break is still running. No penalty and no pay cut.
- Hindi: आपका आराम ब्रेक अभी चल रहा है। कोई जुर्माना नहीं, पैसे नहीं कटेंगे।
- Telugu: మీ విశ్రాంతి బ్రేక్ ఇంకా కొనసాగుతోంది. జరిమానా లేదు, డబ్బు కోత లేదు.
- Urdu: آپ کا آرام کا وقفہ ابھی جاری ہے۔ کوئی جرمانہ نہیں، پیسے نہیں کٹیں گے۔

### [ ] `ndma-peak-hours-pause` (ndma-2025, DENY)

- English: Heat alert: no mandatory orders from 11 AM to 4 PM. No penalty.
- Hindi: गर्मी की चेतावनी: सुबह 11 से शाम 4 बजे तक कोई ज़रूरी ऑर्डर नहीं। कोई जुर्माना नहीं।
- Telugu: వేడి హెచ్చరిక: ఉదయం 11 నుండి సాయంత్రం 4 వరకు తప్పనిసరి ఆర్డర్లు లేవు. జరిమానా లేదు.
- Urdu: گرمی کی وارننگ: صبح 11 سے شام 4 بجے تک کوئی لازمی آرڈر نہیں۔ کوئی جرمانہ نہیں۔

### [ ] `ndma-break-due` (ndma-2025, FORCE_REST)

- English: Heat alert: 15-minute cooling break after 90 minutes of work. No penalty and no pay cut.
- Hindi: गर्मी की चेतावनी: 90 मिनट काम के बाद 15 मिनट का आराम ब्रेक। कोई जुर्माना नहीं, पैसे नहीं कटेंगे।
- Telugu: వేడి హెచ్చరిక: 90 నిమిషాల పని తర్వాత 15 నిమిషాల విశ్రాంతి బ్రేక్. జరిమానా లేదు, డబ్బు కోత లేదు.
- Urdu: گرمی کی وارننگ: 90 منٹ کام کے بعد 15 منٹ کا آرام کا وقفہ۔ کوئی جرمانہ نہیں، پیسے نہیں کٹیں گے۔

### [ ] `ndma-reduced-radius` (ndma-2025, SKIP_ORDER)

- English: Heat alert: orders are limited to 3 km.
- Hindi: गर्मी की चेतावनी: ऑर्डर सिर्फ़ 3 किमी तक।
- Telugu: వేడి హెచ్చరిక: ఆర్డర్లు 3 కి.మీ. వరకు మాత్రమే.
- Urdu: گرمی کی وارننگ: آرڈر صرف 3 کلومیٹر تک۔

### [ ] `union-rest-in-progress` (union-demand, FORCE_REST)

- English: Your cooling break is still running. No penalty.
- Hindi: आपका आराम ब्रेक अभी चल रहा है। कोई जुर्माना नहीं।
- Telugu: మీ విశ్రాంతి బ్రేక్ ఇంకా కొనసాగుతోంది. జరిమానా లేదు.
- Urdu: آپ کا آرام کا وقفہ ابھی جاری ہے۔ کوئی جرمانہ نہیں۔

### [ ] `union-rest-due` (union-demand, FORCE_REST)

- English: Heatwave day: paid 20-minute cooling break after 2 hours of work. Nearest shade and water below. No penalty.
- Hindi: लू का दिन: 2 घंटे काम के बाद पैसे सहित 20 मिनट का आराम ब्रेक। पास की छाँव और पानी नीचे देखें। कोई जुर्माना नहीं।
- Telugu: వడగాల్పుల రోజు: 2 గంటల పని తర్వాత జీతంతో 20 నిమిషాల విశ్రాంతి బ్రేక్. దగ్గరి నీడ, నీళ్లు కింద చూడండి. జరిమానా లేదు.
- Urdu: لُو کا دن: 2 گھنٹے کام کے بعد پیسوں کے ساتھ 20 منٹ کا آرام کا وقفہ۔ قریب ترین سایہ اور پانی نیچے دیکھیں۔ کوئی جرمانہ نہیں۔

### [ ] `fair-rest-in-progress` (heatgate-fair, FORCE_REST)

- English: Your paid cooling break is still running.
- Hindi: आपका पैसे सहित आराम ब्रेक अभी चल रहा है।
- Telugu: మీ జీతంతో విశ్రాంతి బ్రేక్ ఇంకా కొనసాగుతోంది.
- Urdu: آپ کا پیسوں کے ساتھ آرام کا وقفہ ابھی جاری ہے۔

### [ ] `fair-rest-early-in-lull` (heatgate-fair, FORCE_REST)

- English: Orders are slow right now. Take a paid 20-minute break in the shade.
- Hindi: अभी ऑर्डर कम हैं। छाँव में पैसे सहित 20 मिनट का ब्रेक लें।
- Telugu: ఇప్పుడు ఆర్డర్లు తక్కువగా ఉన్నాయి. నీడలో జీతంతో 20 నిమిషాల బ్రేక్ తీసుకోండి.
- Urdu: ابھی آرڈر کم ہیں۔ سائے میں پیسوں کے ساتھ 20 منٹ کا وقفہ لیں۔

### [ ] `fair-rest-due` (heatgate-fair, FORCE_REST)

- English: Paid 20-minute cooling break. Nearest shade and water below.
- Hindi: पैसे सहित 20 मिनट का आराम ब्रेक। पास की छाँव और पानी नीचे देखें।
- Telugu: జీతంతో 20 నిమిషాల విశ్రాంతి బ్రేక్. దగ్గరి నీడ, నీళ్లు కింద చూడండి.
- Urdu: پیسوں کے ساتھ 20 منٹ کا آرام کا وقفہ۔ قریب ترین سایہ اور پانی نیچے دیکھیں۔

### [ ] `fair-rest-hard-limit` (heatgate-fair, FORCE_REST)

- English: Paid 20-minute cooling break. Nearest shade and water below.
- Hindi: पैसे सहित 20 मिनट का आराम ब्रेक। पास की छाँव और पानी नीचे देखें।
- Telugu: జీతంతో 20 నిమిషాల విశ్రాంతి బ్రేక్. దగ్గరి నీడ, నీళ్లు కింద చూడండి.
- Urdu: پیسوں کے ساتھ 20 منٹ کا آرام کا وقفہ۔ قریب ترین سایہ اور پانی نیچے دیکھیں۔

### [ ] `fair-short-trips-only` (heatgate-fair, SKIP_ORDER)

- English: This order is too far for this heat. You stay online for nearer orders.
- Hindi: इस गर्मी में यह ऑर्डर बहुत दूर है। पास के ऑर्डर के लिए आप ऑनलाइन रहेंगे।
- Telugu: ఈ వేడిలో ఈ ఆర్డర్ చాలా దూరం. దగ్గరి ఆర్డర్ల కోసం మీరు ఆన్‌లైన్‌లోనే ఉంటారు.
- Urdu: اس گرمی میں یہ آرڈر بہت دور ہے۔ قریب کے آرڈر کے لیے آپ آن لائن رہیں گے۔

### [ ] `fair-extreme-heat-stop` (heatgate-fair, DENY)

- English: Extreme heat. Deliveries paused. Your incentive target is reduced for this time.
- Hindi: बहुत ज़्यादा गर्मी। डिलीवरी रुकी है। इस समय के लिए आपका इंसेंटिव टारगेट कम किया गया है।
- Telugu: తీవ్రమైన వేడి. డెలివరీలు ఆపబడ్డాయి. ఈ సమయానికి మీ ఇన్సెంటివ్ టార్గెట్ తగ్గించబడింది.
- Urdu: شدید گرمی۔ ڈیلیوری رکی ہوئی ہے۔ اس وقت کے لیے آپ کا انسینٹو ٹارگٹ کم کر دیا گیا ہے۔
