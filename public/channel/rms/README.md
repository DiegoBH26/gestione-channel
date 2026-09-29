# Revenue Pricing Simulator

Mini software statico per simulare il prezzo consigliato per tipologia camera.

## Come si usa

Apri `index.html` nel browser.

1. In `Setup` inserisci struttura, camere totali, proporzione tariffaria per camera, prezzo base, minimo e massimo della camera base.
2. In `Setup` inserisci anche le fasce prezzo 0, 10, 20 ... 100 della camera base. Ogni fascia corrisponde alla percentuale di importanza mercato che arriva dal RMS.
3. In `Setup` inserisci anche ADR target e Revenue target per fascia 0-9.
4. Usa `Salva setup` per memorizzare la struttura. Potrai richiamarla dal menu `Strutture salvate`.
5. In `Simula` scegli il calendario di interesse con `Da` e `A`.
6. Inserisci ADR attuale delle prenotazioni gia in essere, ADR target mensile e Revenue target mensile.
7. Premi `Genera calendario`, poi per ogni giorno inserisci importanza RMS e numero di camere vendute per ogni tipologia.
8. Premi `Applica e genera prezzi` per creare la tabella finale camera per camera e giorno per giorno.
9. Se vuoi archiviarla, premi `Salva simulazione`.
10. In `Storico` puoi riaprire le simulazioni salvate in ordine cronologico e premere `Stampa report PDF`.
11. Il software mostra tariffa suggerita, importanza mercato, pressione struttura, importanza finale applicata, ADR target di fascia, Revenue target di fascia e forza struttura.
12. In `Matrici` controlli le fasce generate automaticamente per ogni tipologia.

## Logica algoritmo

Il prezzo RMS non viene usato come prezzo finale, ma come base mercato.

Il prezzo RMS di partenza viene letto dalla curva manuale delle fasce. Se l'importanza e intermedia, il software interpola tra le due fasce vicine.

ADR target e Revenue target per fascia 0-9 restano nel Setup e vengono usati come riferimento di calibrazione della fascia applicata.

ADR target mensile e Revenue target mensile sono dati dello scenario: li inserisci in `Simula`, sotto al calendario, perche possono cambiare in base al mese analizzato.

Nel Setup il peso della tipologia viene calcolato cosi:

```text
Peso tipologia = camere della tipologia / camere totali struttura
```

Il revenue target mensile non viene calcolato dal software: viene inserito manualmente come obiettivo mese e viene salvato nella simulazione come dato di contesto.

Il target ricavi usato nella tabella camera per camera viene letto dalle fasce impostate nel Setup:

```text
Revenue target camera = Revenue target fascia applicata * proporzione tipologia
```

Nel simulatore:

```text
Limite aumento sopra RMS %
```

e il tetto massimo con cui il prezzo suggerito puo superare il prezzo RMS. Esempio: RMS 100 euro e limite 55% significa prezzo massimo 155 euro.

La forza struttura viene calcolata automaticamente dall'occupazione della tipologia e dall'occupazione totale del giorno. Sale quando la struttura o la tipologia sono vicine al pieno, e scende quando la pressione e bassa.

Per ogni camera:

```text
Occupazione giorno = camere vendute totali / camere totali struttura

Occupazione tipologia = camere vendute tipologia / camere totali tipologia

Pressione camera = occupazione tipologia * 55% + occupazione giorno * 45%
```

Poi il simulatore calcola un indice finale con pesi dinamici:

```text
Indice finale =
  importanza RMS mercato * peso mercato
  + pressione camera * peso struttura
```

Quando la camera è quasi piena, il peso della struttura aumenta. Quando la pressione è bassa, il mercato torna più importante.

Il prezzo finale viene poi corretto con:

- proporzione della tipologia camera;
- curva prezzo 0-100 impostata nel setup;
- importanza RMS del giorno;
- occupazione giornaliera calcolata dalle camere vendute;
- occupazione specifica della tipologia camera;
- protezione scarsita quando la camera o la struttura sono vicine al pieno;
- pavimento strategico di pressione, cosi un ADR target basso non abbassa una camera quasi piena;
- ADR attuale delle prenotazioni gia in essere;
- ADR target mensile;
- Revenue target mensile;
- periodo selezionato;
- minimo e massimo tariffario;
- incremento massimo ammesso rispetto al prezzo RMS;
- arrotondamento a 5 euro.
