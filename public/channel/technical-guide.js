(function () {
  "use strict";

  const section = (id, number, title, summary, audiences, tags, html) => ({
    id, number, title, summary, audiences, tags, html,
  });

  window.TECHNICAL_GUIDE = {
    version: "1.0",
    updatedAt: "25 settembre 2026",
    title: "Guida tecnica e operativa",
    subtitle: "Manuale completo per formazione Revenue, Commerciale e Operativa",
    sections: [
      section("orientamento", "01", "Orientamento e architettura", "Che cosa governa il software, quali dati usa e come si collegano le sezioni.", ["revenue", "commerciale", "operativo"], ["architettura", "flusso", "categorie", "dati"], String.raw`
        <h4>Scopo del sistema</h4>
        <p>Gestione Channel e un ambiente unico per configurare politiche tariffarie, simulare prezzi di sito diretto e OTA, controllare il netto proprietario, confrontare scenari di markup e conservare uno storico verificabile. Il sistema non e un channel manager che pubblica direttamente: e un motore decisionale, di controllo e di formazione.</p>
        <h4>Flusso principale</h4>
        <ol>
          <li><b>Politiche e Strategie</b>: definisce sconti, condizioni/costi, piani tariffari, stagionalita e mapping per categoria e canale.</li>
          <li><b>Parametri</b>: riceve prenotazione simulata, canone, costi, commissioni e configurazioni operative.</li>
          <li><b>Motore matematico</b>: calcola notte per notte stagionalita e promo, separa i costi, applica markup e commissioni.</li>
          <li><b>Riepilogo e Grafico OTA Rates</b>: rende leggibili prezzi da pubblicare, prezzi cliente, netto OTA e delta rispetto al sito.</li>
          <li><b>Storico simulazioni</b>: conserva la fotografia iniziale e gli scenari grafici collegati.</li>
        </ol>
        <h4>Categorie disponibili</h4>
        <p>BB STANDARD, BB LUX, VILLE, VILLE LUXURY, CITY ROMIBA, CITY LECCE, CITY POMO, CASE ECONOMY e CASE VACANZE. Il motore matematico e condiviso; ogni categoria mantiene configurazioni, stagionalita, piani, costi e sconti propri.</p>
        <div class="guide-callout"><b>Regola di controllo:</b> prima di giudicare un risultato selezionare la categoria corretta, verificare date/persone/comune e controllare che sconti e piani siano attivi e mappati verso l'OTA interessata.</div>
      `),

      section("navigazione", "02", "Navigazione, salvataggio e sicurezza dati", "Come spostarsi, salvare, esportare e ripristinare senza perdere configurazioni.", ["revenue", "commerciale", "operativo"], ["salva", "export", "import", "reset", "tab", "cronologia"], String.raw`
        <h4>Navigazione</h4>
        <p>La barra laterale apre le sezioni. Le frecce in alto tornano alla pagina precedente o successiva della sessione. Il tasto <kbd>Tab</kbd> segue l'ordine dei controlli; <kbd>Shift</kbd> + <kbd>Tab</kbd> torna indietro.</p>
        <h4>Salva, esporta e importa</h4>
        <ul>
          <li><b>Salva</b> registra lo stato modificabile nel browser e mostra una conferma verde.</li>
          <li><b>Esporta</b> crea un file JSON con lo stato del simulatore, utile come backup o per trasferire le impostazioni.</li>
          <li><b>Importa</b> carica un JSON precedentemente esportato e sostituisce lo stato corrente dopo la validazione.</li>
          <li><b>Reset</b> ricostruisce lo stato principale dai dati iniziali del workbook. Usarlo soltanto quando si vuole davvero abbandonare le modifiche salvate.</li>
        </ul>
        <p>Il punto di stato in basso nella sidebar segnala modifiche non ancora salvate. Annulla/Ripeti riguarda le modifiche registrate nello stack dell'applicazione, in particolare celle e operazioni previste dal relativo flusso; non va considerato un sostituto del backup JSON.</p>
        <div class="guide-warning"><b>Buona pratica:</b> prima di cambiare molte regole, salvare ed esportare. Dare al file un nome con data, categoria e motivo della modifica.</div>
      `),

      section("riepilogo", "03", "Riepilogo operativo", "Lettura dei KPI, delle schede canale e dei risultati per categoria.", ["revenue", "commerciale", "operativo"], ["dashboard", "kpi", "margine", "prezzo", "netto"], String.raw`
        <h4>Modalita generale e categoria</h4>
        <p>Senza categoria selezionata il riepilogo legge i dati generali del workbook. Selezionando una categoria, le schede OTA vengono ricostruite con i piani attivi, le strategie mappate e i costi di quella categoria.</p>
        <h4>Come leggere una scheda OTA</h4>
        <ul>
          <li><b>Pubblicare</b>: prezzo tecnico/barrato richiesto dal flusso del canale.</li>
          <li><b>Prezzo finale cliente</b>: importo dopo promo e dopo l'aggiunta dei costi previsti.</li>
          <li><b>Netto OTA</b>: importo cliente commissionabile, al netto della provvigione. La tassa di soggiorno e esclusa dalla base commissionabile.</li>
          <li><b>Delta</b>: differenza, in euro e percentuale, fra netto OTA e tariffa diretta scontata dello stesso piano.</li>
        </ul>
        <p>Aprendo <b>Dettagli</b> si vede la cascata completa: base, stagionalita, markup piano, PL extra, markup successivo, sconti, costi, pubblicare, finale, commissione, netto e riferimento diretto.</p>
      `),

      section("parametri", "04", "Parametri generali e per categoria", "Campi modificabili, valori automatici e relazione con le configurazioni.", ["revenue", "operativo"], ["parametri", "canone", "costi", "commissioni", "pl extra", "markup"], String.raw`
        <h4>Modalita generale</h4>
        <p>Contiene gli input principali e le commissioni OTA. Le commissioni standard sono lette dal foglio <b>Basic_NR_markup</b>: Booking C14, Airbnb C15, Expedia C16 e Vrbo C17. Booking Preferred puo usare una commissione dedicata.</p>
        <h4>Modalita categoria</h4>
        <p>Mostra dati della simulazione, tariffe dirette, canone netto, stagionalita, piani OTA, promo e costi. Il canone netto diretto puo essere modificato; Easy e Refundable mantengono rispettivamente il rapporto +10% e +20% rispetto a NR.</p>
        <h4>Costi</h4>
        <ul>
          <li><b>Totale costi manuale</b> sostituisce, per il sito, la somma dei costi mappati.</li>
          <li><b>Costi Booking/Airbnb/Expedia/Vrbo</b> manuali sostituiscono la somma delle condizioni mappate per quel canale.</li>
          <li>Se un totale manuale e vuoto, il motore usa le condizioni attive e mappate.</li>
        </ul>
        <h4>PL extra e markup successivo</h4>
        <p>Il PL extra entra dopo il markup del piano. Il markup aggiuntivo dopo PL viene applicato sul lordo intermedio prima delle promo. Questa posizione nella cascata e importante: spostarlo cambierebbe la base degli sconti successivi.</p>
        <div class="guide-callout"><b>Valore automatico:</b> indica un risultato derivato. Modificare i suoi input a monte, non il numero visualizzato.</div>
      `),

      section("simulazione", "05", "Prenotazione simulata e tassa di soggiorno", "Date, notti, lead time, persone, comune e calcolo della tassa.", ["revenue", "commerciale", "operativo"], ["date", "notti", "lead time", "persone", "comune", "tassa soggiorno"], String.raw`
        <h4>Dati richiesti</h4>
        <p>Struttura/immobile, comune, data arrivo, data partenza e persone definiscono il contesto. Le notti sono la differenza fra partenza e arrivo; il lead time e la distanza fra la data corrente e l'arrivo.</p>
        <h4>Tassa di soggiorno</h4>
        <p>Il comune viene confrontato con l'archivio delle regole. Il totale e calcolato come <code>quota per persona/notte × persone × min(notti soggiorno, massimo notti tassabili)</code>. Le eventuali correzioni locali della regola hanno precedenza sul dato originario.</p>
        <p>La tassa puo essere inclusa nel prezzo finale cliente ma resta un incasso di passaggio: viene sottratta prima di applicare la commissione OTA.</p>
        <h4>Applicazione simulata</h4>
        <p>Il riquadro espone la stagionalita effettiva e, per Booking, i regimi temporali riconosciuti. In presenza di piu fasce, indica quante notti ricadono in ciascuna. E il primo controllo da fare quando un risultato non coincide con l'extranet.</p>
      `),

      section("stagionalita", "06", "Motore di stagionalita notte per notte", "Accavallamenti, pesi di base, weekend e precisione dei calcoli.", ["revenue", "operativo"], ["stagionalita", "accavallamento", "ponderata", "weekend", "arrotondamento"], String.raw`
        <h4>Assegnazione delle notti</h4>
        <p>Ogni notte tra arrivo incluso e partenza esclusa viene classificata. Le date comprese nella finestra Altissima usano la percentuale Altissima; le altre usano la stagione selezionata o quella di fallback. Il sistema non applica una media percentuale arrotondata al canone totale.</p>
        <h4>Calcolo revenue-weighted</h4>
        <p>Per ogni notte <i>i</i>:</p>
        <p class="guide-formula"><code>Quota_i = BaseNotte_i × (1 + MarkupStagione_i)</code></p>
        <p class="guide-formula"><code>CanoneStagionalizzato = Σ Quota_i</code></p>
        <p class="guide-formula"><code>MarkupEffettivo = (Σ Quota_i / Σ BaseNotte_i) - 1</code></p>
        <p>I pesi di base rappresentano il diverso valore giornaliero del PMS. CITY ROMIBA usa, fuori dall'Altissima, il rapporto iniziale 125,70/220 e un adeguamento weekend iniziale del 15%; i gruppi con flusso ville partono da peso 0,90 fuori Altissima. Tutti restano configurabili.</p>
        <h4>Arrotondamento</h4>
        <p>Nei soggiorni misti, la quota notturna dopo stagionalita e markup piano viene arrotondata ai centesimi e poi sommata. L'ultima notte assorbe l'eventuale residuo della ripartizione, evitando differenze cumulative.</p>
        <h4>Esempio</h4>
        <p>Con 20 notti in una fascia e 8 in un'altra, il sistema costruisce 28 quote reali. La percentuale mostrata e descrittiva; le formule successive ricevono la somma precisa delle quote, non una percentuale troncata.</p>
      `),

      section("sito-diretto", "07", "Sito diretto e fasce tariffarie", "NR, Easy, Refundable e sconti replicati dal catalogo Booking.", ["revenue", "commerciale", "operativo"], ["sito diretto", "nr", "easy", "refund", "lm", "pp", "los"], String.raw`
        <h4>Fasce</h4>
        <p>La base NR ha fattore 1,00; Easy 1,10; Refundable 1,20. I costi vengono separati prima di costruire la fascia e aggiunti nuovamente alla fine.</p>
        <p class="guide-formula"><code>DirettoFascia = ((NR pubblicato - costi) × fattore fascia × fattore sconti sito) + costi</code></p>
        <h4>Sconti ammessi sul sito</h4>
        <p>Il sito replica esclusivamente Last Minute, Prenota Prima e Long Stay configurati sul catalogo Booking e mappati verso il sito. Genius, Mobile, Paese e campagne restano esclusi.</p>
        <p>LM, PP e LOS competono notte per notte: per ogni notte viene scelta la percentuale piu alta applicabile. Il fattore medio e ponderato sul valore delle notti, non sul semplice conteggio.</p>
        <h4>Confronto corretto</h4>
        <p>Ogni piano OTA viene confrontato con la fascia diretta omologa: NR con NR, Easy con Easy, Refundable con Refundable. Questo evita di valutare un piano flessibile contro una tariffa diretta non rimborsabile.</p>
      `),

      section("pipeline-ota", "08", "Pipeline matematica comune alle OTA", "Ordine rigoroso di markup, promo, costi, commissione e delta.", ["revenue", "operativo"], ["formula", "pipeline", "commissione", "delta", "costi"], String.raw`
        <h4>Cascata standard</h4>
        <ol>
          <li>Canone netto diretto.</li>
          <li>Stagionalita notte per notte.</li>
          <li>Markup del piano tariffario.</li>
          <li>PL extra.</li>
          <li>Markup aggiuntivo dopo PL.</li>
          <li>Sconti applicabili secondo le regole dell'OTA.</li>
          <li>Costi/condizioni, con posizione determinata dal canale.</li>
          <li>Prezzo da pubblicare e prezzo finale cliente.</li>
          <li>Esclusione tassa di soggiorno dalla base commissionabile.</li>
          <li>Provvigione OTA, netto e delta contro il sito diretto omologo.</li>
        </ol>
        <p class="guide-formula"><code>NettoOTA = max(0, PrezzoFinaleCliente - TassaSoggiorno) × (1 - Commissione)</code></p>
        <p class="guide-formula"><code>Delta€ = NettoOTA - DirettoScontatoStessaFascia</code></p>
        <p class="guide-formula"><code>Delta% = Delta€ / DirettoScontatoStessaFascia</code></p>
        <p>Il sistema calcola anche il minimo proprietario pari al riferimento diretto maggiorato del 5% e il target teorico necessario, ma non forza automaticamente il prezzo cliente a quel minimo: il dato resta diagnostico.</p>
      `),

      section("booking", "09", "Booking.com: logica completa", "Piani, Genius, Mobile/Paese, campagne, LM, PP, LOS, Preferred e costi.", ["revenue", "commerciale", "operativo"], ["booking", "genius", "mobile", "paese", "last minute", "prenota prima", "long stay", "preferred"], String.raw`
        <h4>1. Piano e base</h4>
        <p>Il piano attivo riceve stagionalita e markup configurato. Gli eventuali flag fissi del piano contribuiscono al markup complessivo. Preferred puo usare una commissione dedicata.</p>
        <h4>2. Genius</h4>
        <p>Genius deriva dalla configurazione dei piani Booking. Se Genius 2 e attivo prevale su Genius 1. Viene applicato come primo livello della cascata catalogo.</p>
        <h4>3. Mobile e Paese</h4>
        <p>Mobile e Sconto Paese sono alternativi: viene utilizzata una sola percentuale, la maggiore. Se sono uguali, lo sconto viene applicato una volta sola.</p>
        <h4>4. Last Minute</h4>
        <ul>
          <li>Se durante il soggiorno compare un solo regime LM, quella percentuale si applica all'intero soggiorno, anche quando soltanto alcune notti sono entro la soglia.</li>
          <li>Se compaiono due o piu regimi LM distinti, il calcolo mantiene lo spacchettamento notte per notte e sottrae l'importo LM esatto prodotto da ciascuna fascia.</li>
          <li>La UI indica i regimi e il numero di notti riconosciute, per esempio LM3 1 notte + LM7 2 notti.</li>
        </ul>
        <h4>5. Prenota Prima e Long Stay</h4>
        <p>PP seleziona la soglia qualificante piu alta in base al lead time. LOS seleziona la soglia qualificante piu alta in base al numero di notti.</p>
        <p>Se convivono LM e LOS, Booking applica un solo sconto temporale: quello con percentuale maggiore. Se il timing selezionato e PP, PP e LOS restano sequenziali.</p>
        <h4>6. Due percorsi promo</h4>
        <p>Il motore confronta:</p>
        <ul>
          <li><b>Percorso catalogo</b>: Genius × migliore tra Mobile/Paese × timing/stay.</li>
          <li><b>Percorso campagna</b>: Genius × migliore campagna/offerta.</li>
        </ul>
        <p>Viene scelto il percorso che produce il prezzo piu basso, cioe lo sconto effettivo maggiore.</p>
        <h4>7. Pubblicare, costi e commissione</h4>
        <p>Booking applica gli sconti alla quota camera. I costi vengono aggiunti dopo. La tassa di soggiorno e inclusa nel totale cliente quando prevista ma esclusa prima della provvigione.</p>
        <h4>Esempio sintetico</h4>
        <p>Base dopo markup 824,18; Genius 15% → 700,55; max(Mobile 10%, Paese 10%) → 630,50. Se il soggiorno contiene LM3 e LM7, l'importo dei due LM viene ricavato dalle quote notturne originarie e sottratto secondo lo split; infine si aggiungono i costi. L'esempio serve a leggere la cascata: i valori reali sono sempre dinamici.</p>
      `),

      section("airbnb", "10", "Airbnb: logica completa", "Quattro piani, sconto NR, Mobile, equivalenze e sincronizzazione dei markup.", ["revenue", "commerciale", "operativo"], ["airbnb", "non rimborsabile", "rimborsabile", "mobile", "markup condiviso"], String.raw`
        <h4>Piani prodotti</h4>
        <p>Per ogni categoria sono calcolati: NON RIMBORSABILE, RIMBORSABILE, NON RIMBORSABILE MOBILE e RIMBORSABILE MOBILE.</p>
        <h4>Piani standard</h4>
        <ul>
          <li><b>NR standard</b>: include il fattore Airbnb NR fisso del 10% quando previsto dal piano.</li>
          <li><b>Refundable standard</b>: non applica quel fattore NR fisso.</li>
          <li>Le varianti standard escludono la famiglia Mobile dalla selezione promo.</li>
        </ul>
        <h4>Varianti Mobile</h4>
        <ul>
          <li><b>NR Mobile</b>: parte dal prezzo finale NR standard, separa i costi Airbnb, applica la promo Mobile soltanto alla quota senza costi e riaggiunge i costi.</li>
          <li><b>Refundable Mobile</b>: replica al centesimo il prezzo finale ottenuto dalla NR standard.</li>
          <li>Il prezzo da pubblicare delle varianti Mobile usa come riferimento il prezzo finale del piano standard sorgente.</li>
        </ul>
        <p class="guide-formula"><code>NR Mobile finale = (NR standard finale - costi Airbnb) × (1 - sconto Mobile) + costi Airbnb</code></p>
        <p class="guide-formula"><code>Refund Mobile finale = NR standard finale</code></p>
        <h4>Markup condiviso nel Grafico OTA Rates</h4>
        <p>Le quattro caselle Airbnb sono sincronizzate. L'ottimizzazione calcola il markup necessario sul piano di riferimento Rimborsabile non Mobile e riporta la stessa percentuale su tutti e quattro i piani. I prezzi restano diversi perche ogni piano conserva la propria logica.</p>
        <h4>Promo Airbnb</h4>
        <p>Nel motore categoria, la priorita generale seleziona la percentuale maggiore tra famiglie Genius/Mobile/Paese ammesse; campagna, LM, PP e LOS vengono poi applicati in sequenza se qualificanti. Le pagine OTA dedicate gestiscono inoltre le regole custom Airbnb descritte nel capitolo specifico.</p>
        <div class="guide-callout"><b>Uniformita categorie:</b> la funzione e condivisa da BB STANDARD, CITY ROMIBA, VILLE LUXURY e tutte le altre categorie. Cambiano soltanto configurazioni e dati salvati.</div>
      `),

      section("expedia", "11", "Expedia: logica completa", "Markup, priorita promo, pubblicare e netto commissionale.", ["revenue", "commerciale", "operativo"], ["expedia", "promo", "markup", "commissione"], String.raw`
        <h4>Cascata</h4>
        <p>Il piano Expedia riceve stagionalita, markup piano, PL extra e markup post-PL. Tra Genius/Mobile/Paese mappati viene scelta la percentuale maggiore; seguono campagna, LM, PP e LOS qualificanti, applicati sequenzialmente.</p>
        <p class="guide-formula"><code>FattoreSconti = fattore priorita × fattore campagna × fattore LM × fattore PP × fattore LOS</code></p>
        <h4>Pubblicare</h4>
        <p>Per Expedia il prezzo di presentazione viene ricostruito dividendo il prezzo finale per il fattore sconti applicabile. I costi seguono il flusso tecnico del canale e il netto esclude sempre la tassa di soggiorno prima della commissione.</p>
        <h4>Controlli</h4>
        <p>Verificare piano attivo, markup, commissione C16, promo attive/mappate e costi Expedia. Il delta deve essere letto contro la fascia diretta omologa.</p>
      `),

      section("vrbo", "12", "Vrbo: logica completa", "Cascata tariffaria, promo e controllo del margine.", ["revenue", "commerciale", "operativo"], ["vrbo", "promo", "markup", "commissione"], String.raw`
        <h4>Cascata</h4>
        <p>Vrbo condivide il motore OTA generale: stagionalita, markup piano, PL extra, markup post-PL, priorita fra sconti di targeting, campagna, LM, PP e LOS. Le percentuali sono lette dalla categoria selezionata.</p>
        <h4>Pubblicare e netto</h4>
        <p>Il pubblicare viene ricostruito dal prezzo finale e dal fattore promo. Il netto e calcolato sull'importo cliente senza tassa di soggiorno usando la commissione Vrbo C17.</p>
        <h4>Uso commerciale</h4>
        <p>Il delta aiuta a capire se l'esposizione Vrbo compensa la provvigione e gli sconti. Un prezzo cliente elevato non implica automaticamente un netto migliore: il riferimento e il netto diretto dello stesso piano.</p>
      `),

      section("pagine-ota", "13", "Pagine OTA e promo personalizzate", "Monitoraggio offerte, audit e logiche custom per ciascun canale.", ["revenue", "commerciale", "operativo"], ["pagine ota", "promo custom", "audit", "mapping"], String.raw`
        <h4>Funzioni comuni</h4>
        <p>Le pagine Booking.com, Expedia, Airbnb e Vrbo mostrano promo attive, fonte policy, stato applicazione, audit dei collegamenti, impatto prezzo, storico attivita e inserimento di promo personalizzate.</p>
        <h4>Preset promo custom</h4>
        <table><thead><tr><th>OTA</th><th>Famiglie gestite</th></tr></thead><tbody>
          <tr><td>Booking</td><td>Timing dopo markup; Genius/Premium; targeting a massimo; percorso catalogo; campagne; speciali; solo visibilita.</td></tr>
          <tr><td>Expedia</td><td>Timing; audience; package/B2B; promozioni; visibilita; solo visibilita.</td></tr>
          <tr><td>Airbnb</td><td>NR cumulativa; priorita LOS; timing; priorita custom; new listing; speciali e stagionali cumulative; visibilita.</td></tr>
          <tr><td>Vrbo</td><td>New listing cumulativa; timing; massimo Mobile/Member; mono-applicabilita a massimo; visibilita.</td></tr>
        </tbody></table>
        <p>Queste pagine servono al controllo del catalogo/promozioni generale. Il simulatore categoria usa come fonte operativa le mappature di <b>Politiche e Strategie</b>; verificare sempre che una promo custom e una strategia categoria rappresentino la stessa decisione commerciale.</p>
      `),

      section("strategie", "14", "Politiche e Strategie 2026/27", "Attivazione, percentuali, mapping, condizioni e piani per categoria.", ["revenue", "commerciale", "operativo"], ["strategie", "mapping", "sconti", "condizioni", "piani"], String.raw`
        <h4>Procedura corretta</h4>
        <ol>
          <li>Selezionare la categoria.</li>
          <li>Aprire la famiglia interessata.</li>
          <li>Impostare <b>Attiva = SI</b>.</li>
          <li>Definire la percentuale generale o specifica OTA.</li>
          <li>Mappare soltanto i canali che devono riceverla.</li>
          <li>Salvare e verificare la simulazione con date qualificanti.</li>
        </ol>
        <h4>Famiglie sconto</h4>
        <p>Last Minute, Prenota Prima, Long Stay, Genius, Mobile, Paese e Offerte. Genius 2 e supportato soltanto da Booking nel mapping categoria.</p>
        <h4>Stagionalita</h4>
        <p>Ogni categoria conserva markup per fascia, pesi di base, weekend e finestra Altissima. Le date vanno inserite realmente; il codice non sostituisce o inventa intervalli.</p>
        <h4>Restrizioni</h4>
        <p>La sezione conserva le restrizioni operative definite per la categoria. Prima di usarle come regola commerciale, verificare che siano effettivamente collegate al flusso di calcolo desiderato.</p>
      `),

      section("costi-piani", "15", "Condizioni, costi e piani tariffari", "Come vengono calcolati e quando un valore manuale prevale.", ["revenue", "commerciale", "operativo"], ["condizioni", "costi", "piani tariffari", "manuale"], String.raw`
        <h4>Condizioni</h4>
        <p>Ogni condizione puo essere per unita o persona, per soggiorno o notte, in euro o percentuale, e mappata separatamente su ciascuna OTA.</p>
        <p class="guide-formula"><code>Costo€ = importo × moltiplicatore persone/unita × moltiplicatore notti/soggiorno</code></p>
        <p>Per le condizioni percentuali, la percentuale usa la base target prevista dal motore e poi applica i moltiplicatori configurati.</p>
        <h4>Precedenza</h4>
        <p>Un totale manuale OTA compilato prevale sulla somma delle condizioni di quell'OTA. Lasciandolo vuoto, il calcolo torna dinamico.</p>
        <h4>Piani tariffari</h4>
        <p>Ogni piano ha stato attivo, OTA, markup base e opzioni. Il markup complessivo e la somma delle componenti previste, eccetto Airbnb, per cui il ricarico complessivo usa il markup base mentre lo sconto NR fisso resta una regola separata.</p>
        <div class="guide-warning"><b>Errore frequente:</b> modificare un costo in Politiche e Strategie e dimenticare un totale manuale compilato nei Parametri. In quel caso il valore manuale continua correttamente a prevalere.</div>
      `),

      section("grafico", "16", "Grafico OTA Rates e scenari markup", "Obiettivo, ottimizzazione automatica, grafici, salvataggio e applicazione.", ["revenue", "commerciale", "operativo"], ["grafico", "rates lab", "obiettivo", "scenario", "markup", "delta"], String.raw`
        <h4>Ingresso e stato iniziale</h4>
        <p>Il pannello parte con obiettivo netto OTA vs sito pari a -5% e tolleranza 2%. Le caselle markup mostrano i valori correnti importati dai Parametri; la fascia verde e soltanto il riferimento obiettivo.</p>
        <h4>Comandi</h4>
        <ul>
          <li><b>Applica obiettivo</b>: cerca per ogni piano il markup che avvicina il netto al target. La ricerca binaria esegue 64 iterazioni nell'intervallo 0%–500%.</li>
          <li><b>Ripristina</b>: torna all'obiettivo -5% e ai markup originari dei Parametri.</li>
          <li><b>Salva scenario</b>: conserva obiettivo, markup e risultati e li collega alla simulazione attiva quando disponibile.</li>
          <li><b>Applica ai parametri</b>: trasferisce i markup dello scenario alla configurazione piani.</li>
          <li><b>CSV/Stampa</b>: esporta o stampa la lettura corrente.</li>
        </ul>
        <h4>Visibilita</h4>
        <p>Il flag su ogni OTA decide se le sue righe compaiono nei grafici. Airbnb dispone anche del comando per mostrare/nascondere le tariffe Mobile.</p>
        <h4>Grafico senza tassa</h4>
        <p>Blu = netto OTA; rosso = prezzo cliente. L'asse e centrato sul riferimento NR sito senza tassa. Le etichette percentuali dei netti usano il riferimento diretto della stessa fascia. Le zone obiettivo sono NR, Easy e Refundable.</p>
        <h4>Grafico con tassa</h4>
        <p>Confronta il prezzo diretto comprensivo di tassa con il prezzo finale OTA comprensivo di tassa, usando pallini e linea di distanza. Serve alla lettura commerciale del prezzo pagato dal cliente.</p>
      `),

      section("storico-simulazioni", "17", "Storico simulazioni e confronto scenari", "Baseline, scenari collegati, filtri OTA, report e ripristino.", ["revenue", "commerciale", "operativo"], ["storico simulazioni", "report", "confronto", "scenario"], String.raw`
        <h4>Contenuto di una simulazione</h4>
        <p>La simulazione salvata conserva contesto prenotazione, parametri iniziali e riepilogo prezzi. Gli scenari salvati dal Grafico OTA Rates vengono associati alla stessa simulazione.</p>
        <h4>Report comparativo</h4>
        <p>Selezionare gli scenari e poi le OTA da includere. Il report mostra soltanto i canali flaggati, con prezzi per piano, markup, netto, delta contro NR o fascia diretta corrispondente e grafici sovrapposti.</p>
        <p>Il filtro OTA serve a evitare rumore: se Expedia e Vrbo non sono oggetto dell'analisi, lasciarli esclusi.</p>
        <h4>Azioni</h4>
        <p>Si possono ripristinare simulazioni, eliminare record, stampare ed esportare CSV. Ripristinare significa riportare nel simulatore i dati salvati; verificare sempre la categoria prima di continuare.</p>
      `),

      section("master", "18", "Calcolatore master", "Consultazione della struttura originaria del workbook.", ["revenue", "operativo"], ["master", "workbook", "formule"], String.raw`
        <p>Il Calcolatore master espone i parametri e la tabella del foglio <b>Calcolatore_3_Master</b>. E una vista di controllo della sorgente e delle formule, non il punto principale per configurare le categorie.</p>
        <p>Usarlo per ricostruire la provenienza di un numero o confrontare il risultato dell'interfaccia con il foglio originario. Le formule restano valutate dal motore workbook.</p>
      `),

      section("rms", "19", "Ottimizzazione RMS", "Strutture, tipologie, indici di domanda e raccomandazione prezzo.", ["revenue", "operativo"], ["rms", "occupazione", "prezzo", "domanda", "target"], String.raw`
        <h4>Configurazione</h4>
        <p>L'RMS gestisce strutture, tipologie camera, numero unita, rapporti tariffari, ancore prezzo 0–100, target ADR/ricavi e periodi calendario.</p>
        <h4>Indice finale</h4>
        <p>La pressione della camera combina occupazione della tipologia e occupazione struttura: <code>55% camera + 45% hotel</code>. L'indice finale combina importanza di mercato e pressione interna con pesi dinamici.</p>
        <h4>Prezzo raccomandato</h4>
        <ol>
          <li>Interpolazione fra le ancore prezzo in base all'indice.</li>
          <li>Modificatore del periodo.</li>
          <li>Calibrazione target: 80% prezzo non vincolato e 20% target quando il target e superiore.</li>
          <li>Floor di scarsita/pressione, limite massimo di crescita e limiti della tipologia.</li>
          <li>Arrotondamento finale a multipli di 5 euro.</li>
        </ol>
        <p>Calendario, matrice, storico simulazioni e report permettono di motivare la decisione, non soltanto di leggere un prezzo.</p>
      `),

      section("roomnight", "20", "Room Night e obiettivi", "Inventario, venduto, disponibilita, obiettivi e cluster.", ["revenue", "commerciale", "operativo"], ["room night", "inventario", "obiettivo", "cluster", "occupazione"], String.raw`
        <h4>Metriche</h4>
        <p>Per ogni struttura: <code>inventario = giorni × capacita</code>, <code>libere = inventario - vendute</code>, <code>occupazione = vendute / inventario</code>.</p>
        <h4>Operativita</h4>
        <p>Si possono aggiungere strutture, registrare rapidamente una vendita e correggere il venduto giornaliero con i controlli +/-. Gli obiettivi salvano il libero iniziale; il venduto successivo e la differenza fra libero iniziale e libero corrente.</p>
        <h4>Cluster</h4>
        <p>I cluster aggregano strutture selezionate su un intervallo per leggere capacita, venduto, libero e avanzamento complessivo.</p>
        <div class="guide-warning"><b>Orizzonte attuale:</b> il modulo nativo lavora sul calendario dal 1 luglio al 30 settembre 2026. Un'estensione richiede aggiornamento del modulo, non soltanto dei dati.</div>
      `),

      section("forecast", "21", "Forecast mono e multiunit", "Curve, scenari, ADR, occupazione e stagionalita mensile.", ["revenue", "commerciale"], ["forecast", "adr", "occupazione", "budget", "multiunit"], String.raw`
        <h4>Modalita</h4>
        <p><b>Monounit</b> applica una curva unica. <b>Multiunit</b> gestisce tipologie con quantita e moltiplicatori ADR.</p>
        <h4>Parametri</h4>
        <p>Minimo/massimo, peso e livello curva, apertura/chiusura, scenari e tipologie alimentano i livelli 0–10 e le proiezioni mensili.</p>
        <p class="guide-formula"><code>ADR = Ricavi / Notti vendute</code></p>
        <p class="guide-formula"><code>Occupazione = Notti vendute / Notti vendibili</code></p>
        <p>Le tabelle mensili e le 15 fasce estive permettono di confrontare potenziale, budget e stagionalita. Un forecast e un'ipotesi direzionale: va aggiornato con pickup e dati reali.</p>
      `),

      section("tassa-archivio", "22", "Archivio tassa di soggiorno", "Ricerca, filtri, regole comunali e correzioni locali.", ["commerciale", "operativo"], ["tassa soggiorno", "comune", "archivio", "regola"], String.raw`
        <p>La pagina aggrega archivio e regole per comune/provincia, tariffa e massimo notti. Offre ricerca, filtri, ordinamento e paginazione da 50 righe.</p>
        <p>La modifica di una riga o regola e locale al software: la sorgente originaria non viene riscritta. Il simulatore usa la regola corrispondente al comune inserito, alle persone e alle notti tassabili.</p>
        <h4>Controllo consigliato</h4>
        <p>Prima di una simulazione definitiva verificare comune, quota, massimo notti ed eventuali esenzioni non modellate. Il simulatore calcola la regola numerica disponibile, non interpreta automaticamente ogni eccezione normativa.</p>
      `),

      section("workbook", "23", "Workbook completo", "Consultazione, ricerca e modifica controllata delle celle.", ["revenue", "operativo"], ["workbook", "celle", "formula", "ricerca"], String.raw`
        <p>La sezione espone i fogli importati. La ricerca individua indirizzo, valore o formula. Per contenere il carico visivo sono mostrate fino a 45 colonne del foglio selezionato.</p>
        <p>Le celle prive di formula possono essere modificate; le celle formula sono di sola lettura e vengono ricalcolate. Dopo una modifica controllare le sezioni che dipendono da quel foglio e salvare.</p>
        <div class="guide-warning"><b>Uso avanzato:</b> modificare il workbook soltanto conoscendo l'indirizzo e la dipendenza. Per le normali attivita usare Parametri e Politiche e Strategie.</div>
      `),

      section("calcolatrice", "24", "Calcolatrice scientifica", "Strumento flottante per verifiche rapide senza uscire dal software.", ["revenue", "commerciale", "operativo"], ["calcolatrice", "percentuale", "verifica"], String.raw`
        <p>La calcolatrice si apre dalla sidebar, e trascinabile e mantiene espressione, modalita angolare e posizione durante la sessione. Supporta operazioni, parentesi, percentuali, potenze, radici, logaritmi, trigonometria e fattoriale.</p>
        <p>Usarla per controlli indipendenti, per esempio <code>(prezzo - tassa) × (1 - commissione)</code>. Il risultato non modifica automaticamente i parametri del simulatore.</p>
      `),

      section("formazione-revenue", "25", "Percorso formativo Revenue", "Sequenza consigliata per imparare a costruire e validare una simulazione.", ["revenue"], ["formazione", "revenue", "checklist", "esercitazione"], String.raw`
        <h4>Percorso in 8 passaggi</h4>
        <ol>
          <li>Leggere categorie, commissioni e fasce dirette.</li>
          <li>Configurare una categoria in Politiche e Strategie.</li>
          <li>Creare una prenotazione semplice in una sola stagione.</li>
          <li>Verificare la cascata dettagliata di ciascuna OTA.</li>
          <li>Ripetere con accavallamento stagionale.</li>
          <li>Provare Booking con LM singolo, LM multiplo, PP e LOS.</li>
          <li>Aprire Grafico OTA Rates, applicare un obiettivo e salvare due scenari.</li>
          <li>Generare il confronto nello Storico simulazioni e motivare la scelta.</li>
        </ol>
        <h4>Checklist di validazione</h4>
        <ul>
          <li>Il totale notti coincide con il calendario?</li>
          <li>La stagionalita mostra lo split atteso?</li>
          <li>Promo attiva e mapping OTA sono entrambi corretti?</li>
          <li>I costi manuali stanno sostituendo involontariamente quelli mappati?</li>
          <li>La tassa e esclusa dalla commissione?</li>
          <li>Il confronto usa lo stesso piano diretto?</li>
          <li>Il prezzo cliente e il netto proprietario raccontano la stessa decisione?</li>
        </ul>
      `),

      section("formazione-commerciale", "26", "Percorso formativo Commerciale", "Come spiegare prezzi, canali e scenari alla proprieta/direzione.", ["commerciale"], ["formazione", "commerciale", "proprietario", "report"], String.raw`
        <h4>Obiettivo</h4>
        <p>Il Commerciale deve distinguere prezzo visibile, sconto, costi, commissione e netto. Il prezzo piu alto non e sempre l'opzione piu redditizia e il prezzo piu basso non e sempre una perdita.</p>
        <h4>Metodo di presentazione</h4>
        <ol>
          <li>Descrivere il soggiorno e le condizioni di mercato.</li>
          <li>Mostrare il prezzo diretto per la stessa flessibilita.</li>
          <li>Mostrare prezzo cliente OTA e netto dopo commissione.</li>
          <li>Spiegare quali promo generano il divario.</li>
          <li>Confrontare pochi scenari selezionati, non tutti i canali indiscriminatamente.</li>
          <li>Concludere con obiettivo, rischio cancellazione e margine.</li>
        </ol>
        <p>Il report dello Storico simulazioni e lo strumento consigliato: contiene dati prenotazione, parametri iniziali, scenari e delta omogenei.</p>
      `),

      section("diagnostica", "27", "Diagnostica e controlli di qualita", "Come individuare rapidamente la causa di un prezzo inatteso.", ["revenue", "commerciale", "operativo"], ["errore", "diagnostica", "controllo", "qualita"], String.raw`
        <h4>Ordine di verifica</h4>
        <ol>
          <li>Categoria selezionata.</li>
          <li>Date, persone, comune e notti.</li>
          <li>Finestra Altissima e stagione selezionata.</li>
          <li>Piano attivo e markup.</li>
          <li>Promo attiva, percentuale e mapping.</li>
          <li>Regola di cumulabilita dell'OTA.</li>
          <li>Costi manuali e condizioni mappate.</li>
          <li>Tassa di soggiorno.</li>
          <li>Commissione standard o Preferred.</li>
          <li>Riferimento diretto della stessa fascia.</li>
        </ol>
        <h4>Segnali tipici</h4>
        <table><thead><tr><th>Sintomo</th><th>Controllo prioritario</th></tr></thead><tbody>
          <tr><td>Prezzo uguale nonostante un costo modificato</td><td>Totale manuale OTA compilato.</td></tr>
          <tr><td>Promo non applicata</td><td>Attiva, mapping OTA e requisito date/notti.</td></tr>
          <tr><td>Booking applica due LM inattesi</td><td>Leggere lo split nell'Applicazione simulata e le soglie rispetto a oggi.</td></tr>
          <tr><td>Netto troppo alto</td><td>Tassa sottratta prima della commissione e commissione corretta.</td></tr>
          <tr><td>Airbnb Mobile non coerente</td><td>Promo Mobile mappata, costi Airbnb e relazione con il piano standard sorgente.</td></tr>
          <tr><td>Grafico diverso dai Parametri</td><td>Scenario non ripristinato o markup ancora modificati nel Rates Lab.</td></tr>
        </tbody></table>
      `),

      section("storico-operazioni", "28", "Storico operazioni", "Cronologia interna di modifiche, salvataggi e annullamenti della sessione.", ["revenue", "commerciale", "operativo"], ["storico", "log", "operazioni", "audit"], String.raw`
        <p>La voce <b>Storico</b> della sidebar mostra le ultime operazioni registrate dall'applicazione, con ora e descrizione. Il registro include le azioni per cui il software genera un evento, come modifiche a celle o periodi, operazioni su promo e salvataggi previsti dal flusso.</p>
        <p>Il registro conserva al massimo 300 eventi nello stato corrente. Serve per ricostruire che cosa e stato modificato durante il lavoro, ma non e un audit immutabile né sostituisce il file JSON esportato.</p>
        <h4>Differenza da Storico simulazioni</h4>
        <p><b>Storico operazioni</b> racconta le azioni eseguite. <b>Storico simulazioni</b> conserva invece dati prenotazione, baseline tariffaria e scenari confrontabili.</p>
      `),

      section("glossario", "29", "Glossario", "Termini usati nell'interfaccia e nelle formule.", ["revenue", "commerciale", "operativo"], ["glossario", "definizioni"], String.raw`
        <dl class="guide-glossary">
          <dt>Canone netto</dt><dd>Quota base della camera/alloggio, prima della cascata tariffaria.</dd>
          <dt>Stagionalita</dt><dd>Variazione della base collegata alla data di ogni notte.</dd>
          <dt>Markup piano</dt><dd>Ricarico del piano tariffario prima degli sconti.</dd>
          <dt>PL extra</dt><dd>Importo aggiunto dopo il markup piano e prima del markup post-PL.</dd>
          <dt>Pubblicare</dt><dd>Prezzo tecnico o barrato dal quale il canale rappresenta le offerte.</dd>
          <dt>Prezzo finale cliente</dt><dd>Totale pagato o mostrato al cliente dopo promo e costi.</dd>
          <dt>Commissionabile</dt><dd>Quota su cui si calcola la provvigione; esclude la tassa di soggiorno.</dd>
          <dt>Netto OTA</dt><dd>Importo commissionabile dopo la provvigione.</dd>
          <dt>Delta</dt><dd>Differenza fra netto OTA e riferimento diretto omologo.</dd>
          <dt>Lead time</dt><dd>Giorni fra data corrente e arrivo.</dd>
          <dt>LM</dt><dd>Last Minute, sconto legato alla vicinanza dell'arrivo.</dd>
          <dt>PP</dt><dd>Prenota Prima, sconto legato all'anticipo.</dd>
          <dt>LOS</dt><dd>Length of Stay/Long Stay, sconto legato alla durata.</dd>
          <dt>Mapping</dt><dd>Collegamento esplicito di una regola a sito o OTA.</dd>
          <dt>Baseline</dt><dd>Fotografia dei parametri iniziali della simulazione.</dd>
          <dt>Scenario</dt><dd>Variante di obiettivo e markup collegata alla baseline.</dd>
        </dl>
      `),
    ],
  };
})();
