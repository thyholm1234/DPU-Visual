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

## Forbehold og ansvar

- Løsningen er et selvstændigt supplement og er ikke officielt tilknyttet producenten af et eventuelt kildesystem.
- Resultater er støtte til analyse og må ikke stå alene som diagnostisk eller behandlingsmæssigt beslutningsgrundlag.
- Beregninger afhænger af datakvalitet, datamængde og metodeantagelser; verificér altid resultater fagligt før anvendelse.
