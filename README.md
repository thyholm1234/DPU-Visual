# DPU client-only webapp

Denne version er 100% client-side:
- Ingen backend
- Ingen API-kald
- Data bliver i browseren (og gemmes lokalt i `localStorage`)

## Start lokalt

Fra projektroden:

```powershell
cd "c:\Users\chris\Documents\DPU Visual\client-only-web"
python -m http.server 8073
```

Åbn derefter:

- http://localhost:8073

## Funktioner

- Indtastning for 2-5 DPU
- 9 skalaer med lineær interpolation
- Paste fra spreadsheet (tab-separeret)
- Import/eksport CSV
- Samlet profilplot og afvigelsesplot
- 9 tværsnitsgrafer
- Intern statistik med 95% CI (uden normdata)
