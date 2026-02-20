# DPU client-only webapp

Denne version er 100% client-side:
- Ingen backend
- Ingen API-kald
- Data behandles lokalt i browseren under brug

## Start lokalt

Fra projektroden:

```powershell
cd "c:\Users\user\Documents\DPU Visual"
python -m http.server 8073
```

Åbn derefter:

- http://localhost:8073

## Funktioner

- Indtastning for 2+ DPU
- 9 skalaer med lineær interpolation
- Paste fra spreadsheet (tab-separeret)
- Import/eksport CSV
- Samlet profilplot og afvigelsesplot
- 9 tværsnitsgrafer
- Intern statistik med 80% CI (uden normdata)

## Hvad vises (output)

- Beregnede udviklingsaldre (mdr) pr. skala: For hver indtastet DPU beregnes en "udviklingsalder" i måneder ved at interpolere standard score (1-14) til forventet udviklingsalder. Dette giver en intuitiv aldersekvivalent per skala.
- Afvigelse fra kronologisk alder (mdr): For hver DPU og skala vises forskellen mellem udviklingsalder og kronologisk alder (Alder_år og Alder_mdr konverteret til måneder). Positive værdier betyder at udviklingsalderen er højere end kronologisk alder.
- Samlet gennemsnitlig udviklingsalder og gennemsnitlig afvigelse: Tværsnit over skalaer pr. DPU, samt konfidensintervaller (80% CI) beregnet fra egne data.
- Trendanalyse: Simpel lineær fit (slope, r og R²) over tid (kronologisk alder i måneder) for at vurdere udviklingsretning per skala og samlet.
- Parvise tests: Wilcoxon signed-rank på par af målinger (år-til-år eller nabomålinger) for at vurdere ændring mellem to tidspunkter.
- Grafer: Samlet profilplot (udviklingsalder pr. skala for alle DPU), afvigelsesplot (afvigelse pr. skala), tværsnitsgrafer pr. skala og CI-visualisering for sidste DPU-reference.
- Eksporter: CSV med de indtastede scorere og PDF-rapport med grafer og tabeller.

## Hvad data kan bruges til

- Overblik: Hurtigt visuelt overblik over hvilke skalaer, der ligger over/under kronologisk alder.
- Intern sammenligning: Identificere mønstre på tværs af DPU'er (fx konsekvent lavere score i bestemte skalaer).
- Ændring over tid: Vurdere om en persons udvikling accelererer, afflader eller ændrer retning vha. trend-slope og parvis tests.
- Kommunikation: Grafiske overblik og PDF-rapport kan bruges i tværfaglige møder eller som supplement til journalnotater.

## Begrænsninger

- Ikke normativt: Konfidensintervaller er interne og baseret på dine egne DPU-data — de erstatter ikke normative referencesæt.
- Små datamængder: Statistik (CI, trend, Wilcoxon) er upålidelig ved få målinger; to eller tre målinger giver kun meget begrænset evidens.
- Kvalitet: Resultater er kun så gode som inputdataene — forkert alder eller forkerte scores giver misvisende output.

## Anbefalinger

- Indtast mindst 2 valide DPU-rækker for at aktivere grafer og statistik.
- Gem/eksportér CSV for reproducérbarhed og videre analyser i statistikværktøjer.
- Brug PDF-rapporten som et kommunikativt supplement, ikke som eneste beslutningsgrundlag.

## Forbehold og ansvar

- Løsningen er et selvstændigt supplement og er ikke officielt tilknyttet producenten af et eventuelt kildesystem.
- Resultater er støtte til analyse og må ikke stå alene som diagnostisk eller behandlingsmæssigt beslutningsgrundlag.
- Beregninger afhænger af datakvalitet, datamængde og metodeantagelser; verificér altid resultater fagligt før anvendelse.
