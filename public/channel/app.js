const DATA = window.WORKBOOK_DATA;
const STORE_KEY = "gestione-channel-state-v4-custom-promos";
const STRATEGY_PRESET_VERSION = "20260813-case-vacanze-policy-preset-v1";
const CALC_ENGINE_VERSION = "20260824-nightly-seasonality-v1";
const pages = [
  { id: "dashboard", label: "Riepilogo" },
  { id: "guide", label: "? Guida tecnica" },
  { id: "inputs", label: "Parametri" },
  { id: "booking", label: "Booking.com" },
  { id: "expedia", label: "Expedia" },
  { id: "airbnb", label: "Airbnb" },
  { id: "vrbo", label: "Vrbo" },
  { id: "master", label: "Calcolatore master" },
  { id: "rms", label: "Ottimizzazione RMS" },
  { id: "roomnight", label: "Room Night & Obiettivi" },
  { id: "strategies", label: "Politiche e Strategie 2026/27" },
  { id: "touristtax", label: "Tassa soggiorno 2026" },
  { id: "workbook", label: "Workbook completo" },
  { id: "simulationhistory", label: "Storico simulazioni" },
  { id: "log", label: "Storico" },
  { id: "forecast", label: "Forecast" },
];

let state;
let currentPage = "dashboard";
let currentSheet = DATA.sheets[0].name;
let sheetSearch = "";
let pageHistory = [currentPage];
let pageIndex = 0;
let undoStack = [];
let redoStack = [];
let dirty = false;
let evalCache = new Map();
let activeEvalSheet = DATA.sheets[0].name;
let otaHistoryOpen = {};
let categoryOtaOpen = {};
let inputDetailsOpen = { derived: false, targets: false };
let strategyPage = "";
let strategySectionOpen = {};
let parameterStrategy = "";
let dashboardStrategy = "";
let calculatorExpression = "";
let calculatorResult = "";
let calculatorAngleMode = "deg";
let calculatorOpen = false;
let calculatorPosition = { x: 420, y: 90 };
let calculatorCursorPosition = 0;
let calculatorSelectionEnd = 0;
let calculatorJustEvaluated = false;
let touristTaxFilters = { search: "", initial: "", comune: "", provincia: "", immobile: "", ota: "", month: "", status: "", sort: "date-desc" };
let touristTaxPage = 1;
let touristTaxEditingIndex = null;
let touristTaxSearchTimer = null;
let ratesLab = null;
let simulationHistorySelections = {};
let simulationHistoryOtaSelections = {};
let simulationHistoryReportOpen = {};
let pageDomCache = new Map();
let pageRenderRevision = 0;
let renderMemo = null;

const SEASONALITY_RULES = [
  { id: "altissima", label: "Altissima stagione", markup: 0.15 },
  { id: "alta", label: "Alta stagione", markup: 0.10 },
  { id: "medio_alta", label: "Medio alta", markup: 0.10 },
  { id: "media", label: "Media", markup: 0.10 },
  { id: "medio_bassa", label: "Medio bassa", markup: 0.10 },
  { id: "bassa", label: "Bassa", markup: 0.10 },
  { id: "bassissima", label: "Bassissima", markup: 0.10 },
  { id: "fuori_stagione", label: "Fuori stagione", markup: 0.10 },
];

const STRATEGY_GROUPS = [
  { id: "bb_standard", label: "BB STANDARD" },
  { id: "bb_lux", label: "BB LUX" },
  { id: "ville", label: "VILLE" },
  { id: "ville_luxury", label: "VILLE LUXURY" },
  { id: "city_roma", label: "CITY ROMIBA", subtitle: "Roma Milano Bari" },
  { id: "city_lecce", label: "CITY LECCE" },
  { id: "city_pomo", label: "CITY POMO", subtitle: "Polignano Monopoli" },
  { id: "case_economy", label: "CASE ECONOMY" },
  { id: "case_vacanze", label: "CASE VACANZE" },
];
function defaultCategorySeasonalityMarkups(groupId) {
  const high = groupId === "ville" ? 0.25 : 0.15;
  const standard = groupId === "ville" ? 0.15 : 0.10;
  return Object.fromEntries(SEASONALITY_RULES.map(rule => [rule.id, rule.id === "altissima" ? high : standard]));
}
const VILLA_COST_FLOW_GROUPS = new Set(["ville", "ville_luxury", "case_economy", "case_vacanze"]);
function usesVillaCostFlow(groupId) {
  return VILLA_COST_FLOW_GROUPS.has(groupId);
}
function defaultCategorySeasonalityBaseWeights(groupId) {
  // I coefficienti descrivono il rapporto tra le basi giornaliere del PMS.
  // CITY ROMIBA parte dal profilo calendario attualmente mappato; tutti i
  // valori restano modificabili dal pannello della categoria.
  const standard = groupId === "city_roma"
    ? (125.70 / 220)
    : (usesVillaCostFlow(groupId) ? 0.90 : 1);
  return Object.fromEntries(SEASONALITY_RULES.map(rule => [rule.id, rule.id === "altissima" ? 1 : standard]));
}
function defaultCategoryWeekendBaseMarkup(groupId) {
  return groupId === "city_roma" ? 0.15 : 0;
}
const STRATEGY_DISCOUNT_ROWS = [
  { id: "lm3", code: "LM 3", family: "Last minute", note: "Last minute 3 giorni" },
  { id: "lm7", code: "LM 7", family: "Last minute", note: "Last minute 7 giorni" },
  { id: "lm14", code: "LM 14", family: "Last minute", note: "Last minute 14 giorni" },
  { id: "lm21", code: "LM 21", family: "Last minute", note: "Last minute 21 giorni" },
  { id: "lm28", code: "LM 28", family: "Last minute", note: "Last minute 28 giorni" },
  { id: "lm45", code: "LM 45", family: "Last minute", note: "Last minute 45 giorni" },
  { id: "lm60", code: "LM 60", family: "Last minute", note: "Last minute 60 giorni" },
  { id: "pp210", code: "PP 210", family: "Prenota prima", note: "Prenota prima 210 giorni" },
  { id: "pp180", code: "PP 180", family: "Prenota prima", note: "Prenota prima 180 giorni" },
  { id: "pp150", code: "PP 150", family: "Prenota prima", note: "Prenota prima 150 giorni" },
  { id: "pp120", code: "PP 120", family: "Prenota prima", note: "Prenota prima 120 giorni" },
  { id: "pp90", code: "PP 90", family: "Prenota prima", note: "Prenota prima 90 giorni" },
  { id: "pp60", code: "PP 60", family: "Prenota prima", note: "Prenota prima 60 giorni" },
  { id: "pp30", code: "PP 30", family: "Prenota prima", note: "Prenota prima 30 giorni" },
  { id: "los2", code: "LOS 2", family: "Long stay", note: "Long stay 2 notti" },
  { id: "los7", code: "LOS 7", family: "Long stay", note: "Long stay 7 notti" },
  { id: "los14", code: "LOS 14", family: "Long stay", note: "Long stay 14 notti" },
  { id: "los21", code: "LOS 21", family: "Long stay", note: "Long stay 21 notti" },
  { id: "los28", code: "LOS 28", family: "Long stay", note: "Long stay 28 notti" },
  { id: "los35", code: "LOS 35", family: "Long stay", note: "Long stay 35 notti" },
  { id: "genius1", code: "Genius 1", family: "Genius", note: "Genius livello 1", defaultDiscount: 0 },
  { id: "genius2", code: "Genius 2", family: "Genius", note: "Genius livello 2", defaultDiscount: 0 },
  { id: "genius3", code: "Genius 3", family: "Genius", note: "Genius livello 3", defaultDiscount: 0 },
  { id: "mobile1", code: "Mobile", family: "Mobile", note: "Promo mobile base", defaultDiscount: 0 },
  { id: "mobile2", code: "Mobile 2", family: "Mobile", note: "Promo mobile potenziata", defaultDiscount: 0 },
  { id: "country_discount", code: "Sconto paese", family: "Paese", note: "Sconto paese / tariffa mirata", defaultDiscount: 0 },
  { id: "vacation_offer", code: "Offerta Vacanze", family: "Offerte", note: "Campagna / Offerta Vacanze", defaultDiscount: 0 },
];
const STRATEGY_DISCOUNT_VALUES = [0, 0.05, 0.10, 0.12, 0.15, 0.18, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50];
const OPTIONAL_STRATEGY_ROWS = new Set(["genius1", "genius2", "genius3", "mobile1", "mobile2", "country_discount", "vacation_offer"]);
const STRATEGY_OTAS = [
  { id: "booking", label: "Booking" },
  { id: "expedia", label: "Expedia" },
  { id: "airbnb", label: "Airbnb" },
  { id: "vrbo", label: "Vrbo" },
];
function strategyRowSupportsOta(row, otaId) {
  return row?.id !== "genius2" || otaId === "booking";
}
const RATE_PLAN_MARKUP_VALUES = [0, 0.05, 0.08, 0.10, 0.12, 0.15, 0.18, 0.20, 0.22, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 1.00];
const POST_PL_MARKUP_VALUES = [0, 0.02, 0.03, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50];
const CONDITION_AMOUNT_VALUES = [0, ...Array.from({ length: 20 }, (_, i) => (i + 1) * 5)];
const STRATEGY_CONDITION_ROWS = [
  { id: "winter_heating", label: "Riscaldamento mesi invernali" },
  { id: "bed_bath_linen", label: "Biancheria da letto e da bagno" },
  { id: "electricity", label: "Consumi elettrici" },
  { id: "practice_fee", label: "Costo Pratica" },
  { id: "final_cleaning", label: "Pulizia finale" },
  { id: "travel_cancellation", label: "ANNULLAMENTO VIAGGIO" },
  { id: "family_assistance_home", label: "ASSISTENZA FAMILIARI A CASA" },
  { id: "travel_assistance", label: "ASSISTENZA IN VIAGGIO" },
  { id: "linen_change_bed_bath", label: "Cambio biancheria Letto e Bagno" },
  { id: "crib", label: "Culla" },
  { id: "luggage_theft_damage", label: "FURTO O DANNI AL BAGAGLIO" },
  { id: "injuries", label: "INFORTUNI" },
  { id: "late_checkin", label: "Late check-in" },
  { id: "invoice_stamp", label: "Marca da Bollo per Fattura" },
  { id: "penalties", label: "Penali" },
  { id: "stay_extension_insurance", label: "PROLUNGAMENTO DEL SOGGIORNO CAUSA" },
  { id: "midweek_cleaning", label: "Pulizie infrasettimanali" },
  { id: "landlord_liability", label: "RESPONSABILITA' CIVILE DEL LOCATORE" },
  { id: "traveller_liability", label: "RESPONSABILITA' CIVILE DEL VIAGGIATORE" },
  { id: "medical_expenses", label: "SPESE MEDICHE" },
  { id: "protected_travel", label: "VIAGGI PROTETTO" },
  { id: "protected_travel_optional", label: "VIAGGI PROTETTO + OPZIONALI" },
  { id: "protected_travel_top", label: "VIAGGI PROTETTO TOP" },
  { id: "deposit_balance_cancel_policy", label: "Caparra, saldo e politiche di cancellazione" },
  { id: "security_deposit", label: "Deposito cauzionale" },
  { id: "checkin_checkout_management", label: "Gestione check-in/check-out" },
  { id: "tidy_without_linen_change", label: "Riassetto alloggio senza cambio biancheria" },
  { id: "bath_linen", label: "Biancheria da bagno" },
  { id: "bed_linen", label: "Biancheria da letto" },
  { id: "extra_foldaway_bed", label: "Brandina Aggiuntiva" },
  { id: "late_checkout_after_14", label: "Late check-out dopo le 14:00" },
  { id: "extra_bed", label: "Letto aggiuntivo" },
  { id: "internet_access", label: "Accesso internet" },
  { id: "early_arrival", label: "Arrivo anticipato" },
  { id: "ota_practice_booking_change", label: "Costo pratica OTA / Cambi prenotazione / Altre spese" },
  { id: "late_checkin_milan", label: "Late check-in Milano" },
  { id: "short_rental_dl_50_2017", label: "Locazione breve ai sensi del D.L. 50/2017" },
];
const STRATEGY_RATE_PLANS = [
  {
    groupId: "bb_standard",
    ota: "booking",
    id: "bb_standard_booking_not_refundable",
    name: "NOT REFUNDABLE",
    policy: "L'ospite paga l'importo totale della prenotazione se cancella in qualsiasi momento dopo la prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente al momento della prenotazione.",
  },
  {
    groupId: "bb_standard",
    ota: "booking",
    id: "bb_standard_booking_easy_7",
    name: "EASY 7",
    policy: "Il cliente puo cancellare gratuitamente fino a 7 giorni prima dell'arrivo. L'ospite paga il 50% del costo totale se cancella nei 7 giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
  },
  {
    groupId: "bb_standard",
    ota: "airbnb",
    id: "bb_standard_airbnb_non_refundable",
    name: "NON RIMBORSABILE",
    defaultBaseMarkup: 0,
    fixedAirbnbDiscount: true,
    policy: "Tariffa giornaliera Airbnb sulla quale vengono applicate le scontistiche mappate per BB STANDARD.",
    collection: "Il prezzo pubblicato e il prezzo finale cliente seguono priorita e cumulabilita Airbnb.",
  },
  {
    groupId: "bb_standard",
    ota: "airbnb",
    id: "bb_standard_airbnb_refundable",
    name: "RIMBORSABILE",
    defaultBaseMarkup: 0,
    fixedAirbnbDiscount: false,
    policy: "Tariffa rimborsabile Airbnb senza lo sconto Airbnb iniziale del 10%.",
    collection: "Il prezzo pubblicato e il prezzo finale cliente seguono priorita e cumulabilita Airbnb.",
  },
  {
    groupId: "bb_standard",
    ota: "airbnb",
    id: "bb_standard_airbnb_non_refundable_mobile",
    name: "NON RIMBORSABILE · MOBILE",
    defaultBaseMarkup: 0,
    fixedAirbnbDiscount: true,
    airbnbMobileVariant: true,
    policy: "Tariffa non rimborsabile Airbnb con promo Mobile.",
    collection: "Include lo sconto Airbnb iniziale fisso del 10% e la promo Mobile configurata.",
  },
  {
    groupId: "bb_standard",
    ota: "airbnb",
    id: "bb_standard_airbnb_refundable_mobile",
    name: "RIMBORSABILE · MOBILE",
    defaultBaseMarkup: 0,
    fixedAirbnbDiscount: false,
    airbnbMobileVariant: true,
    policy: "Tariffa rimborsabile Airbnb con promo Mobile.",
    collection: "Include la promo Mobile e non include lo sconto Airbnb iniziale fisso del 10%.",
  },
  {
    groupId: "bb_standard",
    ota: "booking",
    id: "bb_standard_booking_refund_1",
    name: "REFUND 1",
    policy: "Il cliente puo cancellare gratuitamente fino a 1 giorno prima dell'arrivo. Il cliente paga l'importo totale della prenotazione se cancella nelle 24 ore precedenti all'arrivo.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
  },
  {
    groupId: "bb_lux",
    ota: "booking",
    id: "bb_lux_booking_not_refundable",
    name: "NOT REFUNDABLE",
    policy: "L'ospite paga l'importo totale della prenotazione se cancella in qualsiasi momento dopo la prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente al momento della prenotazione.",
  },
  {
    groupId: "bb_lux",
    ota: "booking",
    id: "bb_lux_booking_easy_14",
    name: "EASY 14",
    policy: "Il cliente puo cancellare gratuitamente fino a 14 giorni prima dell'arrivo. Il cliente paga il 50% del costo totale se cancella nei 14 giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
  },
  {
    groupId: "bb_lux",
    ota: "booking",
    id: "bb_lux_booking_refund_5",
    name: "REFUND 5",
    policy: "Il cliente puo cancellare gratuitamente fino a 5 giorni prima dell'arrivo. L'ospite paga l'importo totale della prenotazione se cancella nei 5 giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
  },
  {
    groupId: "city_roma",
    ota: "booking",
    id: "city_roma_booking_not_refundable",
    name: "NOT REFUNDABLE",
    policy: "L'ospite paga l'importo totale della prenotazione se cancella in qualsiasi momento dopo la prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente al momento della prenotazione.",
  },
  {
    groupId: "city_roma",
    ota: "booking",
    id: "city_roma_booking_easy_14",
    name: "EASY 14",
    policy: "Il cliente puo cancellare gratuitamente fino a 14 giorni prima dell'arrivo. Il cliente paga il 50% del costo totale se cancella nei 14 giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
  },
  {
    groupId: "city_roma",
    ota: "booking",
    id: "city_roma_booking_refund_5",
    name: "REFUND 5",
    policy: "Il cliente puo cancellare gratuitamente fino a 5 giorni prima dell'arrivo. L'ospite paga l'importo totale della prenotazione se cancella nei 5 giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
  },
  {
    groupId: "city_lecce",
    ota: "booking",
    id: "city_lecce_booking_not_refundable",
    name: "NOT REFUNDABLE",
    policy: "L'ospite paga l'importo totale della prenotazione se cancella in qualsiasi momento dopo la prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente al momento della prenotazione.",
  },
  {
    groupId: "city_lecce",
    ota: "booking",
    id: "city_lecce_booking_easy_14",
    name: "EASY 14",
    policy: "Il cliente puo cancellare gratuitamente fino a 14 giorni prima dell'arrivo. Il cliente paga il 50% del costo totale se cancella nei 14 giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
  },
  {
    groupId: "city_lecce",
    ota: "booking",
    id: "city_lecce_booking_refund_5",
    name: "REFUND 5",
    policy: "Il cliente puo cancellare gratuitamente fino a 5 giorni prima dell'arrivo. L'ospite paga l'importo totale della prenotazione se cancella nei 5 giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
  },
  {
    groupId: "city_pomo",
    ota: "booking",
    id: "city_pomo_booking_not_refundable",
    name: "NOT REFUNDABLE",
    policy: "L'ospite paga l'importo totale della prenotazione se cancella in qualsiasi momento dopo la prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente al momento della prenotazione.",
  },
  {
    groupId: "city_pomo",
    ota: "booking",
    id: "city_pomo_booking_easy_14",
    name: "EASY 14",
    policy: "Il cliente puo cancellare gratuitamente fino a 14 giorni prima dell'arrivo. Il cliente paga il 50% del costo totale se cancella nei 14 giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
  },
  {
    groupId: "city_pomo",
    ota: "booking",
    id: "city_pomo_booking_refund_5",
    name: "REFUND 5",
    policy: "Il cliente puo cancellare gratuitamente fino a 5 giorni prima dell'arrivo. L'ospite paga l'importo totale della prenotazione se cancella nei 5 giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.",
    collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
  },
  ...["ville", "ville_luxury", "case_economy", "case_vacanze"].flatMap(groupId => {
    const profile = {
      ville: { easy: 30, refund: 21 },
      ville_luxury: { easy: 42, refund: 30 },
      case_economy: { easy: 14, refund: 5 },
      case_vacanze: { easy: 21, refund: 14 },
    }[groupId];
    return [
    {
      groupId,
      ota: "booking",
      id: `${groupId}_booking_not_refundable`,
      name: "NOT REFUNDABLE",
      policy: "L'ospite paga l'importo totale della prenotazione se cancella in qualsiasi momento dopo la prenotazione.",
      collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente al momento della prenotazione.",
    },
    {
      groupId,
      ota: "booking",
      id: `${groupId}_booking_easy_14`,
      name: `EASY ${profile.easy}`,
      policy: `Il cliente puo cancellare gratuitamente fino a ${profile.easy} giorni prima dell'arrivo. Il cliente paga il 50% del costo totale se cancella nei ${profile.easy} giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.`,
      collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
    },
    {
      groupId,
      ota: "booking",
      id: `${groupId}_booking_refund_5`,
      name: `REFUND ${profile.refund}`,
      policy: `Il cliente puo cancellare gratuitamente fino a ${profile.refund} giorni prima dell'arrivo. L'ospite paga l'importo totale della prenotazione se cancella nei ${profile.refund} giorni prima dell'arrivo. Se l'ospite non si presenta, dovra pagare l'importo totale della prenotazione.`,
      collection: "Booking.com riscuotera il pagamento dell'importo totale dal cliente prima che scada il periodo di cancellazione gratuita.",
    },
    ];
  }),
  ...STRATEGY_GROUPS.filter(group => group.id !== "bb_standard").flatMap(group => ([
    {
      groupId: group.id,
      ota: "airbnb",
      id: `${group.id}_airbnb_non_refundable`,
      name: "NON RIMBORSABILE",
      defaultBaseMarkup: 0,
      fixedAirbnbDiscount: true,
      policy: `Tariffa non rimborsabile Airbnb collegata alle politiche della categoria ${group.label}.`,
      collection: "Include lo sconto Airbnb iniziale fisso del 10%, seguito dalle altre promo applicabili.",
    },
    {
      groupId: group.id,
      ota: "airbnb",
      id: `${group.id}_airbnb_refundable`,
      name: "RIMBORSABILE",
      defaultBaseMarkup: 0,
      fixedAirbnbDiscount: false,
      policy: `Tariffa rimborsabile Airbnb collegata alle politiche della categoria ${group.label}.`,
      collection: "Non include lo sconto Airbnb iniziale del 10%.",
    },
    {
      groupId: group.id,
      ota: "airbnb",
      id: `${group.id}_airbnb_non_refundable_mobile`,
      name: "NON RIMBORSABILE · MOBILE",
      defaultBaseMarkup: 0,
      fixedAirbnbDiscount: true,
      airbnbMobileVariant: true,
      policy: `Tariffa non rimborsabile Airbnb con Mobile per ${group.label}.`,
      collection: "Include lo sconto Airbnb iniziale fisso del 10% e la promo Mobile configurata.",
    },
    {
      groupId: group.id,
      ota: "airbnb",
      id: `${group.id}_airbnb_refundable_mobile`,
      name: "RIMBORSABILE · MOBILE",
      defaultBaseMarkup: 0,
      fixedAirbnbDiscount: false,
      airbnbMobileVariant: true,
      policy: `Tariffa rimborsabile Airbnb con Mobile per ${group.label}.`,
      collection: "Include la promo Mobile e non include lo sconto Airbnb iniziale fisso del 10%.",
    },
  ])),
  ...STRATEGY_GROUPS.flatMap(group => STRATEGY_OTAS
    .filter(ota => ota.id !== "booking" && ota.id !== "airbnb")
    .map(ota => ({
      groupId: group.id,
      ota: ota.id,
      id: `${group.id}_${ota.id}_standard_rate`,
      name: ota.id === "airbnb" ? "PREZZO GIORNALIERO" : "TARIFFA STANDARD",
      defaultBaseMarkup: 0,
      policy: `Piano base ${ota.label} collegato alle politiche della categoria ${group.label}.`,
      collection: `Prezzo pubblicato e prezzo finale calcolati con priorita, cumulabilita, costi e sconti ${ota.label}.`,
    }))),
];

const FORECAST_MONTHS = ["GENNAIO", "FEBBRAIO", "MARZO", "APRILE", "MAGGIO", "GIUGNO", "LUGLIO", "AGOSTO", "SETTEMBRE", "OTTOBRE", "NOVEMBRE", "DICEMBRE"];
const FORECAST_SEASON_BANDS = [
  { from: "01-01", to: "03-31", min: 0, max: 2 },
  { from: "04-01", to: "05-22", min: 0, max: 2 },
  { from: "05-23", to: "06-12", min: 1, max: 3 },
  { from: "06-13", to: "06-26", min: 3, max: 6 },
  { from: "06-27", to: "07-10", min: 6, max: 7 },
  { from: "07-11", to: "07-24", min: 7, max: 8 },
  { from: "07-25", to: "08-07", min: 8, max: 9 },
  { from: "08-08", to: "08-21", min: 9, max: 10 },
  { from: "08-22", to: "08-28", min: 8, max: 9 },
  { from: "08-29", to: "09-04", min: 7, max: 8 },
  { from: "09-05", to: "09-11", min: 6, max: 7 },
  { from: "09-12", to: "09-18", min: 4, max: 6 },
  { from: "09-19", to: "09-30", min: 1, max: 3 },
  { from: "10-01", to: "10-31", min: 0, max: 2 },
  { from: "11-01", to: "12-31", min: 0, max: 1 },
];
function defaultForecastState() {
  return {
    mode: "mono",
    mono: {
      minPrice: 33, maxPrice: 150, curveWeight: 0.15, curveLevel: 7,
      opening: "2026-01-01", closing: "2026-12-31", units: 1,
      revenues: [350,350,700,700,250,1200,2400,3500,800,250,350,350],
      nights: [5,5,10,10,5,15,18,21,9,5,5,5], scenario: "Recovery",
    },
    multi: {
      minPrice: 86, maxPrice: 180, curveWeight: 0.35, curveLevel: 6,
      opening: "2026-01-01", closing: "2026-12-31",
      revenues: [450,450,450,650,1400,2200,5000,7500,2200,750,450,450],
      nights: [5,5,5,7,15,22,45,65,22,8,5,5], scenario: "OK",
      unitTypes: [
        { name: "Tipologia 1", units: 1, multiplier: 1 },
        { name: "Tipologia 2", units: 1, multiplier: 1.10 },
        { name: "Tipologia 3", units: 1, multiplier: 1.20 },
      ],
    },
  };
}
function mergeForecastState(saved = {}) {
  const base = defaultForecastState();
  const cleanMode = saved?.mode === "multi" ? "multi" : "mono";
  for (const mode of ["mono", "multi"]) {
    const src = saved?.[mode] || {};
    for (const key of ["minPrice", "maxPrice", "curveWeight", "curveLevel", "units"]) {
      if (Number.isFinite(Number(src[key]))) base[mode][key] = Number(src[key]);
    }
    for (const key of ["opening", "closing", "scenario"]) if (typeof src[key] === "string") base[mode][key] = src[key];
    for (const key of ["revenues", "nights"]) if (Array.isArray(src[key]) && src[key].length === 12) base[mode][key] = src[key].map(v => Math.max(0, Number(v) || 0));
    if (mode === "multi" && Array.isArray(src.unitTypes) && src.unitTypes.length) {
      base.multi.unitTypes = src.unitTypes.slice(0, 12).map((row, index) => ({
        name: String(row?.name || `Tipologia ${index + 1}`),
        units: Math.max(0, Number(row?.units) || 0),
        multiplier: Math.max(0, Number(row?.multiplier) || 0),
      }));
    }
  }
  base.mode = cleanMode;
  return base;
}

state = makeInitialState();

function makeInitialState() {
  const sheets = {};
  for (const sheet of DATA.sheets) {
    const cells = {};
    for (const row of sheet.rows) {
      for (const cell of row.cells) {
        const addr = normAddr(cell.a);
        cells[addr] = {
          v: coerceLoadedValue(cell.v),
          f: cell.f || null,
          cached: coerceLoadedValue(cell.cached),
          s: cell.s || null,
          comment: cell.comment || null,
        };
      }
    }
    sheets[sheet.name] = { cells };
  }
  const saved = loadSavedState();
  if (saved && saved.sheets) {
    for (const [sheetName, cells] of Object.entries(saved.sheets)) {
      if (!sheets[sheetName]) continue;
      for (const [addr, value] of Object.entries(cells)) {
        const a = normAddr(addr);
        if (!sheets[sheetName].cells[a]) sheets[sheetName].cells[a] = { v: null, f: null, cached: null, s: null };
        if (!sheets[sheetName].cells[a].f) sheets[sheetName].cells[a].v = coerceLoadedValue(value);
      }
    }
  }
  const strategies = mergeStrategyState(saved?.strategies);
  if (saved?.calcEngineVersion !== CALC_ENGINE_VERSION) {
    for (const groupId of ["ville_luxury", "case_economy", "case_vacanze"]) {
      if (!strategies[groupId].seasonalityBaseWeights) strategies[groupId].seasonalityBaseWeights = {};
      for (const rule of SEASONALITY_RULES) strategies[groupId].seasonalityBaseWeights[rule.id] = rule.id === "altissima" ? 1 : 0.90;
    }
    const romiba = strategies.city_roma;
    if (romiba) {
      const currentWeights = romiba.seasonalityBaseWeights || {};
      const legacyUniformProfile = SEASONALITY_RULES
        .filter(rule => rule.id !== "altissima")
        .every(rule => Math.abs((Number(currentWeights[rule.id]) || 1) - 1) < 0.000001);
      if (legacyUniformProfile) romiba.seasonalityBaseWeights = defaultCategorySeasonalityBaseWeights("city_roma");
      if (!Number.isFinite(Number(romiba.weekendBaseMarkup))) romiba.weekendBaseMarkup = defaultCategoryWeekendBaseMarkup("city_roma");
    }
  }
  applyStrategyPresets(strategies, saved?.strategyPresetVersion);
  ensureVilleLuxuryAirbnbMobileMapping(strategies);
  for (const groupState of Object.values(strategies)) {
    for (const planState of Object.values(groupState.ratePlans || {})) {
      planState.genius1 = 0;
      planState.genius2 = 0;
      planState.preferred = (Number(planState.preferred) || 0) > 0 ? 0.05 : 0;
    }
  }
  const strategySimulation = { checkIn: "", checkOut: "", nights: 1, contextByGroup: {}, ...(saved?.strategySimulation || {}) };
  strategySimulation.contextByGroup = strategySimulation.contextByGroup || {};
  const bookingPreferred = { target: 0.22, commissionBase: 0.18, commissionVat: 0.22, ...(saved?.bookingPreferred || {}) };
  const pricingInputs = {
    netCanone: 0,
    plExtra: 0,
    postPlMarkup: toNumber(saved?.pricingInputs?.postPlMarkup) || 0,
    nrPublished: 0,
  };
  const forecast = mergeForecastState(saved?.forecast);
  return { sheets, customPromos: saved?.customPromos || [], seasonality: saved?.seasonality || "altissima", strategies, strategySimulation, bookingPreferred, pricingInputs, forecast, touristTaxEdits: saved?.touristTaxEdits || {}, touristTaxRuleEdits: saved?.touristTaxRuleEdits || {}, simulationHistory: saved?.simulationHistory || [], strategyPresetVersion: STRATEGY_PRESET_VERSION, calcEngineVersion: CALC_ENGINE_VERSION, logs: saved?.logs || [{ t: now(), msg: "App inizializzata dal workbook Excel originale" }] };
}

function loadSavedState() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; }
}
function serializeEditableState(options = {}) {
  const out = { version: 4, savedAt: new Date().toISOString(), sheets: {}, customPromos: state.customPromos || [], seasonality: state.seasonality || "altissima", strategies: state.strategies || defaultStrategyState(), strategySimulation: state.strategySimulation || { checkIn: "", checkOut: "", nights: 1, contextByGroup: {} }, bookingPreferred: state.bookingPreferred || { target: 0.22, commissionBase: 0.18, commissionVat: 0.22 }, pricingInputs: state.pricingInputs || { netCanone: nrBase(), plExtra: 0, nrPublished: nrBase() }, forecast: state.forecast || defaultForecastState(), touristTaxEdits: state.touristTaxEdits || {}, touristTaxRuleEdits: state.touristTaxRuleEdits || {}, simulationHistory: options.includeSimulationHistory === false ? [] : (state.simulationHistory || []), strategyPresetVersion: state.strategyPresetVersion || STRATEGY_PRESET_VERSION, calcEngineVersion: state.calcEngineVersion || CALC_ENGINE_VERSION, logs: state.logs.slice(-200) };
  for (const [sheetName, sheet] of Object.entries(state.sheets)) {
    out.sheets[sheetName] = {};
    for (const [addr, cell] of Object.entries(sheet.cells)) if (!cell.f) out.sheets[sheetName][addr] = cell.v;
  }
  return out;
}
function applyStrategyPresets(strategies, savedVersion = "") {
  if (savedVersion === STRATEGY_PRESET_VERSION) return;
  const bookingPresets = [
    ["bb_standard", "lm3", 0.30],
    ["bb_standard", "lm7", 0.25],
    ["bb_standard", "lm14", 0.20],
    ["bb_standard", "lm21", 0.15],
    ["bb_standard", "los7", 0.10],
    ["bb_lux", "lm3", 0.30],
    ["bb_lux", "lm7", 0.25],
    ["bb_lux", "lm14", 0.20],
    ["bb_lux", "los7", 0.10],
  ];
  // I preset storici Booking si applicano solo a una nuova configurazione.
  // In questo modo un aggiornamento non sovrascrive le scelte gia salvate.
  if (!savedVersion) {
    for (const [groupId, rowId, discount] of bookingPresets) {
      const cfg = strategies?.[groupId]?.discounts?.[rowId];
      if (!cfg) continue;
      cfg.active = "SI";
      cfg.discount = discount;
      cfg.otas.booking = "SI";
      if (!cfg.otaDiscounts) cfg.otaDiscounts = {};
      cfg.otaDiscounts.booking = discount;
    }
  }
  const airbnbPresets = [
    ["bb_standard", "lm3", 0.30],
    ["bb_standard", "lm7", 0.25],
    ["bb_standard", "lm14", 0.20],
    ["bb_standard", "lm21", 0.15],
    ["bb_standard", "los7", 0.10],
    ["bb_standard", "pp60", 0.10],
  ];
  for (const [groupId, rowId, discount] of airbnbPresets) {
    const cfg = strategies?.[groupId]?.discounts?.[rowId];
    if (!cfg) continue;
    cfg.active = "SI";
    cfg.otas.airbnb = "SI";
    if (!cfg.otaDiscounts) cfg.otaDiscounts = {};
    cfg.otaDiscounts.airbnb = discount;
  }

  const bbStandardPresets = [
    ["lm3", 0.30], ["lm7", 0.25], ["lm14", 0.20], ["lm21", 0.15],
    ["los7", 0.10], ["pp60", 0.10],
  ];
  for (const [rowId, discount] of bbStandardPresets) {
    const cfg = strategies?.bb_standard?.discounts?.[rowId];
    if (!cfg) continue;
    cfg.active = "SI";
    cfg.discount = discount;
    if (!cfg.otaDiscounts) cfg.otaDiscounts = {};
    for (const ota of STRATEGY_OTAS) {
      cfg.otas[ota.id] = "SI";
      cfg.otaDiscounts[ota.id] = discount;
    }
  }

  const bbLuxPresets = new Map([
    ["lm3", 0.30], ["lm7", 0.25], ["lm14", 0.20],
    ["los7", 0.10], ["pp90", 0.10],
  ]);
  for (const row of STRATEGY_DISCOUNT_ROWS.filter(item => ["Last minute", "Prenota prima", "Long stay"].includes(item.family))) {
    const cfg = strategies?.bb_lux?.discounts?.[row.id];
    if (!cfg) continue;
    const discount = bbLuxPresets.get(row.id);
    cfg.active = discount === undefined ? "NO" : "SI";
    if (discount !== undefined) cfg.discount = discount;
    if (!cfg.otaDiscounts) cfg.otaDiscounts = {};
    for (const ota of STRATEGY_OTAS) {
      cfg.otas[ota.id] = discount === undefined ? "NO" : "SI";
      if (discount !== undefined) cfg.otaDiscounts[ota.id] = discount;
    }
  }

  const cityPomoPresets = new Map([
    ["lm3", 0.30], ["lm7", 0.20], ["lm14", 0.15], ["lm21", 0.10], ["lm28", 0.05],
    ["los7", 0.10], ["los28", 0.20], ["pp90", 0.05],
  ]);
  for (const row of STRATEGY_DISCOUNT_ROWS.filter(item => ["Last minute", "Prenota prima", "Long stay"].includes(item.family))) {
    const cfg = strategies?.city_pomo?.discounts?.[row.id];
    if (!cfg) continue;
    const discount = cityPomoPresets.get(row.id);
    cfg.active = discount === undefined ? "NO" : "SI";
    if (discount !== undefined) cfg.discount = discount;
    if (!cfg.otaDiscounts) cfg.otaDiscounts = {};
    for (const ota of STRATEGY_OTAS) {
      cfg.otas[ota.id] = discount === undefined ? "NO" : "SI";
      if (discount !== undefined) cfg.otaDiscounts[ota.id] = discount;
    }
  }

  const caseEconomyPresets = new Map([
    ["lm3", 0.30], ["lm7", 0.20], ["lm14", 0.15], ["lm21", 0.10], ["lm28", 0.05],
    ["los14", 0.10], ["los21", 0.15], ["los28", 0.20], ["pp120", 0.10],
  ]);
  for (const row of STRATEGY_DISCOUNT_ROWS.filter(item => ["Last minute", "Prenota prima", "Long stay"].includes(item.family))) {
    const cfg = strategies?.case_economy?.discounts?.[row.id];
    if (!cfg) continue;
    const discount = caseEconomyPresets.get(row.id);
    cfg.active = discount === undefined ? "NO" : "SI";
    if (discount !== undefined) cfg.discount = discount;
    if (!cfg.otaDiscounts) cfg.otaDiscounts = {};
    for (const ota of STRATEGY_OTAS) {
      cfg.otas[ota.id] = discount === undefined ? "NO" : "SI";
      if (discount !== undefined) cfg.otaDiscounts[ota.id] = discount;
    }
  }

  const caseVacanzePresets = new Map(caseEconomyPresets);
  for (const row of STRATEGY_DISCOUNT_ROWS.filter(item => ["Last minute", "Prenota prima", "Long stay"].includes(item.family))) {
    const cfg = strategies?.case_vacanze?.discounts?.[row.id];
    if (!cfg) continue;
    const discount = caseVacanzePresets.get(row.id);
    cfg.active = discount === undefined ? "NO" : "SI";
    if (discount !== undefined) cfg.discount = discount;
    if (!cfg.otaDiscounts) cfg.otaDiscounts = {};
    for (const ota of STRATEGY_OTAS) {
      cfg.otas[ota.id] = discount === undefined ? "NO" : "SI";
      if (discount !== undefined) cfg.otaDiscounts[ota.id] = discount;
    }
  }

  const villePresets = [
    ["lm7", 0.30], ["lm14", 0.25], ["lm21", 0.20], ["lm28", 0.15], ["lm45", 0.10], ["lm60", 0.05],
    ["los14", 0.10], ["los21", 0.15], ["los28", 0.20], ["pp150", 0.10],
  ];
  for (const [rowId, discount] of villePresets) {
    const cfg = strategies?.ville?.discounts?.[rowId];
    if (!cfg) continue;
    cfg.active = "SI";
    cfg.discount = discount;
    if (!cfg.otaDiscounts) cfg.otaDiscounts = {};
    for (const ota of STRATEGY_OTAS) {
      cfg.otas[ota.id] = "SI";
      cfg.otaDiscounts[ota.id] = discount;
    }
  }

  const villeLuxuryPresets = new Map([
    ["lm7", 0.30], ["lm14", 0.25], ["lm21", 0.20], ["lm28", 0.15], ["lm45", 0.10], ["lm60", 0.05],
    ["los14", 0.10], ["los21", 0.15], ["los28", 0.20], ["pp210", 0.10],
  ]);
  for (const row of STRATEGY_DISCOUNT_ROWS.filter(item => ["Last minute", "Prenota prima", "Long stay"].includes(item.family))) {
    const cfg = strategies?.ville_luxury?.discounts?.[row.id];
    if (!cfg) continue;
    const discount = villeLuxuryPresets.get(row.id);
    cfg.active = discount === undefined ? "NO" : "SI";
    if (discount !== undefined) cfg.discount = discount;
    if (!cfg.otaDiscounts) cfg.otaDiscounts = {};
    for (const ota of STRATEGY_OTAS) {
      cfg.otas[ota.id] = discount === undefined ? "NO" : "SI";
      if (discount !== undefined) cfg.otaDiscounts[ota.id] = discount;
    }
  }

  // Ogni categoria deve poter usare lo stesso catalogo promo e lo stesso
  // motore di BB STANDARD. Completa soltanto le OTA ancora prive di mapping,
  // senza sovrascrivere percentuali o attivazioni gia configurate.
  const template = strategies?.bb_standard?.discounts || {};
  const exactTimingPolicyGroups = new Set(["bb_lux", "ville", "ville_luxury", "city_pomo", "case_economy", "case_vacanze"]);
  for (const group of STRATEGY_GROUPS) {
    if (group.id === "bb_standard") continue;
    const discounts = strategies?.[group.id]?.discounts || {};
    for (const ota of STRATEGY_OTAS) {
      for (const row of STRATEGY_DISCOUNT_ROWS) {
        if (exactTimingPolicyGroups.has(group.id) && ["Last minute", "Prenota prima", "Long stay"].includes(row.family)) continue;
        const source = template[row.id];
        const target = discounts[row.id];
        if (!source || !target || source.active !== "SI" || source.otas?.[ota.id] !== "SI") continue;
        if (target.active === "SI" && target.otas?.[ota.id] === "SI") continue;
        target.active = "SI";
        target.otas[ota.id] = "SI";
        if (!target.otaDiscounts) target.otaDiscounts = {};
        target.otaDiscounts[ota.id] = Number(source.otaDiscounts?.[ota.id] ?? source.discount) || 0;
      }
    }
  }
}

function ensureVilleLuxuryAirbnbMobileMapping(strategies) {
  const mobileIds = ["mobile1", "mobile2"];
  const configuredDiscount = groupId => Math.max(0, ...mobileIds.map(rowId => {
    const cfg = strategies?.[groupId]?.discounts?.[rowId];
    if (cfg?.active !== "SI" || cfg.otas?.airbnb !== "SI") return 0;
    return Number(cfg.otaDiscounts?.airbnb ?? cfg.discount) || 0;
  }));

  if (configuredDiscount("ville_luxury") > 0) return;

  const target = strategies?.ville_luxury?.discounts?.mobile1;
  if (!target) return;
  const referenceDiscount = Math.max(
    configuredDiscount("bb_standard"),
    configuredDiscount("city_roma"),
    0.10,
  );
  target.active = "SI";
  target.discount = referenceDiscount;
  target.otas.airbnb = "SI";
  if (!target.otaDiscounts) target.otaDiscounts = {};
  target.otaDiscounts.airbnb = referenceDiscount;
}
function defaultStrategyState() {
  const out = {};
  for (const group of STRATEGY_GROUPS) {
    out[group.id] = { discounts: {}, restrictions: [], conditions: {}, ratePlans: {}, seasonalityMarkups: defaultCategorySeasonalityMarkups(group.id), seasonalityBaseWeights: defaultCategorySeasonalityBaseWeights(group.id), weekendBaseMarkup: defaultCategoryWeekendBaseMarkup(group.id), manualConditionTotal: null, manualOtaCostTotal: null, manualOtaCostTotals: { booking: null, expedia: null, airbnb: null, vrbo: null }, peakSeasonStart: "", peakSeasonEnd: "" };
    for (const row of STRATEGY_DISCOUNT_ROWS) {
      const otas = {};
      const otaDiscounts = {};
      otas.site = "NO";
      otaDiscounts.site = row.defaultDiscount ?? 0.10;
      for (const ota of STRATEGY_OTAS) otas[ota.id] = "NO";
      for (const ota of STRATEGY_OTAS) otaDiscounts[ota.id] = row.defaultDiscount ?? 0.10;
      out[group.id].discounts[row.id] = { active: "NO", discount: row.defaultDiscount ?? 0.10, otas, otaDiscounts };
    }
    for (const plan of STRATEGY_RATE_PLANS.filter(p => p.groupId === group.id)) {
      out[group.id].ratePlans[plan.id] = { active: "SI", ota: plan.ota, baseMarkup: plan.defaultBaseMarkup ?? 0.15, genius1: plan.fixedAirbnbDiscount ? 0.10 : 0, genius2: 0, preferred: 0 };
    }
    for (const row of STRATEGY_CONDITION_ROWS) {
      const otas = {};
      for (const ota of STRATEGY_OTAS) otas[ota.id] = "NO";
      out[group.id].conditions[row.id] = { active: "NO", basis: "unit", period: "stay", amount: 0, valueType: "eur", otas };
    }
  }
  return out;
}
function mergeStrategyState(saved = {}) {
  const base = defaultStrategyState();
  for (const group of STRATEGY_GROUPS) {
    const src = saved?.[group.id];
    if (!src) continue;
    base[group.id].manualConditionTotal = src.manualConditionTotal === null || src.manualConditionTotal === undefined || src.manualConditionTotal === ""
      ? null
      : Math.max(0, Number(src.manualConditionTotal) || 0);
    base[group.id].manualOtaCostTotal = src.manualOtaCostTotal === null || src.manualOtaCostTotal === undefined || src.manualOtaCostTotal === ""
      ? null
      : Math.max(0, Number(src.manualOtaCostTotal) || 0);
    for (const ota of STRATEGY_OTAS) {
      const saved = src.manualOtaCostTotals?.[ota.id];
      base[group.id].manualOtaCostTotals[ota.id] = saved === null || saved === undefined || saved === ""
        ? (ota.id === "booking" ? base[group.id].manualOtaCostTotal : null)
        : Math.max(0, Number(saved) || 0);
    }
    base[group.id].peakSeasonStart = /^\d{4}-\d{2}-\d{2}$/.test(String(src.peakSeasonStart || "")) ? src.peakSeasonStart : "";
    base[group.id].peakSeasonEnd = /^\d{4}-\d{2}-\d{2}$/.test(String(src.peakSeasonEnd || "")) ? src.peakSeasonEnd : "";
    for (const rule of SEASONALITY_RULES) {
      const savedMarkup = Number(src.seasonalityMarkups?.[rule.id]);
      if (Number.isFinite(savedMarkup) && savedMarkup >= 0) base[group.id].seasonalityMarkups[rule.id] = savedMarkup;
      const savedWeight = Number(src.seasonalityBaseWeights?.[rule.id]);
      if (Number.isFinite(savedWeight) && savedWeight > 0) base[group.id].seasonalityBaseWeights[rule.id] = savedWeight;
    }
    const savedWeekendMarkup = Number(src.weekendBaseMarkup);
    if (Number.isFinite(savedWeekendMarkup) && savedWeekendMarkup >= 0) base[group.id].weekendBaseMarkup = savedWeekendMarkup;
    base[group.id].restrictions = Array.isArray(src.restrictions) ? src.restrictions : [];
    if (src.conditions && !Array.isArray(src.conditions)) {
      for (const [conditionId, conditionState] of Object.entries(src.conditions)) {
        if (!base[group.id].conditions[conditionId]) continue;
        base[group.id].conditions[conditionId].active = String(conditionState.active || "NO").toUpperCase() === "SI" ? "SI" : "NO";
        base[group.id].conditions[conditionId].basis = ["person", "unit"].includes(conditionState.basis) ? conditionState.basis : "unit";
        base[group.id].conditions[conditionId].period = ["night", "stay"].includes(conditionState.period) ? conditionState.period : "stay";
        base[group.id].conditions[conditionId].amount = Number.isFinite(Number(conditionState.amount)) ? Number(conditionState.amount) : 0;
        base[group.id].conditions[conditionId].valueType = conditionState.valueType === "pct" ? "pct" : "eur";
        for (const ota of STRATEGY_OTAS) {
          base[group.id].conditions[conditionId].otas[ota.id] = String(conditionState.otas?.[ota.id] || "NO").toUpperCase() === "SI" ? "SI" : "NO";
        }
      }
    }
    if (src.ratePlans && !Array.isArray(src.ratePlans)) {
      for (const plan of STRATEGY_RATE_PLANS.filter(item => item.groupId === group.id)) {
        const planId = plan.id;
        const legacyAirbnbId = group.id === "bb_standard" ? "bb_standard_airbnb_daily_rate" : `${group.id}_airbnb_standard_rate`;
        const baseAirbnbPlanId = plan.airbnbMobileVariant ? planId.replace(/_mobile$/, "") : "";
        const planState = src.ratePlans[planId]
          || (baseAirbnbPlanId ? src.ratePlans[baseAirbnbPlanId] : null)
          || (plan.ota === "airbnb" ? src.ratePlans[legacyAirbnbId] : null);
        if (!planState || !base[group.id].ratePlans[planId]) continue;
        base[group.id].ratePlans[planId].active = String(planState.active || "SI").toUpperCase() === "NO" ? "NO" : "SI";
        base[group.id].ratePlans[planId].baseMarkup = Number.isFinite(Number(planState.baseMarkup)) ? Number(planState.baseMarkup) : base[group.id].ratePlans[planId].baseMarkup;
        base[group.id].ratePlans[planId].genius1 = plan.ota === "airbnb"
          ? (plan.fixedAirbnbDiscount ? 0.10 : 0)
          : (Number.isFinite(Number(planState.genius1)) ? Number(planState.genius1) : 0);
        base[group.id].ratePlans[planId].genius2 = Number.isFinite(Number(planState.genius2)) ? Number(planState.genius2) : 0;
        base[group.id].ratePlans[planId].preferred = Number.isFinite(Number(planState.preferred)) ? Number(planState.preferred) : 0;
      }
    }
    for (const row of STRATEGY_DISCOUNT_ROWS) {
      const current = src.discounts?.[row.id];
      if (!current) continue;
      base[group.id].discounts[row.id].active = String(current.active || "NO").toUpperCase() === "SI" ? "SI" : "NO";
      const savedDiscount = Number(current.discount);
      const shouldResetOptionalDefault = OPTIONAL_STRATEGY_ROWS.has(row.id)
        && base[group.id].discounts[row.id].active !== "SI"
        && [0.10, 0.15, 0.20].some(x => Math.abs(savedDiscount - x) < 0.00001);
      base[group.id].discounts[row.id].discount = shouldResetOptionalDefault ? 0 : (Number.isFinite(savedDiscount) ? savedDiscount : (row.defaultDiscount ?? 0.10));
      base[group.id].discounts[row.id].otas.site = String(current.otas?.site || "NO").toUpperCase() === "SI" ? "SI" : "NO";
      const savedSiteDiscount = Number(current.otaDiscounts?.site);
      base[group.id].discounts[row.id].otaDiscounts.site = Number.isFinite(savedSiteDiscount)
        ? savedSiteDiscount
        : base[group.id].discounts[row.id].discount;
      for (const ota of STRATEGY_OTAS) {
        if (!strategyRowSupportsOta(row, ota.id)) {
          base[group.id].discounts[row.id].otas[ota.id] = "NO";
          base[group.id].discounts[row.id].otaDiscounts[ota.id] = 0;
          continue;
        }
        base[group.id].discounts[row.id].otas[ota.id] = String(current.otas?.[ota.id] || "NO").toUpperCase() === "SI" ? "SI" : "NO";
        const savedOtaDiscount = Number(current.otaDiscounts?.[ota.id]);
        const fallbackDiscount = base[group.id].discounts[row.id].discount;
        const shouldResetOptionalOtaDefault = OPTIONAL_STRATEGY_ROWS.has(row.id)
          && base[group.id].discounts[row.id].active !== "SI"
          && base[group.id].discounts[row.id].otas[ota.id] !== "SI"
          && [0.10, 0.15, 0.20].some(x => Math.abs((Number.isFinite(savedOtaDiscount) ? savedOtaDiscount : savedDiscount) - x) < 0.00001);
        base[group.id].discounts[row.id].otaDiscounts[ota.id] = shouldResetOptionalOtaDefault ? 0 : (Number.isFinite(savedOtaDiscount) ? savedOtaDiscount : fallbackDiscount);
      }
    }
  }
  return base;
}
function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(serializeEditableState()));
  dirty = false;
  updateSaveState("Salvato nel browser");
}
function showSaveConfirmation(message = "Salvataggio completato") {
  const notice = document.getElementById("saveNotice");
  if (!notice) return;
  const text = String(message).replace(/^✓\s*/, "");
  notice.textContent = `✓ ${text}`;
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.classList.remove("visible");
  clearTimeout(showSaveConfirmation.timer);
  const token = String(Date.now());
  notice.dataset.noticeToken = token;
  requestAnimationFrame(() => {
    if (notice.dataset.noticeToken !== token) return;
    notice.classList.add("visible");
    showSaveConfirmation.timer = setTimeout(() => notice.classList.remove("visible"), 4500);
  });
}
function updateSaveState(msg) {
  document.getElementById("dirtyDot").classList.toggle("dirty", dirty);
  document.getElementById("saveState").textContent = msg || (dirty ? "Modifiche non salvate" : "Stato locale pronto");
}
function now() { return new Date().toLocaleString("it-IT"); }
function log(msg, meta = {}) { state.logs.unshift({ t: now(), msg, ...meta }); state.logs = state.logs.slice(0, 300); }

function normAddr(addr) { return String(addr || "").replace(/\$/g, "").toUpperCase(); }
function colToNum(col) { let n = 0; for (const ch of col.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n; }
function numToCol(n) { let s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function splitAddr(addr) { const m = normAddr(addr).match(/^([A-Z]+)(\d+)$/); return { col: m ? colToNum(m[1]) : 1, row: m ? Number(m[2]) : 1, colName: m ? m[1] : "A" }; }
function coerceLoadedValue(v) {
  if (v === undefined) return null;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return v;
}
function getCell(sheet, addr) {
  sheet = sheet || activeEvalSheet;
  addr = normAddr(addr);
  if (!state.sheets[sheet]) return { v: null, f: null, cached: null, s: null };
  if (!state.sheets[sheet].cells[addr]) state.sheets[sheet].cells[addr] = { v: null, f: null, cached: null, s: null };
  return state.sheets[sheet].cells[addr];
}
function rawValue(sheet, addr) {
  const c = getCell(sheet, addr);
  return c.f ? evalCell(sheet, addr) : c.v;
}
function evalCell(sheet, addr, visiting = new Set()) {
  sheet = sheet || activeEvalSheet;
  addr = normAddr(addr);
  const key = `${sheet}!${addr}`;
  if (evalCache.has(key)) return evalCache.get(key);
  const cell = getCell(sheet, addr);
  if (!cell.f) return cell.v;
  if (visiting.has(key)) return cell.cached ?? "#CYCLE";
  visiting.add(key);
  try {
    const ast = parseFormula(cell.f);
    const prev = activeEvalSheet;
    activeEvalSheet = sheet;
    const value = evaluate(ast, sheet, visiting);
    activeEvalSheet = prev;
    const clean = normalizeResult(value);
    evalCache.set(key, clean);
    visiting.delete(key);
    return clean;
  } catch (e) {
    visiting.delete(key);
    return cell.cached ?? "#ERR";
  }
}
function invalidate() {
  evalCache = new Map();
  pageRenderRevision += 1;
  pageDomCache.clear();
}
function policyRowFromAddr(addr) {
  const m = normAddr(addr).match(/^E(\d+)$/);
  if (!m) return null;
  const row = Number(m[1]);
  return isPolicyRow(row) ? row : null;
}
function isPolicyRow(row) {
  return (row >= 68 && row <= 87) || (row >= 92 && row <= 101) || (row >= 106 && row <= 117) || (row >= 121 && row <= 127);
}
function pageForPolicyRow(row) {
  if (row >= 68 && row <= 87) return "booking";
  if (row >= 92 && row <= 101) return "expedia";
  if (row >= 106 && row <= 117) return "airbnb";
  if (row >= 121 && row <= 127) return "vrbo";
  return null;
}
function isPolicyActiveCell(sheet, addr) { return sheet === "Basic_NR_markup" && policyRowFromAddr(addr); }
function effectivePolicyActive(addr) {
  const row = policyRowFromAddr(addr);
  const configured = getCell("Basic_NR_markup", addr).v;
  if (String(configured).toUpperCase() !== "SI") return configured;
  return val("Basic_NR_markup", `BJ${row}`);
}
function policyStatus(row) {
  const configured = getCell("Basic_NR_markup", `E${row}`).v;
  if (String(configured).toUpperCase() !== "SI") return "Disattiva";
  const status = val("Basic_NR_markup", `BJ${row}`);
  if (String(status).toUpperCase() === "SI") return hasDateWindow(row) ? "Attiva nel periodo" : "Attiva";
  return String(status || "NO");
}
function hasDateWindow(row) {
  return ["K","L","M","N","O","P"].some(c => val("Basic_NR_markup", `${c}${row}`) !== "");
}
function dateSerialToIso(v) {
  if (!v || typeof v !== "number") return "";
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
const MONTH_NAMES_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
function monthToNumber(v) {
  const n = toNumber(v);
  if (n >= 1 && n <= 12) return n;
  const idx = MONTH_NAMES_IT.findIndex(m => m.toLowerCase() === String(v || "").trim().toLowerCase());
  return idx >= 0 ? idx + 1 : 0;
}
function monthName(n) {
  const i = Math.floor(toNumber(n)) - 1;
  return MONTH_NAMES_IT[i] || "";
}
function datePartsToIso(row, cols) {
  const [dayCol, monthCol, yearCol] = cols;
  const day = toNumber(val("Basic_NR_markup", `${dayCol}${row}`));
  const month = monthToNumber(val("Basic_NR_markup", `${monthCol}${row}`));
  const year = toNumber(val("Basic_NR_markup", `${yearCol}${row}`));
  if (!day || !month || !year) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function isoToDateParts(iso) {
  if (!iso) return { day: "", month: "", year: "" };
  const [year, month, day] = iso.split("-").map(Number);
  return { day, month: monthName(month), year };
}
function dateInput(row, side) {
  const cols = side === "from" ? ["K","L","M"] : ["N","O","P"];
  const value = datePartsToIso(row, cols);
  return `<input class="date-window input-cell date-cell" type="date" data-date-row="${row}" data-date-side="${side}" value="${escapeHtml(value)}" />`;
}

const LOGIC_PRESETS_BY_OTA = {
  booking: [
    { id: "base_timing", label: "Booking Stay/Timing - dopo markup", category: "Stay/Timing", description: "Come Last minute, Early booker, LOS: si applica dopo stagionalita e markup OTA." },
    { id: "booking_genius", label: "Booking Genius / Premium", category: "Genius", description: "Entra nella famiglia Genius; viene combinata con targeting/catalogo o campagne secondo la logica Booking." },
    { id: "booking_targeting", label: "Booking Tariffe mirate", category: "Tariffe mirate", description: "Mobile, geolocalizzato, stato/paese: usa il massimo della famiglia targeting." },
    { id: "booking_catalog", label: "Booking Offerte catalogo", category: "Offerte catalogo", description: "Offerte portfolio/catalogo cumulabili nel percorso Genius + Targeting + Catalogo." },
    { id: "booking_campaign", label: "Booking Campagna", category: "Campagne", description: "Percorso Genius + Campagna; compete con catalogo/targeting secondo il fattore migliore." },
    { id: "booking_special", label: "Booking Offerte speciali", category: "Offerte speciali", description: "Black Friday/tempo limitato: percorso alternativo speciale, vince se genera lo sconto piu alto." },
    { id: "visible_only", label: "Solo calendario/evidenza Booking", category: "Evidenza", description: "Compare come promo Booking ma non cambia prezzo." },
  ],
  expedia: [
    { id: "base_timing", label: "Expedia promo timing - dopo markup", category: "Promozioni", description: "Early booking, same-day, multi-night, day-of-week: si applica dopo stagionalita e markup OTA." },
    { id: "expedia_audience", label: "Expedia Audience", category: "Audience", description: "Member-only e mobile-only: entra nella famiglia audience Expedia." },
    { id: "expedia_package", label: "Expedia Package/B2B", category: "Package/B2B", description: "Package rate, B2B/Opaque: entra nella famiglia package." },
    { id: "expedia_promotion", label: "Expedia Promozioni", category: "Promozioni", description: "Promo Expedia successive: cumulano come famiglia promozioni." },
    { id: "expedia_visibility", label: "Expedia visibilita/costo extra", category: "Visibilita", description: "Accelerator/TravelAds: evidenza gestionale o extra costo se configurato." },
    { id: "visible_only", label: "Solo calendario/evidenza Expedia", category: "Evidenza", description: "Compare come promo Expedia ma non cambia prezzo." },
  ],
  airbnb: [
    { id: "airbnb_non_refundable", label: "Airbnb non rimborsabile cumulabile", category: "Rate plan", description: "Termini NR: si cumula con la promo prioritaria Airbnb." },
    { id: "airbnb_los", label: "Airbnb LOS settimanale/mensile", category: "Length of stay", description: "Priorita LOS: tra settimanale/mensile usa la percentuale piu alta." },
    { id: "airbnb_timing", label: "Airbnb timing - dopo markup", category: "Timing", description: "Early/last/booking window: si applica dopo stagionalita e markup OTA." },
    { id: "airbnb_custom_priority", label: "Airbnb promo personalizzata", category: "Promo", description: "Custom promotion/Special offer: priorita personalizzata non cumulabile con altri prioritari." },
    { id: "airbnb_new_listing", label: "Airbnb nuovo annuncio priorita 1", category: "Promo", description: "Promozione nuovi annunci: massima priorita tra gli sconti Airbnb non cumulabili." },
    { id: "airbnb_special_cumulative", label: "Airbnb Special cumulabile", category: "Special", description: "High rated guest/mobile special: si somma alle altre Special e si cumula nel fattore Airbnb." },
    { id: "airbnb_seasonal", label: "Airbnb correzione stagionale", category: "Pricing tool", description: "Variazione positiva/negativa sempre cumulabile nel fattore Airbnb." },
    { id: "visible_only", label: "Solo calendario/evidenza Airbnb", category: "Evidenza", description: "Compare come promo Airbnb ma non cambia prezzo." },
  ],
  vrbo: [
    { id: "vrbo_new_listing", label: "Vrbo New Listing", category: "New listing", description: "Offerta nuovo annuncio, tenuta separata dalla priorita timing/member/mobile." },
    { id: "base_timing", label: "Vrbo Timing - dopo markup", category: "Timing", description: "Early Booking/Last Minute: si applica dopo stagionalita e markup OTA se vince secondo la priorita Vrbo." },
    { id: "vrbo_mobile", label: "Vrbo Mobile Deal", category: "Mobile", description: "Mobile Deal nella mono-applicabilita Vrbo." },
    { id: "vrbo_member", label: "Vrbo Member Only", category: "Member Only Deal", description: "Member Only Blue/Silver/Gold: usa la fascia piu alta e compete con timing/mobile." },
    { id: "vrbo_priority_max", label: "Vrbo mono-applicabilita", category: "Priorita", description: "Se piu promo sono attive vince la percentuale piu alta; a parita segue la priorita Vrbo." },
    { id: "visible_only", label: "Solo calendario/evidenza Vrbo", category: "Evidenza", description: "Compare come promo Vrbo ma non cambia prezzo." },
  ],
};
const LOGIC_PRESETS = Object.values(LOGIC_PRESETS_BY_OTA).flat();
function logicPresetsFor(page) { return LOGIC_PRESETS_BY_OTA[page] || LOGIC_PRESETS; }
function logicPreset(id, page = null) {
  const list = page ? logicPresetsFor(page) : LOGIC_PRESETS;
  return list.find(x => x.id === id) || LOGIC_PRESETS.find(x => x.id === id) || list[0] || LOGIC_PRESETS[0];
}
function categoriesFor(page) {
  return [...new Set(logicPresetsFor(page).map(p => p.category).filter(Boolean))];
}
function logicPresetsForCategory(page, category) {
  return logicPresetsFor(page).filter(p => p.category === category);
}
function logicOptionsHtml(page, category = null) {
  const scoped = category ? logicPresetsForCategory(page, category) : [];
  const list = scoped.length ? scoped : logicPresetsFor(page);
  return list.map(p => `<option value="${p.id}">${escapeHtml(p.label)}</option>`).join("");
}
function logicHelpHtml(page, category = null) {
  const scoped = category ? logicPresetsForCategory(page, category) : [];
  const list = scoped.length ? scoped : logicPresetsFor(page);
  return list.map(p => `<span><strong>${escapeHtml(p.label)}:</strong> ${escapeHtml(p.description)}</span>`).join("");
}
function pageForTitle(title) { return channelLink(title) || title; }
function titleForPage(page) {
  return { booking: "Booking.com", expedia: "Expedia", airbnb: "Airbnb", vrbo: "Vrbo" }[page] || page;
}
function customPromosFor(page) {
  return (state.customPromos || []).filter(p => p.ota === page);
}
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isCustomPromoActive(p) {
  if (String(p.active).toUpperCase() !== "SI") return false;
  const today = todayIso();
  return (!p.from || today >= p.from) && (!p.to || today <= p.to);
}
function customPromoStatus(p) {
  if (String(p.active).toUpperCase() !== "SI") return "Disattiva";
  if (!p.from && !p.to) return "Attiva";
  return isCustomPromoActive(p) ? "Attiva nel periodo" : "Fuori periodo";
}
function customDiscount(p) {
  const n = Number(p.discount);
  return Number.isFinite(n) ? Math.max(0, Math.min(.95, n)) : 0;
}
function customEffects() {
  const active = (state.customPromos || []).filter(isCustomPromoActive);
  const effects = {
    timingFactor: { booking: 1, expedia: 1, airbnb: 1, vrbo: 1 },
    otaFactor: { booking: 1, expedia: 1, airbnb: 1, vrbo: 1 },
    priority: { booking: 0, expedia: 0, airbnb: 0, vrbo: 0 },
    airbnbSpecial: 0,
    active,
  };
  for (const p of active) {
    const d = customDiscount(p);
    if (!d) continue;
    const behavior = logicBehavior(p.logic);
    if (behavior === "timing") effects.timingFactor[p.ota] *= (1 - d);
    else if (behavior === "cumulative") effects.otaFactor[p.ota] *= (1 - d);
    else if (behavior === "priority") effects.priority[p.ota] = Math.max(effects.priority[p.ota] || 0, d);
    else if (behavior === "airbnb_special") effects.airbnbSpecial += d;
  }
  for (const ota of Object.keys(effects.priority)) {
    if (effects.priority[ota] > 0) effects.otaFactor[ota] *= (1 - effects.priority[ota]);
  }
  if (effects.airbnbSpecial > 0) effects.otaFactor.airbnb *= (1 - Math.min(.95, effects.airbnbSpecial));
  return effects;
}
function logicBehavior(id) {
  if (id === "base_timing" || id === "airbnb_timing") return "timing";
  if (id === "airbnb_special_cumulative") return "airbnb_special";
  if (["booking_genius","booking_targeting","booking_catalog","booking_campaign","booking_special","expedia_audience","expedia_package","expedia_promotion","airbnb_los","airbnb_custom_priority","airbnb_new_listing","vrbo_mobile","vrbo_member","vrbo_priority_max"].includes(id)) return "priority";
  if (["airbnb_non_refundable","airbnb_seasonal","expedia_visibility","vrbo_new_listing"].includes(id)) return "cumulative";
  return "none";
}
function currentSeasonalityRule() {
  return SEASONALITY_RULES.find(r => r.id === state.seasonality) || SEASONALITY_RULES[0];
}
function seasonalityMarkup() {
  return currentSeasonalityRule().markup;
}
function nrBase() {
  return netCanoneValue();
}
function seasonalBase() {
  return pricingBaseForTargets();
}
function pricingBaseForTargets() {
  return netCanoneSeasonalValue();
}
function isStayTimingPolicy(row) {
  const haystack = [val("Basic_NR_markup", `B${row}`), promoName(row), promoDescription(row)].join(" ").toLowerCase();
  return /stay|timing|length of stay|last|early|prenota|anticipo|ravvicinat|los|settiman|mensil|multi-night|same-day|day-of-week|booking/.test(haystack);
}
function workbookTimingFactor(page) {
  const range = channelPolicyRange(page);
  if (!range) return 1;
  let factor = 1;
  for (let r = range[0]; r <= range[1]; r++) {
    if (!isStayTimingPolicy(r)) continue;
    if (String(effectivePolicyActive(`E${r}`)).toUpperCase() !== "SI") continue;
    factor *= 1 - Math.max(0, Math.min(.95, toNumber(val("Basic_NR_markup", `F${r}`))));
  }
  return factor;
}
function timingFactorFor(page, effects = customEffects()) {
  return Math.max(0.0001, workbookTimingFactor(page) * (effects.timingFactor[page] || 1));
}
function targetPctForPage(page) {
  return toNumber(val("Basic_NR_markup", { booking: "C6", airbnb: "C7", expedia: "C8", vrbo: "C9" }[page] || "C6"));
}
function targetAfterTiming(page, effects = customEffects()) {
  return seasonalBase() * (1 + targetPctForPage(page)) * timingFactorFor(page, effects);
}
function strategyEffectsForGroup(groupId, baseEffects = customEffects()) {
  const effects = {
    ...baseEffects,
    timingFactor: { ...baseEffects.timingFactor },
    otaFactor: { ...baseEffects.otaFactor },
    priority: { ...baseEffects.priority },
  };
  if (!groupId || !state.strategies?.[groupId]) return effects;
  for (const ota of STRATEGY_OTAS) {
    for (const item of activeStrategyRowsForSimulation(groupId, ota.id)) {
      effects.otaFactor[ota.id] *= 1 - Math.max(0, Math.min(.95, Number(item.cfg.discount) || 0));
    }
  }
  return effects;
}
function simulatedLeadDays() {
  const checkIn = state.strategySimulation?.checkIn;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(checkIn || ""))) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(`${checkIn}T00:00:00`);
  return Math.ceil((target - start) / 86400000);
}
function isoDateMs(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ""))) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function simulatedNights() {
  const checkInMs = isoDateMs(state.strategySimulation?.checkIn || "");
  const checkOutMs = isoDateMs(state.strategySimulation?.checkOut || "");
  if (checkInMs === null || checkOutMs === null) return null;
  const nights = Math.round((checkOutMs - checkInMs) / 86400000);
  return nights > 0 ? nights : null;
}
function peakSeasonWindow(groupId) {
  const cfg = state.strategies?.[groupId] || {};
  const start = isoDateMs(cfg.peakSeasonStart || "");
  const end = isoDateMs(cfg.peakSeasonEnd || "");
  return start !== null && end !== null && end >= start ? { start, end } : null;
}
function categorySeasonalityRuleMarkup(groupId, ruleId) {
  const fallback = SEASONALITY_RULES.find(rule => rule.id === ruleId)?.markup ?? 0;
  const configured = Number(state.strategies?.[groupId]?.seasonalityMarkups?.[ruleId]);
  return Number.isFinite(configured) && configured >= 0 ? configured : fallback;
}
function categorySeasonalityBaseWeight(groupId, ruleId) {
  const fallback = defaultCategorySeasonalityBaseWeights(groupId)[ruleId] ?? 1;
  const configured = Number(state.strategies?.[groupId]?.seasonalityBaseWeights?.[ruleId]);
  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}
function categoryWeekendBaseMarkup(groupId) {
  const fallback = defaultCategoryWeekendBaseMarkup(groupId);
  const configured = Number(state.strategies?.[groupId]?.weekendBaseMarkup);
  return Number.isFinite(configured) && configured >= 0 ? configured : fallback;
}
function categorySeasonalityBreakdown(groupId) {
  const cached = renderMemo?.seasonality.get(groupId);
  if (cached) return cached;
  const result = categorySeasonalityBreakdownUncached(groupId);
  renderMemo?.seasonality.set(groupId, result);
  return result;
}
function categorySeasonalityBreakdownUncached(groupId) {
  const selectedRule = currentSeasonalityRule();
  const nights = simulatedNights();
  const checkIn = isoDateMs(state.strategySimulation?.checkIn || "");
  const window = peakSeasonWindow(groupId);
  // La regola selezionata rappresenta la stagione del check-in. Quando il
  // soggiorno esce dal calendario Altissima, le notti successive passano ad
  // Alta stagione; non devono ereditare il 15% del giorno di arrivo.
  const fallbackRule = window && selectedRule.id === "altissima"
    ? (SEASONALITY_RULES.find(rule => rule.id === "alta") || selectedRule)
    : selectedRule;
  const baseMarkup = categorySeasonalityRuleMarkup(groupId, fallbackRule.id);
  const selectedMarkup = categorySeasonalityRuleMarkup(groupId, selectedRule.id);
  if (!groupId || !window || checkIn === null || !nights) {
    return { markup: selectedMarkup, nights: nights || 0, peakNights: 0, baseNights: nights || 0, baseMarkup: selectedMarkup, baseLabel: selectedRule.label, peakWeight: 1, baseWeight: categorySeasonalityBaseWeight(groupId, selectedRule.id), active: false };
  }
  let peakNights = 0;
  const nightProfile = [];
  const weekendMarkup = categoryWeekendBaseMarkup(groupId);
  for (let index = 0; index < nights; index++) {
    const nightDate = checkIn + index * 86400000;
    const isPeak = nightDate >= window.start && nightDate <= window.end;
    const ruleId = isPeak ? "altissima" : fallbackRule.id;
    const day = new Date(nightDate).getUTCDay();
    const isWeekend = day === 5 || day === 6;
    const nightBaseWeight = categorySeasonalityBaseWeight(groupId, ruleId) * (isWeekend ? (1 + weekendMarkup) : 1);
    const nightMarkup = categorySeasonalityRuleMarkup(groupId, ruleId);
    if (isPeak) peakNights++;
    nightProfile.push({ index, nightDate, ruleId, label: isPeak ? "Altissima" : fallbackRule.label, isPeak, isWeekend, baseWeight: nightBaseWeight, markup: nightMarkup });
  }
  const baseNights = nights - peakNights;
  const peakMarkup = categorySeasonalityRuleMarkup(groupId, "altissima");
  const peakWeight = categorySeasonalityBaseWeight(groupId, "altissima");
  const baseWeight = categorySeasonalityBaseWeight(groupId, fallbackRule.id);
  // I coefficienti base rappresentano il diverso valore giornaliero delle
  // stagioni. La percentuale effettiva e' quindi ponderata sull'incasso,
  // non soltanto sul numero di notti.
  const weightedBase = nightProfile.reduce((sum, night) => sum + night.baseWeight, 0);
  const weightedSeasonal = nightProfile.reduce((sum, night) => sum + night.baseWeight * (1 + night.markup), 0);
  const markup = weightedBase ? (weightedSeasonal / weightedBase) - 1 : baseMarkup;
  const mixedSeasonality = peakNights > 0 && baseNights > 0;
  return { markup, nights, peakNights, baseNights, peakMarkup, baseMarkup, peakWeight, baseWeight, weekendMarkup, nightProfile, weightedBase, weightedSeasonal, baseLabel: fallbackRule.label, active: mixedSeasonality };
}
function effectiveSeasonalityMarkup(groupId = "") {
  return groupId ? categorySeasonalityBreakdown(groupId).markup : seasonalityMarkup();
}
function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
function categorySeasonalNightComponents(groupId, sourceTotal = netCanoneValue()) {
  const breakdown = categorySeasonalityBreakdown(groupId);
  if (!breakdown.active || !breakdown.nights || !breakdown.weightedBase) return null;
  const referenceUnit = sourceTotal / breakdown.weightedBase;
  return breakdown.nightProfile.map(night => ({ ...night, baseNight: referenceUnit * night.baseWeight }));
}
function categorySeasonalTotal(groupId, sourceTotal = netCanoneValue()) {
  const breakdown = categorySeasonalityBreakdown(groupId);
  // Il valore resta a precisione piena per tutta la cascata. I due decimali
  // sono applicati soltanto quando il risultato viene mostrato nella UI.
  if (breakdown.active && breakdown.nights) {
    const nights = categorySeasonalNightComponents(groupId, sourceTotal);
    return nights.reduce((sum, night) => sum + night.baseNight * (1 + night.markup), 0);
  }
  return sourceTotal * (1 + effectiveSeasonalityMarkup(groupId));
}
function categoryTotalAfterPlanMarkup(groupId, sourceTotal, planMarkup) {
  const nights = categorySeasonalNightComponents(groupId, sourceTotal);
  if (nights) {
    return nights.reduce((sum, night) => sum + roundCurrency(night.baseNight * (1 + night.markup) * (1 + planMarkup)), 0);
  }
  return categorySeasonalTotal(groupId, sourceTotal) * (1 + planMarkup);
}
function strategyThreshold(row) {
  const m = String(row.code || "").match(/\d+/);
  return m ? Number(m[0]) : 0;
}
function highestDiscountRow(items, family) {
  return items
    .filter(item => item.row.family === family)
    .sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0))[0] || null;
}
function highestBookingGeniusLevel(items) {
  const levelPriority = { genius1: 1, genius2: 2, genius3: 3 };
  return items
    .filter(item => item.row.family === "Genius" && (Number(item.discount) || 0) > 0)
    .sort((a, b) => (levelPriority[b.row.id] || 0) - (levelPriority[a.row.id] || 0))[0] || null;
}
function lastMinuteForLead(items, leadDays) {
  if (leadDays === null || leadDays < 0) return null;
  return items
    .filter(item => item.row.id.startsWith("lm") && leadDays <= strategyThreshold(item.row))
    .sort((a, b) => strategyThreshold(a.row) - strategyThreshold(b.row))[0] || null;
}
function weightedLastMinute(items, leadDays, nights, options = {}) {
  if (leadDays === null || leadDays < 0) return null;
  const stayNights = Number(nights) > 0 ? Number(nights) : 1;
  const nightly = Array.from({ length: stayNights }, (_, offset) => lastMinuteForLead(items, leadDays + offset));
  const applied = nightly.filter(Boolean);
  if (!applied.length) return null;
  const distinctRows = [...new Map(applied.map(item => [item.row.id, item])).values()];
  if (options.singleTierWholeStay && distinctRows.length === 1) {
    const source = distinctRows[0];
    return {
      ...source,
      discount: Math.max(0, Math.min(.95, Number(source.discount) || 0)),
      weighted: false,
      wholeStay: true,
      // Booking estende l'unico scaglione LM rilevato all'intero soggiorno.
      nightly: Array.from({ length: stayNights }, () => source),
      eligibleNightly: nightly,
    };
  }
  const totalDiscount = nightly.reduce((sum, item) => {
    return sum + (item ? Math.max(0, Math.min(.95, Number(item.discount) || 0)) : 0);
  }, 0);
  const thresholds = [...new Set(applied.map(item => strategyThreshold(item.row)))].sort((a, b) => a - b);
  const source = applied[0];
  return {
    ...source,
    row: {
      ...source.row,
      id: `lm-weighted-${thresholds.join("-")}`,
      code: thresholds.length > 1 ? `LM ponderato ${thresholds.join("/")}` : source.row.code,
      note: thresholds.length > 1 ? `Last minute ponderato sulle ${stayNights} notti` : source.row.note,
    },
    discount: totalDiscount / stayNights,
    weighted: thresholds.length > 1,
    nightly,
  };
}
function weightedTimingStayDiscount(items, leadDays, nights) {
  if (leadDays === null || leadDays < 0 || !(Number(nights) > 0)) return null;
  const stayNights = Number(nights);
  const pp = items
    .filter(item => item.row.id.startsWith("pp") && leadDays >= strategyThreshold(item.row))
    .sort((a, b) => strategyThreshold(b.row) - strategyThreshold(a.row))[0] || null;
  const los = items
    .filter(item => item.row.id.startsWith("los") && stayNights >= strategyThreshold(item.row))
    .sort((a, b) => strategyThreshold(b.row) - strategyThreshold(a.row))[0] || null;
  const nightly = Array.from({ length: stayNights }, (_, offset) => {
    const lm = lastMinuteForLead(items, leadDays + offset);
    return [lm, pp, los]
      .filter(Boolean)
      .sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0))[0] || null;
  });
  const applied = nightly.filter(Boolean);
  if (!applied.length) return null;
  const discount = nightly.reduce((sum, item) => {
    return sum + (item ? Math.max(0, Math.min(.95, Number(item.discount) || 0)) : 0);
  }, 0) / stayNights;
  const source = applied[0];
  return {
    ...source,
    row: {
      ...source.row,
      id: `timing-stay-weighted-${[...new Set(applied.map(item => item.row.id))].join("-")}`,
      code: "Timing/Stay ponderato",
      note: `Priorita notte per notte sulle ${stayNights} notti`,
    },
    discount,
    weighted: true,
    nightly,
    pp,
    los,
  };
}
function bookingTimingStaySelections(items, leadDays, nights) {
  if (leadDays === null || leadDays < 0 || !(Number(nights) > 0)) return [];
  const lm = weightedLastMinute(items, leadDays, nights, { singleTierWholeStay: true });
  const pp = items
    .filter(item => item.row.id.startsWith("pp") && leadDays >= strategyThreshold(item.row))
    .sort((a, b) => strategyThreshold(b.row) - strategyThreshold(a.row))[0] || null;
  const los = items
    .filter(item => item.row.id.startsWith("los") && Number(nights) >= strategyThreshold(item.row))
    .sort((a, b) => strategyThreshold(b.row) - strategyThreshold(a.row))[0] || null;
  const timing = [lm, pp]
    .filter(Boolean)
    .sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0))[0] || null;
  // Quando il timing selezionato e un LM, Booking considera LM e LOS
  // alternativi: applica una sola volta quello con la percentuale maggiore.
  if (timing === lm && los) {
    const winner = (Number(los.discount) || 0) > (Number(lm.discount) || 0) ? los : lm;
    return [winner];
  }
  // PP resta alternativo al blocco LM e conserva il flusso gia esistente.
  return [timing, los].filter(Boolean);
}
function lastMinuteSimulation(groupId, otaId = "booking") {
  if (!groupId) return null;
  const items = STRATEGY_DISCOUNT_ROWS
    .filter(row => row.id.startsWith("lm"))
    .map(row => ({ row, cfg: strategyDiscountConfig(groupId, row.id) }))
    .filter(item => item.cfg.active === "SI" && item.cfg.otas?.[otaId] === "SI")
    .map(item => ({ ...item, discount: strategyOtaDiscount(item.cfg, otaId) }));
  return weightedLastMinute(items, simulatedLeadDays(), simulatedNights());
}
function lastMinuteBreakdown(groupId) {
  const bookingItems = STRATEGY_DISCOUNT_ROWS
    .filter(row => ["Last minute", "Prenota prima", "Long stay"].includes(row.family))
    .map(row => ({ row, cfg: strategyDiscountConfig(groupId, row.id) }))
    .filter(item => item.cfg.active === "SI" && item.cfg.otas?.booking === "SI")
    .map(item => ({ ...item, discount: strategyOtaDiscount(item.cfg, "booking") }));
  const weighted = weightedTimingStayDiscount(bookingItems, simulatedLeadDays(), simulatedNights());
  const bookingApplied = bookingTimingStaySelections(bookingItems, simulatedLeadDays(), simulatedNights());
  const bookingDiscount = 1 - discountFactorForItems(bookingApplied);
  if (!weighted && !bookingApplied.length) return "";
  const counts = new Map();
  const bookingLm = bookingApplied.find(item => item?.row?.family === "Last minute" && Array.isArray(item.nightly));
  const bookingLos = bookingApplied.find(item => item?.row?.family === "Long stay");
  const bookingNightly = bookingLm?.nightly
    || (bookingLos ? Array.from({ length: Math.max(1, Number(simulatedNights()) || 1) }, () => bookingLos) : weighted?.nightly)
    || [];
  bookingNightly.forEach(item => {
    const key = item ? item.row.id : "none";
    const current = counts.get(key) || { item, nights: 0 };
    current.nights += 1;
    counts.set(key, current);
  });
  const rows = [...counts.values()].map(entry => {
    const label = entry.item ? entry.item.row.code : "Nessuno scaglione LM";
    const discount = entry.item ? formatValue(entry.item.discount, "0.00%") : "0,00%";
    return `<tr><td>${escapeHtml(label)}</td><td class="num">${entry.nights}</td><td class="num">${discount}</td><td class="num">${formatValue(entry.nights * (Number(entry.item?.discount) || 0), "0.00%")}</td></tr>`;
  }).join("");
  return `<details class="lm-breakdown">
    <summary><span>Spacchettamento Timing/Stay</span><strong>${formatValue(bookingDiscount, "0.00%")}</strong><small>Booking: applicazione sequenziale</small></summary>
    <div class="lm-breakdown-body">
      <p>Booking applica Genius e Mobile/Paese; un unico LM vale sull'intero soggiorno, mentre piu LM distinti vengono ripartiti sulle rispettive notti. Se LM e LOS coincidono, applica soltanto quello con la percentuale maggiore.</p>
      ${bookingApplied.map((item, index) => `<div class="lm-weighted-result"><span>Booking · passaggio ${index + 1}: ${escapeHtml(item.row.code)}, ${item.wholeStay ? "intero soggiorno" : Array.isArray(item.nightly) ? "scaglioni notte per notte" : "intero soggiorno"}</span><strong>${formatValue(item.discount, "0.00%")}</strong></div>`).join("")}
      <div class="lm-weighted-result"><span>Booking · sconto Timing/Stay complessivo</span><strong>${formatValue(bookingDiscount, "0.00%")}</strong></div>
      <div class="table-wrap"><table><thead><tr><th>Scaglione</th><th class="num">Notti</th><th class="num">Sconto</th><th class="num">Peso</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="lm-weighted-result"><span>Sito diretto · Timing/Stay medio ponderato</span><strong>${formatValue(weighted?.discount || 0, "0.00%")}</strong></div>
    </div>
  </details>`;
}

function bookingLastMinuteSummary(groupId) {
  const lm = activeStrategyRowsForSimulation(groupId, "booking")
    .find(item => item?.row?.family === "Last minute" && Array.isArray(item.nightly));
  if (!lm) return "";
  if (lm.wholeStay) return `${lm.row.code} intero soggiorno`;
  const counts = new Map();
  lm.nightly.filter(Boolean).forEach(item => {
    const key = item.row.id;
    const current = counts.get(key) || { code: item.row.code, nights: 0 };
    current.nights += 1;
    counts.set(key, current);
  });
  return [...counts.values()]
    .map(item => `${item.code} ${item.nights} ${item.nights === 1 ? "notte" : "notti"}`)
    .join(" · ");
}
function discountFactorForItems(items) {
  return items.filter(Boolean).reduce((factor, item) => factor * (1 - Math.max(0, Math.min(.95, Number(item.discount) || 0))), 1);
}
function bookingRatePlanGeniusSelection(groupId) {
  const configs = STRATEGY_RATE_PLANS
    .filter(plan => plan.groupId === groupId && plan.ota === "booking")
    .map(plan => strategyRatePlanConfig(groupId, plan.id))
    .filter(cfg => cfg.active === "SI");
  const genius2 = Math.max(0, ...configs.map(cfg => Number(cfg.genius2) || 0));
  if (genius2 > 0) return { rowId: "genius2", discount: genius2 };
  const genius1 = Math.max(0, ...configs.map(cfg => Number(cfg.genius1) || 0));
  if (genius1 > 0) return { rowId: "genius1", discount: genius1 };
  return null;
}
function activeStrategyRowsForSimulation(groupId, otaId, options = {}) {
  const memoKey = `${groupId}|${otaId}|${JSON.stringify(options)}`;
  const cached = renderMemo?.activeStrategies.get(memoKey);
  if (cached) return cached;
  const result = activeStrategyRowsForSimulationUncached(groupId, otaId, options);
  renderMemo?.activeStrategies.set(memoKey, result);
  return result;
}
function activeStrategyRowsForSimulationUncached(groupId, otaId, options = {}) {
  let mapped = STRATEGY_DISCOUNT_ROWS.filter(row => strategyRowSupportsOta(row, otaId))
    .map(row => ({ row, cfg: strategyDiscountConfig(groupId, row.id) }))
    .filter(item => item.cfg.active === "SI" && item.cfg.otas[otaId] === "SI")
    .map(item => ({ ...item, discount: strategyOtaDiscount(item.cfg, otaId) }));
  if (otaId === "airbnb" && options.includeMobile === false) {
    mapped = mapped.filter(item => item.row.family !== "Mobile");
  }
  if (otaId === "booking") {
    const ratePlanGenius = bookingRatePlanGeniusSelection(groupId);
    mapped = mapped.filter(item => item.row.family !== "Genius");
    if (ratePlanGenius) {
      const row = STRATEGY_DISCOUNT_ROWS.find(item => item.id === ratePlanGenius.rowId);
      if (row) mapped.push({
        row,
        cfg: strategyDiscountConfig(groupId, row.id),
        discount: ratePlanGenius.discount,
        ratePlanDriven: true,
      });
    }
  }
  const lead = simulatedLeadDays();
  const nights = simulatedNights();
  const genius = otaId === "booking" ? highestBookingGeniusLevel(mapped) : highestDiscountRow(mapped, "Genius");
  const targetCandidate = mapped
    .filter(item => ["Mobile", "Paese"].includes(item.row.family))
    .sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0))[0] || null;
  // Booking applica Genius, se presente, e successivamente il maggiore tra
  // Mobile e Paese. Senza Genius il maggiore tra Mobile/Paese e il primo step.
  const target = targetCandidate;
  const campaign = highestDiscountRow(mapped, "Offerte");
  const otaPriority = mapped
    .filter(item => ["Genius", "Mobile", "Paese"].includes(item.row.family))
    .sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0))[0] || null;
  if (otaId === "booking") {
    const timingStay = bookingTimingStaySelections(mapped, lead, nights);
    const pathCatalog = [genius, target, ...timingStay].filter(Boolean);
    const pathCampaign = [genius, campaign].filter(Boolean);
    const factorCatalog = discountFactorForItems(pathCatalog);
    const factorCampaign = discountFactorForItems(pathCampaign);
    if (!pathCatalog.length && !pathCampaign.length) return [];
    return factorCampaign < factorCatalog ? pathCampaign : pathCatalog;
  }
  const lm = lastMinuteForLead(mapped, lead);
  const pp = lead === null || lead < 0 ? null : mapped
    .filter(item => item.row.id.startsWith("pp") && lead >= strategyThreshold(item.row))
    .sort((a, b) => strategyThreshold(b.row) - strategyThreshold(a.row))[0] || null;
  const los = nights === null ? null : mapped
    .filter(item => item.row.id.startsWith("los") && nights >= strategyThreshold(item.row))
    .sort((a, b) => strategyThreshold(b.row) - strategyThreshold(a.row))[0] || null;
  return [otaPriority, campaign, lm, pp, los].filter(Boolean);
}
function simulationContext(groupId) {
  if (!state.strategySimulation) state.strategySimulation = { checkIn: "", checkOut: "", nights: 1, contextByGroup: {} };
  if (!state.strategySimulation.contextByGroup) state.strategySimulation.contextByGroup = {};
  if (!state.strategySimulation.contextByGroup[groupId]) state.strategySimulation.contextByGroup[groupId] = { propertyName: "", comune: "", people: 1 };
  if (!Number.isFinite(Number(state.strategySimulation.contextByGroup[groupId].people))) state.strategySimulation.contextByGroup[groupId].people = 1;
  return state.strategySimulation.contextByGroup[groupId];
}
function touristTaxMunicipalities() {
  const nationalMunicipalities = Array.isArray(window.ITALIAN_MUNICIPALITIES)
    ? window.ITALIAN_MUNICIPALITIES
    : [];
  const taxMunicipalities = touristTaxRules().map(rule => rule.comune).filter(Boolean);
  return [...new Set([...nationalMunicipalities, ...taxMunicipalities])]
    .sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
}
function simulationMunicipalityList(groupId) {
  const context = simulationContext(groupId);
  return `<datalist id="simulation-comuni-${groupId}">${touristTaxMunicipalities().map(comune => `<option value="${escapeHtml(comune)}"></option>`).join("")}</datalist>
    <label class="simulation-property-field"><span>Struttura / immobile</span><input class="input-cell" data-simulation-context="propertyName" data-simulation-group="${groupId}" value="${escapeHtml(context.propertyName || "")}" placeholder="Nome struttura"></label>
    <label class="simulation-municipality-field"><span>Comune</span><input class="input-cell" list="simulation-comuni-${groupId}" data-simulation-context="comune" data-simulation-group="${groupId}" value="${escapeHtml(context.comune || "")}" placeholder="Cerca Comune"></label>`;
}
function touristTaxComparable(value) {
  return String(value || "").trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("it-IT");
}
function simulationTouristTax(groupId) {
  const cached = renderMemo?.touristTax.get(groupId);
  if (cached) return cached;
  const result = simulationTouristTaxUncached(groupId);
  renderMemo?.touristTax.set(groupId, result);
  return result;
}
function simulationTouristTaxUncached(groupId) {
  const context = simulationContext(groupId);
  const people = Math.max(1, Math.round(Number(context.people) || 1));
  const nights = Math.max(0, Number(simulatedNights()) || 0);
  const comune = touristTaxComparable(context.comune);
  const candidates = touristTaxRules().filter(rule => rule.active && touristTaxComparable(rule.comune) === comune);
  const rule = candidates.find(item => item.primary) || candidates.sort((a, b) => b.uses - a.uses)[0] || null;
  const taxableNights = rule ? Math.min(nights, rule.maxNights > 0 ? rule.maxNights : nights) : 0;
  const rate = rule ? Math.max(0, Number(rule.rate) || 0) : 0;
  return { rule, people, nights, taxableNights, rate, total: rate * people * taxableNights };
}
function simulationTouristTaxFields(groupId) {
  const tax = simulationTouristTax(groupId);
  const ruleTitle = tax.rule ? `${tax.rule.comune}: massimo ${tax.rule.maxNights || tax.nights} notti tassabili` : "Seleziona un Comune con regola mappata";
  return `<div class="simulation-tax-group" title="${escapeHtml(ruleTitle)}">
    <label><span>Persone</span><input class="input-cell" type="number" min="1" step="1" data-simulation-context="people" data-simulation-group="${groupId}" value="${tax.people}"></label>
    <div class="simulation-tax-box"><span>Quota/persona</span><strong>${tax.rule ? `€ ${formatValue(tax.rate)} / notte` : "—"}</strong></div>
    <div class="simulation-tax-box total"><span>Totale tassa</span><strong>${tax.rule ? `€ ${formatValue(tax.total)}` : "—"}</strong><small>${tax.rule ? `${tax.taxableNights} ${tax.taxableNights === 1 ? "notte" : "notti"}` : "Comune non mappato"}</small></div>
  </div>`;
}
function strategySimulationPanel(groupId = "") {
  const checkIn = state.strategySimulation?.checkIn || "";
  const checkOut = state.strategySimulation?.checkOut || "";
  const nights = simulatedNights();
  const lead = simulatedLeadDays();
  const leadText = lead === null ? "Nessuna data attiva: LM, PP e LOS non vengono applicate" : lead < 0 ? "Data arrivo gia passata: nessun LM/PP applicato" : `${lead} giorni all'arrivo`;
  const nightsText = nights === null ? "Notti non calcolate" : `${nights} ${nights === 1 ? "notte" : "notti"}`;
  const groupCfg = state.strategies?.[groupId] || {};
  const seasonal = groupId ? categorySeasonalityBreakdown(groupId) : null;
  const seasonalText = !groupId ? "" : seasonal?.active
    ? `${seasonal.peakNights} ${seasonal.peakNights === 1 ? "notte" : "notti"} Altissima al ${formatValue(seasonal.peakMarkup, "0.00%")} + ${seasonal.baseNights} ${seasonal.baseNights === 1 ? "notte" : "notti"} ${seasonal.baseLabel} al ${formatValue(seasonal.baseMarkup, "0.00%")} = markup effettivo ${formatValue(seasonal.markup, "0.00%")}`
    : `Markup della simulazione: ${seasonal?.baseLabel || currentSeasonalityRule().label} ${formatValue(seasonal?.markup ?? seasonalityMarkup(), "0.00%")} su tutte le notti`;
  const bookingLmText = groupId ? bookingLastMinuteSummary(groupId) : "";
  const applicationText = [seasonalText, bookingLmText ? `Booking: ${bookingLmText}` : ""].filter(Boolean).join(" · ");
  return `<section class="panel strategy-sim-panel">
    <div>
      <h3>Simulazione applicabilita</h3>
      <p>${escapeHtml(leadText)}. Booking applica LM/PP secondo le regole temporali e, se LM e LOS coincidono, mantiene soltanto lo sconto maggiore; il sito diretto mantiene il confronto notte per notte.</p>
    </div>
    ${groupId ? simulationMunicipalityList(groupId) : ""}
    <label>Data arrivo<input class="input-cell" type="date" data-strategy-sim="checkIn" value="${escapeHtml(checkIn)}"></label>
    <label>Data partenza<input class="input-cell" type="date" data-strategy-sim="checkOut" value="${escapeHtml(checkOut)}"></label>
    ${groupId ? simulationTouristTaxFields(groupId) : ""}
    <div class="nights-box"><span>Notti</span><strong>${escapeHtml(nightsText)}</strong></div>
    <button class="reset-dates-btn" data-strategy-reset-dates>Reset date</button>
    ${groupId ? `<button class="primary simulation-save-button" data-save-simulation="${groupId}">Salva simulazione</button>` : ""}
  </section>${groupId ? `<section class="panel peak-season-panel">
    <div><h3>Periodo Altissima stagione</h3><p>Estremi inclusi. Le notti comprese applicano automaticamente il markup Altissima; le altre usano la stagione selezionata.</p></div>
    <label>Valida dal<input class="input-cell" type="date" data-peak-season="start" data-peak-group="${groupId}" value="${escapeHtml(groupCfg.peakSeasonStart || "")}"></label>
    <label>Valida al<input class="input-cell" type="date" data-peak-season="end" data-peak-group="${groupId}" value="${escapeHtml(groupCfg.peakSeasonEnd || "")}"></label>
    <div class="seasonality-result"><span>Applicazione simulata</span><strong>${escapeHtml(applicationText)}</strong></div>
  </section>` : ""}${groupId ? lastMinuteBreakdown(groupId) : ""}`;
}
function dashboardRowsAdjusted(effects = customEffects()) {
  const rows = [21,22,23,24,25,26].map(r => ({ row: r, ch: val("Basic_NR_markup", `B${r}`), target: val("Basic_NR_markup", `C${r}`), fattore: val("Basic_NR_markup", `D${r}`), pub: val("Basic_NR_markup", `G${r}`), finale: val("Basic_NR_markup", `H${r}`), netto: val("Basic_NR_markup", `L${r}`), gap: val("Basic_NR_markup", `M${r}`), ctrl: val("Basic_NR_markup", `N${r}`) }));
  const base = seasonalBase();
  const directSource = toNumber(val("Basic_NR_markup", "C5")) || 1;
  rows[0] = { ...rows[0], target: base, fattore: 1, pub: base, finale: base, netto: toNumber(rows[0].netto) * safeRatio(base, directSource), gap: 0, markupPub: 0, ctrl: `Stagionalita ${formatValue(seasonalityMarkup(), "0%")}` };
  return rows.map((r, i) => {
    if (i === 0) return rows[0];
    const page = channelLink(r.ch);
    const target = targetAfterTiming(page, effects);
    const factor = Math.max(0.0001, toNumber(r.fattore) * (effects.otaFactor[page] || 1));
    const pub = target / factor;
    const finale = pub * factor;
    // Il confronto Netto OTA vs sito usa la sola provvigione base, senza IVA.
    const netto = finale * (1 - otaCommission(page));
    const directNet = toNumber(rows[0].netto) || 1;
    const timing = timingFactorFor(page, effects);
    const ctrl = timing < 0.9999 ? `Stagionalita + Stay/Timing ${formatValue(1 - timing, "0%")}` : `Stagionalita + markup OTA`;
    const markupPub = base ? pub / base - 1 : 0;
    return { ...r, target, fattore: factor, pub, finale, netto, gap: directNet ? netto / directNet - 1 : r.gap, markupPub, ctrl };
  });
}
function safeRatio(a, b) { return b ? a / b : 1; }

function pricingTargetPctForOta(otaId, preferred = false) {
  return otaId === "booking" && preferred ? bookingPreferredTargetValue() : targetPctForPage(otaId);
}
function minimumTargetForOta(otaId, preferred = false, tierBase = null) {
  const base = tierBase === null ? seasonalBase() : tierBase;
  const pct = pricingTargetPctForOta(otaId, preferred);
  const timing = preferred ? 1 : timingFactorFor(otaId);
  return base * (1 + pct) * timing;
}

function ratePlanDisplayName(plan) {
  const name = String(plan?.name || "");
  const lower = name.toLowerCase();
  if (lower.includes("not refundable") || lower.includes("not-refundable") || lower === "nr") return "NR";
  if (lower.includes("easy")) return "Easy";
  if (lower.includes("refund") || lower.includes("ref")) return "Ref";
  return name || "Piano";
}
function ratePlanNameCell(plan, detail = "") {
  return `<div class="rate-plan-name">
    <strong>${escapeHtml(plan.name)}</strong>
    <span class="rate-plan-tag">${escapeHtml(ratePlanDisplayName(plan))}</span>
    ${detail ? `<small>${escapeHtml(detail)}</small>` : ""}
  </div>`;
}

function tokenize(formula) {
  let s = String(formula || "").trim();
  if (s.startsWith("=")) s = s.slice(1);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '"') {
      let j = i + 1, text = "";
      while (j < s.length) { if (s[j] === '"') { if (s[j+1] === '"') { text += '"'; j += 2; continue; } break; } text += s[j++]; }
      tokens.push({ type: "string", value: text }); i = j + 1; continue;
    }
    const two = s.slice(i, i + 2);
    if ([">=", "<=", "<>"] .includes(two)) { tokens.push({ type: "op", value: two }); i += 2; continue; }
    if ("+-*/^&=><(),:!".includes(ch)) { tokens.push({ type: "op", value: ch }); i++; continue; }
    const num = s.slice(i).match(/^\d+(?:\.\d+)?%?/);
    if (num) { let v = num[0]; tokens.push({ type: "number", value: v.endsWith("%") ? Number(v.slice(0, -1)) / 100 : Number(v) }); i += v.length; continue; }
    const id = s.slice(i).match(/^\$?[A-Za-z_][A-Za-z0-9_\.]*\$?\d*|^\$?[A-Za-z]+\$?\d+/);
    if (id) { tokens.push({ type: "id", value: id[0].replace(/\$/g, "") }); i += id[0].length; continue; }
    i++;
  }
  return tokens;
}
function parseFormula(formula) {
  const tokens = tokenize(formula); let pos = 0;
  const peek = () => tokens[pos]; const take = v => { const t = tokens[pos]; if (!t || (v && t.value !== v)) throw new Error("parse"); pos++; return t; };
  function parseExpression(minPrec = 0) {
    let left = parseUnary();
    while (true) {
      const t = peek(); if (!t || t.type !== "op") break;
      const prec = precedence(t.value); if (prec < minPrec) break;
      const op = take().value;
      const right = parseExpression(prec + (op === "^" ? 0 : 1));
      left = { type: "binary", op, left, right };
    }
    return left;
  }
  function parseUnary() { const t = peek(); if (t && t.type === "op" && ["+", "-"].includes(t.value)) return { type: "unary", op: take().value, expr: parseUnary() }; return parsePrimary(); }
  function parsePrimary() {
    const t = peek(); if (!t) return { type: "value", value: null };
    if (t.type === "number" || t.type === "string") { take(); return { type: "value", value: t.value }; }
    if (t.value === "(") { take("("); const e = parseExpression(); take(")"); return e; }
    if (t.type === "id") {
      const id = take().value;
      if (peek()?.value === "(") {
        take("("); const args = [];
        if (peek()?.value !== ")") { do { args.push(parseExpression()); if (peek()?.value !== ",") break; take(","); } while (true); }
        take(")"); return { type: "call", name: id.toUpperCase(), args };
      }
      if (peek()?.value === "!") {
        take("!"); const refTok = take(); let ref = { type: "ref", sheet: id, addr: normAddr(refTok.value) };
        if (peek()?.value === ":") { take(":"); const end = normAddr(take().value); ref = { type: "range", sheet: id, start: ref.addr, end }; }
        return ref;
      }
      if (/^[A-Z]+\d+$/i.test(id)) {
        let ref = { type: "ref", sheet: null, addr: normAddr(id) };
        if (peek()?.value === ":") { take(":"); const end = normAddr(take().value); ref = { type: "range", sheet: null, start: ref.addr, end }; }
        return ref;
      }
      return { type: "name", value: id };
    }
    take(); return { type: "value", value: null };
  }
  return parseExpression();
}
function precedence(op) { return { "=":1, "<>":1, ">":1, "<":1, ">=":1, "<=":1, "&":2, "+":3, "-":3, "*":4, "/":4, "^":5 }[op] ?? -1; }

function evaluate(node, sheet, visiting) {
  if (!node) return null;
  if (node.type === "value") return node.value;
  if (node.type === "ref") return evalCell(node.sheet || sheet, node.addr, visiting);
  if (node.type === "range") return getRange(node.sheet || sheet, node.start, node.end, visiting);
  if (node.type === "unary") { const v = toNumber(evaluate(node.expr, sheet, visiting)); return node.op === "-" ? -v : v; }
  if (node.type === "binary") return evalBinary(node.op, evaluate(node.left, sheet, visiting), evaluate(node.right, sheet, visiting));
  if (node.type === "call") return evalCall(node.name, node.args, sheet, visiting);
  return null;
}
function evalBinary(op, a, b) {
  if (op === "&") return `${displayRaw(a)}${displayRaw(b)}`;
  if (["=", "<>", ">", "<", ">=", "<="].includes(op)) return compareValues(a, b, op);
  const x = toNumber(a), y = toNumber(b);
  if (op === "+") return x + y;
  if (op === "-") return x - y;
  if (op === "*") return x * y;
  if (op === "/") return y === 0 ? "#DIV/0!" : x / y;
  if (op === "^") return Math.pow(x, y);
  return null;
}
function evalCall(name, args, sheet, visiting) {
  const ev = i => evaluate(args[i], sheet, visiting);
  const vals = () => args.map(a => evaluate(a, sheet, visiting));
  if (name === "IF") return truthy(ev(0)) ? ev(1) : (args[2] ? ev(2) : false);
  if (name === "IFERROR") { const v = ev(0); return isError(v) ? ev(1) : v; }
  if (name === "AND") return vals().every(truthy);
  if (name === "OR") return vals().some(truthy);
  if (name === "NOT") return !truthy(ev(0));
  if (name === "ABS") return Math.abs(toNumber(ev(0)));
  if (name === "ISNUMBER") { const v = ev(0); return typeof v === "number" && Number.isFinite(v); }
  if (name === "LEFT") return String(displayRaw(ev(0))).slice(0, Math.max(0, Math.floor(toNumber(args[1] ? ev(1) : 1))));
  if (name === "DATE") return excelDate(new Date(Date.UTC(toNumber(ev(0)), toNumber(ev(1)) - 1, toNumber(ev(2)))));
  if (name === "DAY") { const d = dateFromExcel(toNumber(ev(0))); return d.getUTCDate(); }
  if (name === "MONTH") { const d = dateFromExcel(toNumber(ev(0))); return d.getUTCMonth() + 1; }
  if (name === "MAX") return Math.max(...flatten(vals()).map(toNumber));
  if (name === "MIN") return Math.min(...flatten(vals()).map(toNumber));
  if (name === "SUM") return flatten(vals()).reduce((s, v) => s + toNumber(v), 0);
  if (name === "PRODUCT") return flatten(vals()).reduce((p, v) => p * toNumber(v), 1);
  if (name === "COUNT") return flatten(vals()).filter(v => typeof v === "number" && !Number.isNaN(v)).length;
  if (name === "COUNTA") return flatten(vals()).filter(v => v !== null && v !== undefined && v !== "").length;
  if (name === "ROWS") { const r = evaluate(args[0], sheet, visiting); return r?.meta?.rows || (Array.isArray(r) ? r.length : 1); }
  if (name === "INDEX") {
    const r = evaluate(args[0], sheet, visiting);
    const rowArg = ev(1);
    const colArg = args[2] ? ev(2) : 1;
    if (isError(rowArg)) return rowArg;
    if (isError(colArg)) return colArg;
    const rowNum = Math.floor(toNumber(rowArg));
    const colNum = Math.floor(toNumber(colArg));
    if (rowNum < 1 || colNum < 1) return "#REF!";
    return r?.values?.[rowNum - 1]?.[colNum - 1] ?? "#REF!";
  }
  if (name === "MATCH") {
    const lookup = ev(0);
    const arr = flatten([evaluate(args[1], sheet, visiting)]);
    let idx = arr.findIndex(v => equalValues(v, lookup));
    if (idx < 0 && typeof lookup === "number" && lookup >= 1 && lookup <= 12 && arr.some(v => MONTH_NAMES_IT.includes(String(v)))) idx = Math.floor(lookup) - 1;
    return idx >= 0 ? idx + 1 : "#N/A";
  }
  if (name === "SUMIFS") return sumifs(args, sheet, visiting);
  if (name === "TODAY") return excelDate(new Date());
  return "#NAME?";
}
function getRange(sheet, start, end, visiting) {
  const a = splitAddr(start), b = splitAddr(end);
  const r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row), c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
  const values = [];
  for (let r = r1; r <= r2; r++) { const row = []; for (let c = c1; c <= c2; c++) row.push(evalCell(sheet, `${numToCol(c)}${r}`, visiting)); values.push(row); }
  values.meta = { rows: r2 - r1 + 1, cols: c2 - c1 + 1 };
  values.values = values;
  return values;
}
function sumifs(args, sheet, visiting) {
  const sumRange = evaluate(args[0], sheet, visiting); const sumVals = flatten([sumRange]); let total = 0;
  for (let i = 0; i < sumVals.length; i++) {
    let ok = true;
    for (let a = 1; a < args.length; a += 2) {
      const rangeVals = flatten([evaluate(args[a], sheet, visiting)]); const criteria = evaluate(args[a + 1], sheet, visiting);
      if (!criteriaMatch(rangeVals[i], criteria)) { ok = false; break; }
    }
    if (ok) total += toNumber(sumVals[i]);
  }
  return total;
}
function flatten(arr) { return arr.flatMap(v => v?.values ? v.values.flat() : Array.isArray(v) ? v.flat(Infinity) : [v]); }
function normalizeResult(v) { if (v?.values) return v.values; if (typeof v === "number" && !Number.isFinite(v)) return "#NUM!"; return v; }
function isError(v) { return typeof v === "string" && /^#/.test(v); }
function truthy(v) { if (Array.isArray(v)) v = flatten([v])[0]; if (typeof v === "string") return v !== "" && !isError(v) && v.toUpperCase() !== "FALSE"; return !!toNumber(v); }
function toNumber(v) { if (Array.isArray(v)) v = flatten([v])[0]; if (v === true) return 1; if (v === false || v === null || v === "") return 0; if (typeof v === "number") return v; if (typeof v === "string") { if (/^\d{4}-\d{2}-\d{2}/.test(v)) return excelDate(new Date(v)); const n = Number(v.replace(",", ".")); return Number.isFinite(n) ? n : 0; } return 0; }
function compareValues(a, b, op) { const na = numericComparable(a), nb = numericComparable(b); let res; if (na.ok && nb.ok) res = na.v - nb.v; else res = String(a ?? "").localeCompare(String(b ?? "")); return op === "=" ? res === 0 : op === "<>" ? res !== 0 : op === ">" ? res > 0 : op === "<" ? res < 0 : op === ">=" ? res >= 0 : res <= 0; }
function equalValues(a, b) { return compareValues(a, b, "="); }
function numericComparable(v) { if (typeof v === "number") return { ok: true, v }; if (typeof v === "string" && (v === "" || Number.isFinite(Number(v)))) return { ok: true, v: toNumber(v) }; if (typeof v === "boolean") return { ok: true, v: v ? 1 : 0 }; return { ok: false, v: 0 }; }
function criteriaMatch(v, c) { if (typeof c === "string") { const m = c.match(/^(>=|<=|<>|>|<|=)(.*)$/); if (m) return compareValues(v, parseMaybeNumber(m[2]), m[1]); } return equalValues(v, c); }
function parseMaybeNumber(v) { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : v; }
function excelDate(d) { return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86400000); }
function dateFromExcel(serial) { return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000); }
function policyLogMeta(row, action) {
  const ota = pageForPolicyRow(row);
  return ota ? { ota, action, promo: promoName(row), row } : {};
}
function policyChangeMessage(row, col, before, after, fallback) {
  const name = promoName(row);
  if (col === "E") {
    const b = String(before || "").toUpperCase();
    const a = String(after || "").toUpperCase();
    if (a === "SI" && b !== "SI") return `Attivata promo ${name}`;
    if (a !== "SI" && b === "SI") return `Disattivata promo ${name}`;
    return `Cambiato stato promo ${name}: ${displayRaw(before)} -> ${displayRaw(after)}`;
  }
  if (col === "F") return `Modificato sconto promo ${name}: ${formatValue(before, "0%")} -> ${formatValue(after, "0%")}`;
  return fallback;
}

function setCell(sheet, addr, value, label = null) {
  const cell = getCell(sheet, addr);
  if (cell.f) return;
  const before = cell.v;
  const after = normalizeInput(value, cell.s?.numFmt);
  if (String(before ?? "") === String(after ?? "")) return;
  const cleanAddr = normAddr(addr);
  undoStack.push({ sheet, addr: cleanAddr, before, after, label: label || `${sheet}!${addr}` });
  redoStack = [];
  cell.v = after;
  dirty = true;
  invalidate();
  const pos = splitAddr(cleanAddr);
  const isPolicyChange = sheet === "Basic_NR_markup" && isPolicyRow(pos.row) && ["E","F"].includes(pos.colName);
  const action = pos.colName === "E" ? (String(after).toUpperCase() === "SI" ? "attivazione" : "disattivazione") : "sconto";
  const msg = isPolicyChange ? policyChangeMessage(pos.row, pos.colName, before, after, label || `${sheet}!${addr}`) : `Modificato ${label || `${sheet}!${addr}`}: ${displayRaw(before)} -> ${displayRaw(after)}`;
  log(msg, isPolicyChange ? policyLogMeta(pos.row, action) : {});
  render();
  updateSaveState("Modifiche non salvate");
}
function applyChange(ch, direction) {
  const value = direction === "undo" ? ch.before : ch.after;
  if (ch.type === "window") {
    applyDateWindowCells(ch.row, ch.side, value);
  } else {
    getCell(ch.sheet, ch.addr).v = value;
  }
  invalidate();
  dirty = true;
  log(`${direction === "undo" ? "Annullata" : "Ripetuta"} modifica ${ch.label}`);
  render();
  updateSaveState("Modifiche non salvate");
}
function normalizeInput(value, numFmt) {
  if (value === "") return "";
  const text = String(value).trim();
  if (String(numFmt || "").includes("%")) return parsePercentInput(text, value);
  const pct = text.endsWith("%");
  const n = Number(text.replace("%", "").replace(",", "."));
  if (Number.isFinite(n)) return pct ? n / 100 : n;
  return value;
}
function parsePercentInput(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const pct = text.endsWith("%");
  const n = Number(text.replace("%", "").replace(",", "."));
  if (!Number.isFinite(n)) return fallback;
  if (pct) return n / 100;
  return Math.abs(n) > 1 ? n / 100 : n;
}
function percentInputValue(value) {
  const n = Number(value) || 0;
  return `${(n * 100).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 3 })}%`;
}
function coefficientInputValue(value) {
  const n = Number(value) || 0;
  return n.toLocaleString("it-IT", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
function percentDatalists() {
  return "";
}
function presetValuesForList(listId) {
  if (listId === "strategy-discount-options") return STRATEGY_DISCOUNT_VALUES;
  if (listId === "rate-markup-options") return RATE_PLAN_MARKUP_VALUES;
  if (listId === "post-pl-markup-options") return POST_PL_MARKUP_VALUES;
  return discountOptions(0).map(o => Number(o.value));
}
function editablePercentInput(value, attrs, listId = "discount-percent-options", extraClass = "", mode = "percent") {
  const displayValue = mode === "coefficient" ? coefficientInputValue(value) : percentInputValue(value);
  const options = presetValuesForList(listId).map(v => {
    const label = mode === "coefficient" ? coefficientInputValue(v) : formatValue(v, "0%");
    return `<option value="${v}">${escapeHtml(label)}</option>`;
  }).join("");
  return `<div class="percent-combo-wrap">
    <input class="input-cell percent-combo ${extraClass}" data-percent-mode="${mode}" value="${escapeHtml(displayValue)}" ${attrs}>
    <select class="input-cell percent-preset-select" data-percent-preset title="Seleziona valore da menu">
      <option value=""></option>${options}
    </select>
  </div>`;
}
function editableCoefficientPercentInput(value, attrs, listId = "rate-markup-options", extraClass = "") {
  return `<input class="input-cell percent-combo ${extraClass}" data-percent-mode="coefficient" value="${escapeHtml(coefficientInputValue(value))}" ${attrs}>`;
}
function displayRaw(v) { return v === null || v === undefined ? "" : String(v); }
function decimalsFromFormat(fmt, fallback = 2) {
  const m = String(fmt || "").match(/[.,](0+)/);
  return m ? m[1].length : fallback;
}
function formatValue(v, fmt = null, addr = "") {
  if (isError(v)) return v;
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") {
    if ((fmt && fmt.includes("%")) || /sconto|fattore|gap|markup|provvigione|iva/i.test(addr)) {
      const decimals = decimalsFromFormat(fmt, 2);
      return `${(v * 100).toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}%`;
    }
    return v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(v);
}
function val(sheet, addr) { return rawValue(sheet, addr); }
function fmt(sheet, addr) { return getCell(sheet, addr).s?.numFmt || null; }

function navigate(page, push = true, fresh = false) {
  if (fresh) clearPageDomCache(page);
  currentPage = page;
  if (push) {
    pageHistory = pageHistory.slice(0, pageIndex + 1);
    pageHistory.push(page);
    pageIndex = pageHistory.length - 1;
  }
  render(true);
}
function pageDomCacheKey(page = currentPage) {
  if (page === "dashboard") return `${page}:${dashboardStrategy || "general"}`;
  if (page === "inputs") return `${page}:${parameterStrategy || "general"}`;
  if (page === "strategies") return `${page}:${strategyPage || "index"}`;
  if (page === "workbook") return `${page}:${currentSheet || "default"}`;
  if (page === "rateslab") return `${page}:${ratesLab?.groupId || "default"}`;
  return page;
}
function clearPageDomCache(page) {
  const prefix = `${page}:`;
  for (const key of pageDomCache.keys()) {
    if (key === page || key.startsWith(prefix)) pageDomCache.delete(key);
  }
}
function renderNav() {
  const nav = document.getElementById("nav");
  if (!nav.dataset.ready) {
    nav.innerHTML = `${pages.map(p => `<button data-page="${p.id}">${p.label}</button>`).join("")}<button class="tool-nav-button" data-calculator-toggle>Calcolatrice scientifica</button>`;
    nav.querySelectorAll("button[data-page]").forEach(b => b.onclick = () => navigate(b.dataset.page));
    nav.querySelector("[data-calculator-toggle]").onclick = e => { e.preventDefault(); calculatorOpen = !calculatorOpen; render(); };
    nav.dataset.ready = "1";
  }
  nav.querySelectorAll("button[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === currentPage));
  nav.querySelector("[data-calculator-toggle]")?.classList.toggle("active", calculatorOpen);
  document.getElementById("pageBack").disabled = pageIndex <= 0;
  document.getElementById("pageForward").disabled = pageIndex >= pageHistory.length - 1;
  document.getElementById("undoBtn").disabled = undoStack.length === 0;
  document.getElementById("redoBtn").disabled = redoStack.length === 0;
}
function render(navigationOnly = false) {
  if (!navigationOnly) {
    pageRenderRevision += 1;
    pageDomCache.clear();
  }
  renderNav();
  const content = document.getElementById("content");
  const cacheKey = pageDomCacheKey();
  const cached = pageDomCache.get(cacheKey);
  if (navigationOnly && cached?.revision === pageRenderRevision) {
    content.replaceChildren(...cached.nodes);
    return;
  }
  renderMemo = {
    ratePlanSimulations: new Map(),
    activeStrategies: new Map(),
    seasonality: new Map(),
    touristTax: new Map(),
  };
  const map = { dashboard: renderDashboard, guide: renderTechnicalGuide, inputs: renderInputs, rateslab: renderRatesLab, booking: () => renderPromo("Booking.com", 31, 36, 68, 87), expedia: () => renderPromo("Expedia", 40, 45, 92, 101), airbnb: () => renderPromo("Airbnb", 49, 54, 106, 117), vrbo: () => renderPromo("Vrbo", 58, 64, 121, 127), master: renderMaster, rms: renderRms, roomnight: renderRoomNight, forecast: renderForecast, touristtax: renderTouristTax, strategies: renderStrategies, workbook: renderWorkbook, simulationhistory: renderSimulationHistory, log: renderLog };
  const html = `${percentDatalists()}${map[currentPage]()}${renderCalculatorPopup()}`;
  content.innerHTML = html;
  bindInputs(content);
  bindPageEvents(content);
  pageDomCache.set(cacheKey, {
    revision: pageRenderRevision,
    nodes: Array.from(content.childNodes),
  });
  renderMemo = null;
}
function head(title, sub) { return `<div class="page-head"><div><h2>${title}</h2><p>${sub}</p></div><span class="badge">${DATA.summary.formulaCount.toLocaleString("it-IT")} formule attive</span></div>`; }

function guidePercent(value) {
  const number = Math.max(0, Number(value) || 0) * 100;
  return `${number.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

function guideManualCost(value) {
  if (value === null || value === undefined || value === "") return "Dinamico da condizioni";
  return `€ ${Math.max(0, Number(value) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderTechnicalGuideLiveConfiguration() {
  const commissionRows = STRATEGY_OTAS.map(ota => `<tr>
    <td><b>${escapeHtml(ota.label)}</b></td>
    <td>${guidePercent(otaCommission(ota.id))}</td>
    <td>${ota.id === "booking" ? `${guidePercent(otaCommission("booking", true))} quando Preferred e attivo` : "Commissione standard"}</td>
  </tr>`).join("");
  const categoryRows = STRATEGY_GROUPS.map(group => {
    const groupState = state.strategies?.[group.id] || {};
    const activeDiscounts = STRATEGY_DISCOUNT_ROWS.filter(row => groupState.discounts?.[row.id]?.active === "SI");
    const mappings = activeDiscounts.reduce((total, row) => {
      const cfg = groupState.discounts?.[row.id] || {};
      return total + ["site", ...STRATEGY_OTAS.map(ota => ota.id)].filter(id => cfg.otas?.[id] === "SI").length;
    }, 0);
    const activePlans = STRATEGY_RATE_PLANS.filter(plan => plan.groupId === group.id && strategyRatePlanConfig(group.id, plan.id).active === "SI");
    const activeConditions = STRATEGY_CONDITION_ROWS.filter(row => groupState.conditions?.[row.id]?.active === "SI").length;
    return `<tr>
      <td><b>${escapeHtml(group.label)}</b>${group.subtitle ? `<small>${escapeHtml(group.subtitle)}</small>` : ""}</td>
      <td>${activePlans.length}</td><td>${activeDiscounts.length}</td><td>${mappings}</td><td>${activeConditions}</td>
      <td>${guideManualCost(groupState.manualConditionTotal)}</td>
      <td>${STRATEGY_OTAS.map(ota => `${escapeHtml(ota.label)}: ${guideManualCost(groupState.manualOtaCostTotals?.[ota.id])}`).join("<br>")}</td>
    </tr>`;
  }).join("");
  const planRows = STRATEGY_GROUPS.flatMap(group => STRATEGY_RATE_PLANS
    .filter(plan => plan.groupId === group.id)
    .map(plan => {
      const cfg = strategyRatePlanConfig(group.id, plan.id);
      const flags = [];
      if ((Number(cfg.genius1) || 0) > 0) flags.push(`Genius/NR ${guidePercent(cfg.genius1)}`);
      if ((Number(cfg.genius2) || 0) > 0) flags.push(`Genius 2 ${guidePercent(cfg.genius2)}`);
      if ((Number(cfg.preferred) || 0) > 0) flags.push(`Preferred ${guidePercent(cfg.preferred)}`);
      if (plan.airbnbMobileVariant) flags.push("Variante Mobile");
      return `<tr><td>${escapeHtml(group.label)}</td><td>${escapeHtml(STRATEGY_OTAS.find(ota => ota.id === plan.ota)?.label || plan.ota)}</td><td><b>${escapeHtml(ratePlanDisplayName(plan))}</b></td><td><span class="guide-status ${cfg.active === "SI" ? "is-on" : "is-off"}">${escapeHtml(cfg.active)}</span></td><td>${guidePercent(cfg.baseMarkup)}</td><td>${flags.join(" · ") || "Nessun flag fisso"}</td></tr>`;
    })).join("");
  const discountRows = STRATEGY_GROUPS.flatMap(group => {
    const groupState = state.strategies?.[group.id] || {};
    return STRATEGY_DISCOUNT_ROWS
      .filter(row => groupState.discounts?.[row.id]?.active === "SI")
      .map(row => {
        const cfg = groupState.discounts[row.id];
        const mapped = ["site", ...STRATEGY_OTAS.map(ota => ota.id)]
          .filter(id => cfg.otas?.[id] === "SI")
          .map(id => {
            const label = id === "site" ? "Sito" : (STRATEGY_OTAS.find(ota => ota.id === id)?.label || id);
            return `${label} ${guidePercent(cfg.otaDiscounts?.[id] ?? cfg.discount)}`;
          });
        return `<tr><td>${escapeHtml(group.label)}</td><td><b>${escapeHtml(row.code)}</b><small>${escapeHtml(row.family)}</small></td><td>${guidePercent(cfg.discount)}</td><td>${mapped.join(" · ") || "Nessun canale mappato"}</td></tr>`;
      });
  }).join("");
  return `<div class="guide-prose">
    <p>Queste tabelle sono generate dallo stato salvato adesso nel software. Non sono esempi statici: cambiano quando cambiano Parametri o Politiche e Strategie.</p>
    <h4>Commissioni correnti</h4>
    <div class="guide-table-wrap"><table><thead><tr><th>OTA</th><th>Commissione</th><th>Nota</th></tr></thead><tbody>${commissionRows}</tbody></table></div>
    <h4>Copertura per categoria</h4>
    <div class="guide-table-wrap"><table><thead><tr><th>Categoria</th><th>Piani attivi</th><th>Promo attive</th><th>Mapping</th><th>Condizioni</th><th>Costi sito</th><th>Costi OTA manuali</th></tr></thead><tbody>${categoryRows}</tbody></table></div>
    <h4>Promo attive e percentuali mappate</h4>
    <div class="guide-table-wrap"><table><thead><tr><th>Categoria</th><th>Promo</th><th>% generale</th><th>Canali e % effettive</th></tr></thead><tbody>${discountRows || `<tr><td colspan="4">Nessuna promo attiva.</td></tr>`}</tbody></table></div>
    <h4>Matrice completa dei piani tariffari</h4>
    <div class="guide-table-wrap guide-plan-table"><table><thead><tr><th>Categoria</th><th>OTA</th><th>Piano</th><th>Attivo</th><th>Markup base</th><th>Flag e regole fisse</th></tr></thead><tbody>${planRows}</tbody></table></div>
  </div>`;
}

function renderTechnicalGuide() {
  const guide = window.TECHNICAL_GUIDE;
  if (!guide?.sections?.length) return `${head("Guida tecnica", "Modulo guida non disponibile.")}<section class="panel"><p>Ricaricare la pagina per caricare il manuale.</p></section>`;
  const live = { id: "configurazione-corrente", number: "00", title: "Configurazione corrente del software", summary: "Commissioni, piani, promo, mapping e costi letti in tempo reale.", audiences: ["revenue", "commerciale", "operativo"], tags: ["configurazione", "corrente", "piani", "commissioni"] };
  const allSections = [live, ...guide.sections];
  const toc = allSections.map(item => `<button type="button" data-guide-target="guide-${item.id}"><span>${item.number}</span><b>${escapeHtml(item.title)}</b></button>`).join("");
  const sections = guide.sections.map((item, index) => `<details class="guide-section" id="guide-${item.id}" data-guide-section data-guide-audiences="${item.audiences.join(",")}" ${index === 0 ? "open" : ""}>
    <summary><span class="guide-section-number">${escapeHtml(item.number)}</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.summary)}</small></span><span class="guide-chevron" aria-hidden="true">⌄</span></summary>
    <div class="guide-section-body"><div class="guide-tags">${item.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join("")}</div><div class="guide-prose">${item.html}</div></div>
  </details>`).join("");
  return `<div class="technical-guide-page">
    ${head(guide.title, `${guide.subtitle} · versione ${guide.version} · aggiornata ${guide.updatedAt}`)}
    <section class="guide-toolbar" aria-label="Strumenti guida">
      <label class="guide-search"><span>Ricerca nella guida</span><input type="search" data-guide-search placeholder="Esempio: Airbnb Mobile, LM, commissione, storico..." autocomplete="off"></label>
      <div class="guide-audience" role="group" aria-label="Filtra per ruolo">
        <button type="button" class="active" data-guide-audience="all">Tutto</button>
        <button type="button" data-guide-audience="revenue">Revenue</button>
        <button type="button" data-guide-audience="commerciale">Commerciale</button>
        <button type="button" data-guide-audience="operativo">Operativo</button>
      </div>
      <div class="guide-actions"><button type="button" data-guide-open>Apri tutto</button><button type="button" data-guide-close>Chiudi tutto</button><button type="button" class="primary" data-guide-print>Stampa guida</button></div>
      <p class="guide-result" data-guide-result>${allSections.length} capitoli disponibili</p>
    </section>
    <div class="guide-layout">
      <aside class="guide-index"><div><p>Indice</p>${toc}</div></aside>
      <main class="guide-content">
        <section class="guide-intro"><div><span>Manuale operativo ufficiale</span><h3>Dalla configurazione al controllo del netto</h3><p>Usa la ricerca per trovare una regola o filtra per ruolo. La configurazione corrente e generata direttamente dai dati salvati; i capitoli successivi descrivono il funzionamento matematico e operativo.</p></div><dl><div><dt>${allSections.length}</dt><dd>capitoli</dd></div><div><dt>4</dt><dd>OTA</dd></div><div><dt>${STRATEGY_GROUPS.length}</dt><dd>categorie</dd></div></dl></section>
        <details class="guide-section guide-live-section" id="guide-${live.id}" data-guide-section data-guide-audiences="${live.audiences.join(",")}">
          <summary><span class="guide-section-number">${live.number}</span><span><b>${live.title}</b><small>${live.summary}</small></span><span class="guide-chevron" aria-hidden="true">⌄</span></summary>
          <div class="guide-section-body"><div class="guide-tags">${live.tags.map(tag => `<span>${tag}</span>`).join("")}</div>${renderTechnicalGuideLiveConfiguration()}</div>
        </details>
        ${sections}
        <section class="guide-empty" data-guide-empty hidden><h3>Nessun capitolo trovato</h3><p>Prova una parola piu generale o seleziona Tutto.</p></section>
      </main>
    </div>
  </div>`;
}

function bindTechnicalGuideEvents(root) {
  const page = root.querySelector(".technical-guide-page");
  if (!page) return;
  const search = page.querySelector("[data-guide-search]");
  const sections = Array.from(page.querySelectorAll("[data-guide-section]"));
  const result = page.querySelector("[data-guide-result]");
  const empty = page.querySelector("[data-guide-empty]");
  let audience = "all";
  const applyFilters = () => {
    const query = String(search?.value || "").trim().toLocaleLowerCase("it-IT");
    let visible = 0;
    sections.forEach(item => {
      const audienceMatch = audience === "all" || String(item.dataset.guideAudiences || "").split(",").includes(audience);
      const queryMatch = !query || item.textContent.toLocaleLowerCase("it-IT").includes(query);
      item.hidden = !(audienceMatch && queryMatch);
      if (!item.hidden) visible += 1;
      const link = page.querySelector(`[data-guide-target="${item.id}"]`);
      if (link) link.hidden = item.hidden;
    });
    result.textContent = `${visible} ${visible === 1 ? "capitolo disponibile" : "capitoli disponibili"}`;
    empty.hidden = visible !== 0;
  };
  if (search) search.oninput = applyFilters;
  page.querySelectorAll("[data-guide-audience]").forEach(button => button.onclick = () => {
    audience = button.dataset.guideAudience;
    page.querySelectorAll("[data-guide-audience]").forEach(item => item.classList.toggle("active", item === button));
    applyFilters();
  });
  page.querySelectorAll("[data-guide-target]").forEach(button => button.onclick = () => {
    const target = page.querySelector(`#${button.dataset.guideTarget}`);
    if (!target || target.hidden) return;
    target.open = true;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  page.querySelector("[data-guide-open]").onclick = () => sections.filter(item => !item.hidden).forEach(item => { item.open = true; });
  page.querySelector("[data-guide-close]").onclick = () => sections.forEach(item => { item.open = false; });
  page.querySelector("[data-guide-print]").onclick = () => {
    sections.filter(item => !item.hidden).forEach(item => { item.open = true; });
    document.body.classList.add("printing-technical-guide");
    window.print();
    setTimeout(() => document.body.classList.remove("printing-technical-guide"), 250);
  };
}

function renderDashboard() {
  const selectedGroup = STRATEGY_GROUPS.find(g => g.id === dashboardStrategy);
  const effects = selectedGroup ? strategyEffectsForGroup(selectedGroup.id) : customEffects();
  const rows = dashboardRowsAdjusted(effects);
  const channelCards = rows.map(r => {
    const link = channelLink(r.ch);
    const counts = selectedGroup && link ? categoryOtaDashboardCounts(selectedGroup.id, link) : channelCounts(link);
    const lamps = link ? expirySignals(link) : null;
    const planSims = selectedGroup && link ? ratePlanSimulationsForOta(selectedGroup.id, link) : [];
    const mainPlan = planSims[0] || null;
    const display = mainPlan ? {
      finale: mainPlan.sim.targetCliente,
      pub: mainPlan.sim.pubblicare,
      netto: mainPlan.sim.netto,
      gap: mainPlan.sim.deltaMinRatio,
      markupPub: mainPlan.sim.markupPub,
      label: mainPlan.plan.name,
    } : {
      finale: r.finale,
      pub: r.pub,
      netto: r.netto,
      gap: r.gap,
      markupPub: r.markupPub,
      label: "",
    };
    const markupLabel = link ? formatValue(display.markupPub, "0.00%") : formatValue(0, "0.00%");
    const strategyList = selectedGroup && link ? activeStrategyRowsForSimulation(selectedGroup.id, link).map(item => {
      return `${item.row.code} ${formatValue(item.discount, "0%")}`;
    }).join(", ") : "";
    const planList = planSims.length ? planSims.map(item => {
      return `${ratePlanDisplayName(item.plan)}: pub. ${formatValue(item.sim.pubblicare)} -> cliente ${formatValue(item.sim.targetCliente)}`;
    }).join(" | ") : "";
    return `<div class="channel-card">
      <div class="channel-card-main">
        <div>
          <h4>${escapeHtml(r.ch)}</h4>
          <div class="big">${formatValue(display.finale)}</div>
          ${display.label ? `<div class="plan-focus">${escapeHtml(display.label)}</div>` : ""}
          <div class="mini">Pubblicare: <strong>${formatValue(display.pub)}</strong><br>Netto stimato OTA: <strong>${formatValue(display.netto)}</strong><br>Delta soglia minima: <strong>${formatValue(display.gap, "0%")}</strong></div>
        </div>
        <div class="markup-box">
          <span>Markup definitivo</span>
          <strong>${markupLabel}</strong>
        </div>
      </div>
      ${link ? `<div class="promo-summary"><span>${counts.activeToday} attive oggi</span><span>${counts.configured} configurate SI</span>${counts.outOfWindow ? `<span class="warn">${counts.outOfWindow} fuori periodo</span>` : ""}</div>
      ${selectedGroup ? `<div class="strategy-card-note">${strategyList ? escapeHtml(strategyList) : "Nessuna strategia categoria applicabile con data/notti simulate"}</div>` : ""}
      ${selectedGroup && planList ? `<div class="strategy-card-note plan-card-note">${escapeHtml(planList)}</div>` : ""}
      <div class="expiry-signals" aria-label="Stato scadenze promo">
        <span class="lamp red" title="Promo attive scadute"><b></b>${lamps.expired}</span>
        <span class="lamp yellow" title="Promo attive in scadenza entro 7 giorni"><b></b>${lamps.expiring}</span>
        <span class="lamp green" title="Promo attive con data di scadenza futura"><b></b>${lamps.validWithEnd}</span>
      </div>
      <button class="manage-link" ${selectedGroup ? `data-param-category-nav="${selectedGroup.id}"` : `data-page-target="${link}"`}>${selectedGroup ? "Apri parametri categoria" : "Gestisci"}</button>` : `<div class="promo-summary muted"><span>Base diretta</span>${selectedGroup ? `<span>${escapeHtml(selectedGroup.label)}</span>` : ""}</div>`}
    </div>`;
  }).join("");
  const promoStatus = [
    ["Booking tipologia", val("Basic_NR_markup","H29"), val("Basic_NR_markup","J29")],
    ["Expedia tipologia", val("Basic_NR_markup","H38"), val("Basic_NR_markup","J38")],
    ["Airbnb tipologia", val("Basic_NR_markup","H47"), val("Basic_NR_markup","J47")],
    ["Stay timing", val("Basic_NR_markup","H56"), val("Basic_NR_markup","J56")],
    ["Ordine prezzo", val("Basic_NR_markup","N22"), ""]
  ];
  const topParams = [
    ["Canone netto sito diretto", moneyExtraInput("netCanone", netCanoneValue())],
    ["Canone + markup stagionalita", formatValue(netCanoneSeasonalValue())],
    ["Tariffa BASIC NR", formatValue(netCanoneSeasonalValue())],
    ["PL extra", moneyExtraInput("plExtra", plExtraValue())],
    ["Regola stagionalita", seasonalitySelect()],
    ["Markup stagionalita", formatValue(seasonalityMarkup(), "0%")],
    ["Target Booking", input("Basic_NR_markup","C6")],
    ["Target Airbnb", input("Basic_NR_markup","C7")],
    ["Target Expedia", input("Basic_NR_markup","C8")],
    ["Target Vrbo", input("Basic_NR_markup","C9")]
  ];
  const title = selectedGroup ? `Riepilogo categoria - ${selectedGroup.label}` : "Dashboard completa";
  const subtitle = selectedGroup ? "Riepilogo generato usando le strategie attive e mappate nella categoria selezionata. I box OTA riflettono il simulatore Parametri categoria." : "Quadro completo e modificabile: parametri sorgente, prezzi per canale, netto stimato, gap, promo attive e controlli. Ogni modifica aggiorna subito formule e riepiloghi.";
  return `${head(title, subtitle)}
  ${dashboardCategoryPanel(selectedGroup?.id || "")}
  ${selectedGroup ? strategySimulationPanel(selectedGroup.id) : ""}
  <div class="kpi-grid">
    ${kpi("Tariffa sito diretta", rows[0].finale, "Base dopo markup stagionalita " + formatValue(seasonalityMarkup(), "0%"), fmt("Basic_NR_markup", "D5"))}
    ${kpi("Booking finale", rows[1].finale, "Target vs sito " + formatValue(val("Basic_NR_markup", "C6"), "0.000%"), fmt("Basic_NR_markup", "H22"))}
    ${kpi("Miglior netto OTA", Math.max(...rows.slice(1).map(r => toNumber(r.netto))), "Tra Booking, Expedia, Airbnb, Vrbo")}
    ${kpi("Controllo ordine", val("Basic_NR_markup", "N22"), "Prezzi finiti canali")}
  </div>
  <div class="dashboard-band">${channelCards}</div>
  ${selectedGroup ? categoryRatePlanDashboardTable(selectedGroup.id) : ""}
  <section class="panel rms-entry-panel"><div><h3>Ottimizzazione RMS Prices</h3><p>Apri il simulatore RMS per ottimizzare prezzi, camere, target, calendario e scenari revenue.</p></div><button class="primary" data-page-target="rms">Apri RMS Prices</button></section>
  <section class="panel roomnight-entry-panel"><div><h3>Room Night & Obiettivi</h3><p>Monitora camere vendute e libere, calendari, strutture e periodi-obiettivo salvati.</p></div><button class="primary" data-page-target="roomnight">Apri Room Night</button></section>
  <div class="grid-2">
    <section class="panel"><h3>Parametri principali modificabili</h3>${table(["Parametro","Valore"], topParams)}</section>
    <section class="panel"><h3>Promo e tipologie attive</h3>${table(["Area","Risultato","N."], promoStatus)}</section>
  </div>
  <section class="panel" style="margin-top:16px"><h3>Prezzi e margini per canale</h3>${table(["Canale","Target","Fattore sconto","Prezzo pubblicazione","Markup definitivo","Finale cliente","Netto stimato OTA","Gap","Controllo"], rows.map(r => [r.ch,r.target,r.fattore,r.pub,r.markupPub,r.finale,r.netto,r.gap,r.ctrl]), [1,2,3,4,5,6,7])}</section>`;
}function kpi(label, value, sub, numFmt = null) { const cls = /VERIFICA|#/.test(String(value)) ? "danger" : /OK/.test(String(value)) ? "" : ""; return `<div class="kpi"><div class="label">${label}</div><div class="value ${cls}">${formatValue(value, numFmt, label)}</div><div class="sub">${sub}</div></div>`; }
function bookingPreferredConfig() {
  if (!state.bookingPreferred) state.bookingPreferred = { target: 0.22, commissionBase: 0.18, commissionVat: 0.22 };
  return state.bookingPreferred;
}
function bookingPreferredEffectiveCommission() {
  const cfg = bookingPreferredConfig();
  return (Number(cfg.commissionBase) || 0) * (1 + (Number(cfg.commissionVat) || 0));
}
function bookingPreferredTargetValue() {
  return Math.max(0, Math.min(.95, Number(bookingPreferredConfig().target) || 0));
}
function extraPercentInput(field, value) {
  return editableCoefficientPercentInput(value, `data-extra-field="${field}"`);
}
function pricingInputsConfig() {
  if (!state.pricingInputs) state.pricingInputs = { netCanone: toNumber(val("Basic_NR_markup", "C5")) || 0, plExtra: 0, postPlMarkup: 0, nrPublished: toNumber(val("Basic_NR_markup", "C5")) || 0 };
  if (!Number.isFinite(Number(state.pricingInputs.plExtra))) state.pricingInputs.plExtra = 0;
  if (!Number.isFinite(Number(state.pricingInputs.postPlMarkup))) state.pricingInputs.postPlMarkup = 0;
  if (!Number.isFinite(Number(state.pricingInputs.nrPublished))) state.pricingInputs.nrPublished = Math.max(0, Number(state.pricingInputs.netCanone) || 0) * (1 + seasonalityMarkup());
  return state.pricingInputs;
}
function netCanoneValue() {
  return Math.max(0, Number(pricingInputsConfig().netCanone) || 0);
}
function netCanoneSeasonalValue(groupId = "") {
  return groupId ? categorySeasonalTotal(groupId, netCanoneValue()) : netCanoneValue() * (1 + effectiveSeasonalityMarkup(groupId));
}
function plExtraValue() {
  return Math.max(0, Number(pricingInputsConfig().plExtra) || 0);
}
function postPlMarkupValue() {
  return Math.max(0, Math.min(.95, Number(pricingInputsConfig().postPlMarkup) || 0));
}
function nrPublishedValue() {
  return Math.max(0, Number(pricingInputsConfig().nrPublished) || 0);
}
function directTierFactor(band) {
  return band === "easy" ? 1.10 : band === "refund" ? 1.20 : 1;
}
function directPublishedForBand(groupId, band) {
  if (!groupId) return nrPublishedValue() * directTierFactor(band);
  const costs = effectiveCategoryCostsEur(groupId);
  return directSiteDiscountableBase(groupId) * directTierFactor(band) + costs;
}
function directSiteDiscountSelection(groupId) {
  if (!groupId) return null;
  // Il sito replica da Booking esclusivamente LM, PP e LOS. Le tre famiglie
  // competono notte per notte; Genius, Mobile, Paese e campagne restano esclusi.
  // Questo e l'unico motore del sito diretto per tutte le categorie: cambiano
  // soltanto configurazioni e percentuali salvate nel gruppo selezionato.
  const mapped = STRATEGY_DISCOUNT_ROWS
    .filter(row => ["Last minute", "Prenota prima", "Long stay"].includes(row.family))
    .map(row => ({ row, cfg: strategyDiscountConfig(groupId, row.id) }))
    .filter(item => item.cfg.active === "SI" && item.cfg.otas.booking === "SI")
    .map(item => ({ ...item, discount: strategyOtaDiscount(item.cfg, "booking") }));
  const lead = simulatedLeadDays();
  const nights = simulatedNights();
  const catalog = weightedTimingStayDiscount(mapped, lead, nights);
  if (!catalog) return null;
  const factor = 1 - catalog.discount;
  return {
    items: [catalog],
    catalog,
    lm: catalog,
    pp: catalog.pp,
    los: catalog.los,
    factor,
    discount: 1 - factor,
  };
}
function directSiteDiscountFactor(groupId) {
  const applied = directSiteDiscountSelection(groupId);
  return applied ? applied.factor : 1;
}
function directSiteDiscountBreakdownText(groupId) {
  const applied = directSiteDiscountSelection(groupId);
  if (!applied) return "Nessuno sconto LM/PP/LOS applicabile";
  const parts = [];
  if (applied.catalog?.nightly) {
    const counts = new Map();
    applied.catalog.nightly.forEach(item => {
      const key = item ? item.row.id : "none";
      const current = counts.get(key) || { item, nights: 0 };
      current.nights += 1;
      counts.set(key, current);
    });
    const lmParts = [...counts.values()].map(entry => {
      const nightsLabel = `${entry.nights} ${entry.nights === 1 ? "notte" : "notti"}`;
      return entry.item
        ? `${entry.item.row.code}: ${nightsLabel} al ${formatValue(entry.item.discount, "0.00%")}`
        : `Fuori finestra LM: ${nightsLabel} allo 0,00%`;
    });
    parts.push(`${lmParts.join(" · ")} · Timing/Stay ponderato ${formatValue(applied.catalog.discount, "0.00%")}`);
  }
  const costs = effectiveCategoryCostsEur(groupId);
  return `${parts.join(" · ")} · Sconto sito complessivo ${formatValue(applied.discount, "0.00%")} · Base scontabile ${formatValue(directSiteDiscountableBase(groupId))} · Costi esclusi dallo sconto ${formatValue(costs)}`;
}
function directSiteDiscountableBase(groupId) {
  const gross = nrPublishedValue();
  const costs = groupId ? effectiveCategoryCostsEur(groupId) : 0;
  // Regola unica per ogni categoria: dal lordo si separano prima i costi,
  // quindi LM/PP/LOS scontano esclusivamente il canone.
  return Math.max(0, gross - costs);
}
function directPublishedDiscountedForBand(groupId, band) {
  const costs = groupId ? effectiveCategoryCostsEur(groupId) : 0;
  // Ogni fascia nasce dal canone senza costi: NR, Easy +10%, Refundable +20%.
  // LM/PP/LOS scontano la fascia del solo canone; i costi rientrano alla fine.
  const tierCanone = directSiteDiscountableBase(groupId) * directTierFactor(band);
  return tierCanone * directSiteDiscountFactor(groupId) + costs;
}
function directNetCanoneForBand(groupId, band) {
  if (band === "nr" || !band) return netCanoneValue();
  return netCanoneValue() * directTierFactor(band);
}
function directNetCanoneForPlan(groupId, plan) {
  return directNetCanoneForBand(groupId, ratePlanBand(plan));
}
function manualConditionTotalValue(groupId) {
  const value = state.strategies?.[groupId]?.manualConditionTotal;
  return value === null || value === undefined || value === "" ? null : Math.max(0, Number(value) || 0);
}
function manualOtaCostTotalValue(groupId, otaId = "booking") {
  const group = state.strategies?.[groupId];
  const value = group?.manualOtaCostTotals?.[otaId] ?? (otaId === "booking" ? group?.manualOtaCostTotal : null);
  return value === null || value === undefined || value === "" ? null : Math.max(0, Number(value) || 0);
}
function effectiveCategoryCostsEur(groupId) {
  const manual = manualConditionTotalValue(groupId);
  return manual === null ? Math.max(0, Number(strategyConditionCounts(groupId).totalEur) || 0) : manual;
}
function syncNetCanoneFromCategoryCosts(groupId, preservePageCache = false) {
  if (!groupId || !STRATEGY_GROUPS.some(group => group.id === groupId)) return false;
  const totalCostsEur = effectiveCategoryCostsEur(groupId);
  const next = Math.max(0, nrPublishedValue() - totalCostsEur);
  const cfg = pricingInputsConfig();
  if (Math.abs((Number(cfg.netCanone) || 0) - next) <= 0.000001) return false;
  cfg.netCanone = next;
  evalCache = new Map();
  if (!preservePageCache) {
    pageRenderRevision += 1;
    pageDomCache.clear();
  }
  return true;
}
function moneyExtraInput(field, value) {
  const display = (Number(value) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<input class="input-cell" data-extra-money="${field}" value="${escapeHtml(display)}">`;
}
function autoValueLabel() {
  return `<span class="auto-pill" data-auto-value>Automatico</span>`;
}
function hasBookingPreferredMarkup(groupId = "") {
  const plans = STRATEGY_RATE_PLANS.filter(plan => plan.ota === "booking" && (!groupId || plan.groupId === groupId));
  return plans.some(plan => {
    const cfg = strategyRatePlanConfig(plan.groupId, plan.id);
    return cfg.active === "SI" && (Number(cfg.preferred) || 0) > 0.000001;
  });
}
function primaryRatePlanSimulationForOta(groupId, otaId, preferredOnly = false) {
  if (!groupId) return null;
  const rows = ratePlanSimulationsForOta(groupId, otaId);
  if (preferredOnly) return rows.find(item => item.sim.preferred) || null;
  return rows[0] || null;
}
function inputTargetResultForCategory(groupId, otaId, preferredOnly = false, fallbackRow = null) {
  const item = primaryRatePlanSimulationForOta(groupId, otaId, preferredOnly);
  if (item) return item.sim.targetCliente;
  return fallbackRow ? inputResultValue(fallbackRow) : 0;
}
function categoryPrimaryCalculationRows(groupId) {
  const bookingPlans = ratePlanSimulationsForOta(groupId, "booking");
  const referenceItems = bookingPlans.length ? bookingPlans : STRATEGY_OTAS.map(ota => primaryRatePlanSimulationForOta(groupId, ota.id)).filter(Boolean).slice(0, 1);
  if (!referenceItems.length) return [];
  const rows = referenceItems.flatMap(item => {
    const sim = item.sim;
    const band = ratePlanBand(item.plan);
    const bandLabel = band === "easy" ? "EASY" : band === "refund" ? "REFUNDABLE" : "NR";
    // Le fasce sito Easy/Refundable restano disponibili come controllo storico,
    // ma non alimentano più il motore OTA: il motore parte sempre dal canone NR.
    const displayNetCanone = band === "nr" || !band ? netCanoneValue() : directNetCanoneForBand(groupId, band);
    const categoryMarkup = effectiveSeasonalityMarkup(groupId);
    const displaySeasonal = categorySeasonalTotal(groupId, displayNetCanone);
    const displayAfterPlan = categoryTotalAfterPlanMarkup(groupId, displayNetCanone, sim.planMarkup);
    return [[
      `${bandLabel} - canone + stagionalita`,
      autoValueLabel(),
      displaySeasonal,
      `${formatValue(displayNetCanone)} + stagionalita effettiva (${formatValue(categoryMarkup, "0.00%")})`
    ], [
      `${bandLabel} - dopo markup piano`,
      autoValueLabel(),
      displayAfterPlan,
      `${formatValue(displaySeasonal)} + markup piano ${formatValue(sim.planMarkup, "0.00%")} · ${item.plan.name} / ${titleForPage(item.plan.ota)}`
    ]];
  });
  const sim = referenceItems[0].sim;
  rows.push(
    [
      "Lordo intermedio con PL extra",
      moneyExtraInput("plExtra", plExtraValue()),
      sim.grossBeforeDiscounts,
      `${formatValue(sim.baseBeforePl)} + PL extra ${formatValue(plExtraValue())}`
    ],
    [
      "Markup aggiuntivo dopo PL",
      editablePercentInput(postPlMarkupValue(), `data-extra-field="postPlMarkup"`, "post-pl-markup-options"),
      formatValue(postPlMarkupValue(), "0.00%"),
      "Applicato al lordo intermedio con PL extra prima delle promo"
    ],
    [
      "Lordo dopo markup aggiuntivo",
      autoValueLabel(),
      sim.grossAfterPostPlMarkup,
      `${formatValue(sim.grossBeforeDiscounts)} + markup ${formatValue(sim.postPlMarkup, "0.00%")}`
    ]
  );
  if (sim.usesOtaMarkup) rows.splice(1, 0, [
    "Dopo markup OTA",
    autoValueLabel(),
    sim.afterOtaMarkup,
    `${formatValue(sim.afterPlanMarkup)} + coefficiente OTA ${formatValue(sim.pricingMarkup, "0.00%")} · riferimento ${otaLabel}`
  ]);
  return rows;
}
function inputMainRows(groupId = "") {
  const preferredActive = hasBookingPreferredMarkup(groupId);
  const categoryCostsEur = groupId ? effectiveCategoryCostsEur(groupId) : 0;
  const manualCostsActive = groupId ? manualConditionTotalValue(groupId) !== null : false;
  const directDiscountBreakdown = groupId ? directSiteDiscountBreakdownText(groupId) : "";
  const pageByRow = { 6: "booking", 7: "airbnb", 8: "expedia", 9: "vrbo" };
  const targetRows = [6,7,8,9].map(r => [
    val("Basic_NR_markup", `B${r}`),
    input("Basic_NR_markup", `C${r}`),
    groupId ? inputTargetResultForCategory(groupId, pageByRow[r], false, r) : inputResultValue(r),
    groupId ? `Target categoria: primo piano tariffario attivo ${titleForPage(pageByRow[r])}` : val("Basic_NR_markup", `E${r}`)
  ]);
  targetRows.splice(1, 0, [
    "Target prezzo finito Booking PREFERITI vs sito",
    extraPercentInput("bookingPreferredTarget", bookingPreferredTargetValue()),
    preferredActive ? (groupId ? inputTargetResultForCategory(groupId, "booking", true, 6) : seasonalBase() * (1 + bookingPreferredTargetValue())) : 0,
    preferredActive ? "Scenario attivo: almeno un piano Booking ha Preferiti maggiore di 0" : "Scenario spento: nessun piano Booking Preferiti attivo"
  ]);
  return [
    [
      "Canone netto sito diretto",
      moneyExtraInput("netCanone", netCanoneValue()),
      netCanoneValue(),
      groupId
        ? `Precompilato da NR pubblicato ${formatValue(nrPublishedValue())} - ${manualCostsActive ? "totale costi manuale" : "costi attivi EUR"} ${formatValue(categoryCostsEur)}. Rimane modificabile manualmente.`
        : "Unico prezzo sorgente manuale: canone netto prima di stagionalita, OTA, promo, costi e provvigioni"
    ],
    [
      "Canone netto sito diretto EASY",
      autoValueLabel(),
      groupId ? directNetCanoneForBand(groupId, "easy") : nrPublishedValue() * 1.10,
      `Controllo derivato: canone NR ${formatValue(netCanoneValue())} +10,00%`
    ],
    [
      "Canone netto sito diretto REFUNDABLE",
      autoValueLabel(),
      groupId ? directNetCanoneForBand(groupId, "refund") : nrPublishedValue() * 1.20,
      `Controllo derivato: canone NR ${formatValue(netCanoneValue())} +20,00%`
    ],
    [
      "Canone + stagionalita",
      "",
      netCanoneSeasonalValue(groupId),
      groupId
        ? `Canone netto + markup stagionale effettivo ${formatValue(effectiveSeasonalityMarkup(groupId), "0.00%")}`
        : `Canone netto + ${currentSeasonalityRule().label} (${formatValue(seasonalityMarkup(), "0%")})`
    ],
    [
      "Tariffa BASIC NR",
      autoValueLabel(),
      netCanoneSeasonalValue(groupId),
      "Ricavata automaticamente dal canone netto stagionalizzato"
    ],
    ...(groupId ? categoryPrimaryCalculationRows(groupId) : [[
      "PL extra",
      moneyExtraInput("plExtra", plExtraValue()),
      plExtraValue(),
      "Posti letto extra: valore manuale sommato dopo il markup OTA e prima del calcolo barrato"
    ]]),
    ...targetRows,
    [
      "NR pubblicato sito diretto",
      moneyExtraInput("nrPublished", nrPublishedValue()),
      nrPublishedValue(),
      "Prezzo NR pubblicato sul sito diretto: riferimento manuale separato dal canone netto"
    ],
    [
      "EASY pubblicato sito diretto",
      autoValueLabel(),
      directPublishedForBand(groupId, "easy"),
      `Canone netto ${formatValue(directSiteDiscountableBase(groupId))} +10,00% + costi ${formatValue(categoryCostsEur)}`
    ],
    [
      "REFUNDABLE pubblicato sito diretto",
      autoValueLabel(),
      directPublishedForBand(groupId, "refund"),
      `Canone netto ${formatValue(directSiteDiscountableBase(groupId))} +20,00% + costi ${formatValue(categoryCostsEur)}`
    ],
    [
      "NR sito diretto dopo sconti",
      autoValueLabel(),
      directPublishedDiscountedForBand(groupId, "nr"),
      `Canone ${formatValue(directSiteDiscountableBase(groupId))} - sconto ${formatValue(1 - directSiteDiscountFactor(groupId), "0.00%")} + costi non scontati ${formatValue(categoryCostsEur)} · ${directDiscountBreakdown}`
    ],
    [
      "EASY sito diretto dopo sconti",
      autoValueLabel(),
      directPublishedDiscountedForBand(groupId, "easy"),
      `Canone netto +10,00%, poi sconti; costi riaggiunti alla fine · ${directDiscountBreakdown}`
    ],
    [
      "REFUNDABLE sito diretto dopo sconti",
      autoValueLabel(),
      directPublishedDiscountedForBand(groupId, "refund"),
      `Canone netto +20,00%, poi sconti; costi riaggiunti alla fine · ${directDiscountBreakdown}`
    ]
  ];
}
function renderInputMainTables(rows) {
  const isPublished = row => /^(NR|EASY|REFUNDABLE) (pubblicato sito diretto|sito diretto dopo sconti)$/i.test(String(row[0]));
  const isTarget = row => /^Target prezzo finito/i.test(String(row[0]));
  const isDerived = row => /Canone netto sito diretto (EASY|REFUNDABLE)|^(EASY|REFUNDABLE) - /i.test(String(row[0]));
  const publishedRows = rows.filter(isPublished);
  const published = ["NR", "EASY", "REFUNDABLE"].flatMap(band => [
    publishedRows.find(row => String(row[0]).toUpperCase() === `${band} PUBBLICATO SITO DIRETTO`),
    publishedRows.find(row => String(row[0]).toUpperCase() === `${band} SITO DIRETTO DOPO SCONTI`),
  ].filter(Boolean));
  const targets = rows.filter(isTarget);
  const derived = rows.filter(isDerived);
  const main = rows.filter(row => !isPublished(row) && !isTarget(row) && !isDerived(row));
  const headers = ["Parametro","Valore modificabile","Risultato formula","Nota"];
  return `<div class="input-published-block input-published-top">
      <h4>Tariffe pubblicate sul sito diretto</h4>
      ${table(headers, published, [1,2])}
    </div>
    ${table(headers, main, [1,2])}
    <details class="input-detail-group" data-input-details="derived" ${inputDetailsOpen.derived ? "open" : ""}>
      <summary><span>Calcoli derivati Easy e Refundable</span><small>Conservati come simulazione del sito diretto</small></summary>
      ${table(headers, derived, [1,2])}
    </details>
    <details class="input-detail-group" data-input-details="targets" ${inputDetailsOpen.targets ? "open" : ""}>
      <summary><span>Target e coefficienti OTA</span><small>Booking, Airbnb, Expedia e Vrbo</small></summary>
      ${table(headers, targets, [1,2])}
    </details>`;
}
function commissionRows() {
  const rows = [13,14,15,16,17].map(r => [val("Basic_NR_markup",`B${r}`), input("Basic_NR_markup",`C${r}`), input("Basic_NR_markup",`D${r}`), val("Basic_NR_markup",`E${r}`), val("Basic_NR_markup",`F${r}`)]);
  const cfg = bookingPreferredConfig();
  rows.splice(2, 0, [
    "Booking.com PREFERITI",
    extraPercentInput("bookingPreferredCommissionBase", cfg.commissionBase),
    extraPercentInput("bookingPreferredCommissionVat", cfg.commissionVat),
    bookingPreferredEffectiveCommission(),
    "Usata automaticamente se il piano Booking ha Preferiti maggiore di 0"
  ]);
  return rows;
}
function renderInputs() {
  const group = STRATEGY_GROUPS.find(g => g.id === parameterStrategy);
  if (group) return renderCategoryInputs(group);
  const mainRows = inputMainRows();
  const commissions = commissionRows();
  return `${head("Parametri completi", "Tutti i parametri sorgente modificabili: input iniziali, costi, promo, policy e sconti. Gli sconti percentuali sono menu a tendina con i valori del file gia selezionati.")}
  ${parameterCategoryPanel()}
  <div class="param-grid">
    <section class="panel input-main-panel"><h3>Input principali</h3>${renderInputMainTables(mainRows)}${seasonalityPanel()}</section>
    <section class="panel"><h3>Provvigioni e costi canale</h3>${table(["Canale","Provvigione base","IVA","Provvigione finita","Nota"], commissions, [1,2,3])}</section>
    ${otaParameterSection("Booking.com", 68, 87)}
    ${otaParameterSection("Expedia", 92, 101)}
    ${otaParameterSection("Airbnb", 106, 117)}
    ${otaParameterSection("Vrbo", 121, 127)}
  </div>`;
}
function renderCategoryInputs(group) {
  const mainRows = inputMainRows(group.id);
  const commissions = commissionRows();
  return `${head(`Parametri categoria - ${group.label}`, "Simulatore parametri filtrato sulla categoria selezionata: input principali e costi restano modificabili, sotto compaiono solo le strategie attive e mappate verso le OTA per questa categoria.")}
  ${parameterCategoryPanel(group.id)}
  ${strategySimulationPanel(group.id)}
  ${categoryRatePlanDashboardTable(group.id)}
  <div class="param-grid">
    <section class="panel input-main-panel">
      <div class="input-main-heading">
        <h3>Input principali</h3>
        ${categoryCostQuickTools(group.id)}
      </div>
      ${renderInputMainTables(mainRows)}${seasonalityPanel(group.id)}
    </section>
    <section class="panel"><h3>Provvigioni e costi canale</h3>${table(["Canale","Provvigione base","IVA","Provvigione finita","Nota"], commissions, [1,2,3])}</section>
    ${categoryStrategyOtaSections(group.id)}
  </div>`;
}
function categoryCostQuickTools(groupId) {
  const manual = manualConditionTotalValue(groupId);
  const mapped = Math.max(0, Number(strategyConditionCounts(groupId).totalEur) || 0);
  const display = manual === null ? "" : manual.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const otaInputs = STRATEGY_OTAS.map(ota => {
    const value = manualOtaCostTotalValue(groupId, ota.id);
    const shown = value === null ? "" : value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<label><span>Costi ${ota.label}</span><input class="input-cell" data-manual-ota-cost-total="${groupId}" data-manual-ota-id="${ota.id}" value="${escapeHtml(shown)}" placeholder="0,00"></label>`;
  }).join("");
  return `<div class="category-cost-quick-tools">
    <div class="category-cost-primary">
      <button class="category-cost-open" data-open-category-conditions="${groupId}">Apri condizioni/costi</button>
      <label><span>Totale costi manuale</span><input class="input-cell" data-manual-condition-total="${groupId}" value="${escapeHtml(display)}" placeholder="Usa mappatura"></label>
    </div>
    <div class="category-cost-ota-grid">${otaInputs}</div>
    <small class="category-cost-note">Mappati: ${formatValue(mapped)} · ${manual === null ? "in uso" : "sostituiti dal totale manuale"} · I costi OTA sono applicati esclusivamente al relativo canale.</small>
  </div>`;
}
function dashboardCategoryPanel(activeId = "") {
  const buttons = [`<button class="${!activeId ? "primary" : ""}" data-dashboard-category="">Generale workbook</button>`]
    .concat(STRATEGY_GROUPS.map(group => `<button class="${activeId === group.id ? "primary" : ""}" data-dashboard-category="${group.id}">${escapeHtml(group.label)}${group.subtitle ? `<small>${escapeHtml(group.subtitle)}</small>` : ""}</button>`))
    .join("");
  return `<section class="panel param-mode-panel dashboard-mode-panel">
    <div>
      <h3>Riepilogo per categoria</h3>
      <p>Seleziona una categoria per vedere i box OTA generati dalle strategie LM/LOS attive e mappate in Politiche e Strategie 2026/27.</p>
    </div>
    <div class="category-mode-buttons">${buttons}</div>
  </section>`;
}
function parameterCategoryPanel(activeId = "") {
  const buttons = [`<button class="${!activeId ? "primary" : ""}" data-param-category="">Generale workbook</button>`]
    .concat(STRATEGY_GROUPS.map(group => `<button class="${activeId === group.id ? "primary" : ""}" data-param-category="${group.id}">${escapeHtml(group.label)}${group.subtitle ? `<small>${escapeHtml(group.subtitle)}</small>` : ""}</button>`))
    .join("");
  return `<section class="panel param-mode-panel">
    <div>
      <h3>Simulatore per categoria</h3>
      <p>Apri una categoria per testare le tariffe usando solo le scontistiche che hai attivato e mappato in Politiche e Strategie 2026/27.</p>
    </div>
    <div class="category-mode-buttons">${buttons}</div>
  </section>`;
}
function categoryOtaDashboardCounts(groupId, otaId) {
  const activeRows = activeStrategyRowsForSimulation(groupId, otaId);
  return { configured: categoryOtaRows(groupId, otaId).length, activeToday: activeRows.length, outOfWindow: 0 };
}
function categoryRatePlanDashboardTable(groupId) {
  const rows = STRATEGY_OTAS.flatMap(ota => ratePlanSimulationsForOta(groupId, ota.id));
  return categoryOtaRateSummary(groupId, rows);
}
function categoryRatePlanDetailTable(groupId, rows, includeDelta = false) {
  const body = rows.map(item => {
    const statusClass = item.sim.deltaMin >= -0.004 ? "ok" : "bad";
    return `<tr class="${item.plan.airbnbMobileVariant ? "airbnb-mobile-rate" : ""}">
      <td><strong>${escapeHtml(titleForPage(item.plan.ota))}</strong></td>
      <td>${ratePlanNameCell(item.plan)}</td>
      <td class="num rate-base-cell"><span class="rate-base-value">${formatValue(item.sim.directTierBase)}</span><small class="rate-plan-result">Piano: ${formatValue(item.sim.afterPlanMarkup)}</small></td>
      <td class="num">${formatValue(effectiveSeasonalityMarkup(groupId), "0.00%")}</td>
      <td class="num">${formatValue(item.sim.planMarkup, "0.00%")}</td>
      <td class="num"><strong>${formatValue(item.sim.targetCliente)}</strong><small>Cliente prima costi ${formatValue(item.sim.clientBeforeConditions)}</small></td>
      <td class="num">${formatValue(item.sim.discountTotal, "0.00%")}</td>
      <td class="num"><strong>${formatValue(item.sim.conditionCost.total)}</strong><small>${item.sim.conditionCost.source === "manual-ota" ? "Totale costi OTA manuale" : `${item.sim.conditionCost.count} costi mappati`}</small></td>
      <td class="num"><strong>${formatValue(item.sim.pubblicare)}</strong><small>Normale con costi ${formatValue(item.sim.pubblicareTariffa)} · canone ${formatValue(item.sim.grossAfterPostPlMarkup)}</small></td>
      <td class="num">${formatValue(item.sim.markupPub, "0.00%")}</td>
      <td class="num">${formatValue(item.sim.netto)}</td>
      <td class="num">${formatValue(item.sim.directPublished)}</td>
      <td class="num"><span class="delta-pill ${statusClass}">${formatValue(item.sim.deltaMin)}</span><small>${formatValue(item.sim.deltaMinRatio, "0.00%")}</small></td>
    </tr>`;
  }).join("");
  return `<div class="category-rate-detail-content">
    <p>Per ogni piano: canone netto, stagionalita e markup unico del piano generano la tariffa di partenza; seguono PL extra, markup aggiuntivo, promo, costi condizioni e controllo netto +5%.</p>
    <div class="table-wrap rate-plan-dashboard-table"><table>
      <thead><tr><th>OTA</th><th>Piano tariffario</th><th class="num">Base fascia</th><th class="num">Stag.</th><th class="num">Markup piano config.</th><th class="num">Prezzo cliente finale</th><th class="num">Sconti promo</th><th class="num">Costi condizioni</th><th class="num">Pubblicare barrato</th><th class="num">Markup definitivo da canone netto</th><th class="num">Netto stimato OTA</th><th class="num">Riferimento sito diretto</th><th class="num">Delta netto OTA vs sito</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>
    ${includeDelta ? categoryRatePlanDeltaSection(groupId) : ""}
  </div>`;
}
function categoryOtaRateSummary(groupId, rows) {
  const otaBlocks = STRATEGY_OTAS.map(ota => {
    const otaRows = rows.filter(item => item.plan.ota === ota.id);
    if (!otaRows.length) return `<article class="ota-rate-summary-card ota-${ota.id} empty">
      <div class="ota-rate-summary-head">
        <div><h4>${escapeHtml(ota.label)}</h4><span>Nessun piano tariffario collegato</span></div>
        <span class="strategy-pill">Da collegare</span>
      </div>
      <div class="ota-rate-empty">Le tariffe calcolate compariranno qui quando saranno configurati i piani ${escapeHtml(ota.label)} per questa categoria.</div>
    </article>`;
    const compactRow = item => `<details class="ota-rate-plan-details ${item.plan.airbnbMobileVariant ? "airbnb-mobile-rate" : ""}">
      <summary>
        <span class="ota-rate-plan-name">${ratePlanNameCell(item.plan)}</span>
        <span class="ota-rate-price"><strong>${formatValue(item.sim.pubblicare)}</strong><small>Prezzo barrato</small></span>
        <span class="ota-rate-price"><strong>${formatValue(item.sim.targetCliente)}</strong><small>Dopo sconti e costi</small></span>
        <span class="ota-rate-detail-button">Dettagli</span>
      </summary>
      ${categoryRatePlanDetailTable(groupId, [item], false)}
    </details>`;
    const standardRows = otaRows.filter(item => !item.plan.airbnbMobileVariant).map(compactRow).join("");
    const mobileItems = otaRows.filter(item => item.plan.airbnbMobileVariant);
    const mobileRows = mobileItems.length ? `<details class="airbnb-mobile-group" open>
      <summary><span>Tariffe Mobile</span><small>${mobileItems.length} tariffe</small><b aria-hidden="true"></b></summary>
      <div>${mobileItems.map(compactRow).join("")}</div>
    </details>` : "";
    const compactRows = standardRows + mobileRows;
    return `<article class="ota-rate-summary-card ota-${ota.id}">
      <div class="ota-rate-summary-head">
        <div><h4>${escapeHtml(ota.label)}</h4><span>${otaRows.length} ${otaRows.length === 1 ? "tariffa calcolata" : "tariffe calcolate"}</span></div>
      </div>
      <div class="ota-rate-column-head"><span>Piano tariffario</span><span>Pubblicare</span><span>Prezzo finale cliente</span><span></span></div>
      <div class="ota-rate-plan-list">${compactRows}</div>
    </article>`;
  }).join("");
  return `<section class="panel category-rate-summary ota-rate-summary">
    <div class="ota-rate-summary-title">
      <div><h3>Tariffe OTA calcolate</h3><p>Riepilogo immediato dei prezzi da pubblicare e dei prezzi finali cliente. Apri il dettaglio della singola OTA per vedere tutti i passaggi.</p></div>
      <button class="primary rates-lab-entry" data-open-rates-lab="${groupId}">Grafico OTA Rates VS2</button>
    </div>
    <div class="ota-rate-summary-grid">${otaBlocks}</div>
    ${categoryRatePlanDeltaSection(groupId, true)}
  </section>`;
}
function initRatesLab(groupId, force = false) {
  if (!force && ratesLab?.groupId === groupId) return ratesLab;
  if (!force) {
    try {
      const draft = JSON.parse(localStorage.getItem(`gestione-channel-rates-lab-draft-${groupId}`) || "null");
      const saved = draft || JSON.parse(localStorage.getItem(`gestione-channel-rates-lab-${groupId}`) || "null");
      if (saved) {
        const markups = { ...(saved.markups || {}) };
        normalizeRatesLabAirbnbMarkups(groupId, markups);
        ratesLab = {
          ...saved,
          groupId,
          seasonality: Number(saved.seasonality ?? effectiveSeasonalityMarkup(groupId)),
          objective: Number(saved.objective ?? -.05),
          tolerance: Number(saved.tolerance ?? .02),
          showAirbnbMobile: saved.showAirbnbMobile !== false,
          visibleOtas: Object.fromEntries(STRATEGY_OTAS.map(ota => [ota.id, saved.visibleOtas?.[ota.id] !== false])),
          scenarioName: String(saved.scenarioName || ""),
          markups,
        };
        return ratesLab;
      }
    } catch {}
  }
  const plans = STRATEGY_RATE_PLANS.filter(plan => plan.groupId === groupId);
  const markups = Object.fromEntries(plans.map(plan => [
    ratesLabPlanKey(plan),
    ratePlanTotalMarkup(strategyRatePlanConfig(groupId, plan.id), plan.ota),
  ]));
  normalizeRatesLabAirbnbMarkups(groupId, markups);
  ratesLab = {
    groupId,
    seasonality: effectiveSeasonalityMarkup(groupId),
    objective: -0.05,
    tolerance: 0.02,
    showAirbnbMobile: true,
    visibleOtas: Object.fromEntries(STRATEGY_OTAS.map(ota => [ota.id, true])),
    scenarioName: "",
    markups,
  };
  return ratesLab;
}
function loadSavedRatesLab(groupId) {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(`gestione-channel-rates-lab-${groupId}`) || "null"); } catch {}
  if (!saved) {
    ratesLab = null;
    return initRatesLab(groupId);
  }
  const markups = { ...(saved.markups || {}) };
  normalizeRatesLabAirbnbMarkups(groupId, markups);
  ratesLab = {
    ...saved,
    groupId,
    seasonality: Number(saved.seasonality ?? effectiveSeasonalityMarkup(groupId)),
    objective: Number(saved.objective ?? -.05),
    tolerance: Number(saved.tolerance ?? .02),
    showAirbnbMobile: saved.showAirbnbMobile !== false,
    visibleOtas: Object.fromEntries(STRATEGY_OTAS.map(ota => [ota.id, saved.visibleOtas?.[ota.id] !== false])),
    scenarioName: String(saved.scenarioName || ""),
    markups,
  };
  return ratesLab;
}
function persistRatesLabDraft() {
  if (!ratesLab?.groupId) return;
  const snapshot = JSON.parse(JSON.stringify(ratesLab));
  localStorage.setItem(`gestione-channel-rates-lab-draft-${ratesLab.groupId}`, JSON.stringify(snapshot));
}
function ratesLabPlanKey(plan) {
  return `${plan?.ota || "ota"}::${plan?.id || plan?.name || "piano"}`;
}
function ratesLabAirbnbPlans(groupId) {
  return STRATEGY_RATE_PLANS.filter(plan => plan.groupId === groupId && plan.ota === "airbnb");
}
function ratesLabAirbnbReferencePlan(groupId) {
  const plans = ratesLabAirbnbPlans(groupId);
  return plans.find(plan => !plan.airbnbMobileVariant && ratePlanBand(plan) === "refund")
    || plans.find(plan => !plan.airbnbMobileVariant)
    || plans[0]
    || null;
}
function normalizeRatesLabAirbnbMarkups(groupId, markups, forcedMarkup = null) {
  if (!markups) return;
  const plans = ratesLabAirbnbPlans(groupId);
  if (!plans.length) return;
  const referencePlan = ratesLabAirbnbReferencePlan(groupId);
  const referenceKey = referencePlan ? ratesLabPlanKey(referencePlan) : "";
  const configured = Number(markups[referenceKey] ?? markups[referencePlan?.id]);
  const fallback = referencePlan ? ratePlanTotalMarkup(strategyRatePlanConfig(groupId, referencePlan.id), "airbnb") : 0;
  const hasForcedMarkup = forcedMarkup !== null && forcedMarkup !== undefined && Number.isFinite(Number(forcedMarkup));
  const sharedMarkup = hasForcedMarkup
    ? Math.max(0, Number(forcedMarkup))
    : Number.isFinite(configured) ? Math.max(0, configured) : Math.max(0, Number(fallback) || 0);
  plans.forEach(plan => { markups[ratesLabPlanKey(plan)] = sharedMarkup; });
}
function setRatesLabMarkup(labKey, markup) {
  if (!ratesLab?.groupId) return;
  const plan = STRATEGY_RATE_PLANS.find(item => item.groupId === ratesLab.groupId && ratesLabPlanKey(item) === labKey);
  if (plan?.ota === "airbnb") normalizeRatesLabAirbnbMarkups(ratesLab.groupId, ratesLab.markups, markup);
  else ratesLab.markups[labKey] = Math.max(0, Number(markup) || 0);
}
function updateStoredRatesLab(groupId, updater) {
  const storageKey = `gestione-channel-rates-lab-${groupId}`;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(storageKey) || "null"); } catch {}
  if (!saved) return;
  updater(saved);
  localStorage.setItem(storageKey, JSON.stringify(saved));
}
function syncRatesLabPlanFromParameters(groupId, planId) {
  const plan = STRATEGY_RATE_PLANS.find(item => item.groupId === groupId && item.id === planId);
  if (!plan) return;
  const cfg = strategyRatePlanConfig(groupId, planId);
  const markup = ratePlanTotalMarkup(cfg, plan.ota);
  const labKey = ratesLabPlanKey(plan);
  if (ratesLab?.groupId === groupId) {
    if (!ratesLab.markups) ratesLab.markups = {};
    if (plan.ota === "airbnb") normalizeRatesLabAirbnbMarkups(groupId, ratesLab.markups, markup);
    else ratesLab.markups[labKey] = markup;
  }
  updateStoredRatesLab(groupId, saved => {
    if (!saved.markups) saved.markups = {};
    if (plan.ota === "airbnb") normalizeRatesLabAirbnbMarkups(groupId, saved.markups, markup);
    else saved.markups[labKey] = markup;
  });
}
function syncRatesLabSeasonalityFromParameters(groupId) {
  if (!groupId) return;
  const markup = effectiveSeasonalityMarkup(groupId);
  if (ratesLab?.groupId === groupId) ratesLab.seasonality = markup;
  updateStoredRatesLab(groupId, saved => { saved.seasonality = markup; });
}
function applyRatesLabToParameters() {
  if (!ratesLab?.groupId) return false;
  const groupId = ratesLab.groupId;
  const plans = STRATEGY_RATE_PLANS.filter(plan => plan.groupId === groupId);
  let changed = false;
  for (const plan of plans) {
    const labKey = ratesLabPlanKey(plan);
    const desiredTotal = Number(ratesLab.markups?.[labKey] ?? ratesLab.markups?.[plan.id]);
    if (!Number.isFinite(desiredTotal)) continue;
    const cfg = strategyRatePlanConfig(groupId, plan.id);
    const additions = plan.ota === "airbnb" ? 0 : (Number(cfg.genius1) || 0) + (plan.ota === "booking" ? (Number(cfg.genius2) || 0) : 0) + (Number(cfg.preferred) || 0);
    const nextBase = Math.max(0, desiredTotal - additions);
    if (Math.abs((Number(cfg.baseMarkup) || 0) - nextBase) > 0.000001) {
      cfg.baseMarkup = nextBase;
      changed = true;
    }
  }
  const groupCfg = state.strategies?.[groupId];
  const ruleId = currentSeasonalityRule().id;
  const seasonalityBreakdown = categorySeasonalityBreakdown(groupId);
  const mixedSeasonality = seasonalityBreakdown?.peakNights > 0 && seasonalityBreakdown?.baseNights > 0;
  if (groupCfg && !mixedSeasonality && Number.isFinite(Number(ratesLab.seasonality))) {
    if (!groupCfg.seasonalityMarkups) groupCfg.seasonalityMarkups = defaultCategorySeasonalityMarkups(groupId);
    const nextSeasonality = Math.max(0, Number(ratesLab.seasonality) || 0);
    if (Math.abs((Number(groupCfg.seasonalityMarkups[ruleId]) || 0) - nextSeasonality) > 0.000001) {
      groupCfg.seasonalityMarkups[ruleId] = nextSeasonality;
      changed = true;
    }
  }
  if (!changed) return false;
  dirty = true;
  invalidate();
  log(`Grafico OTA applicato ai parametri: ${groupId}`, { action: "applica grafico OTA", gruppo: groupId });
  saveState();
  return true;
}
function ratesLabRows({ includeHidden = false } = {}) {
  const groupId = ratesLab?.groupId || parameterStrategy || STRATEGY_GROUPS[0].id;
  initRatesLab(groupId);
  const touristTax = Math.max(0, Number(simulationTouristTax(groupId).total) || 0);
  const simulationOptions = { markups: ratesLab.markups, seasonality: ratesLab.seasonality };
  return STRATEGY_OTAS.flatMap(ota => (!includeHidden && ratesLab.visibleOtas?.[ota.id] === false ? [] : ratePlanSimulationsForOta(groupId, ota.id, simulationOptions)
    .filter(item => ota.id !== "airbnb" || ratesLab.showAirbnbMobile !== false || !item.plan.airbnbMobileVariant)
    .map(item => {
    const labKey = ratesLabPlanKey(item.plan);
    const markup = Number(item.sim.planMarkup) || 0;
    const pubblicare = Number(item.sim.pubblicare) || 0;
    const finale = Number(item.sim.targetCliente) || 0;
    const commission = Number(item.sim.commission) || 0;
    const netto = Number(item.sim.netto) || 0;
    const directBand = item.plan.ota === "booking"
      ? (ratePlanBand(item.plan) || "nr")
      : item.plan.ota === "airbnb" && ratePlanBand(item.plan) === "refund" ? "refund" : "nr";
    const reference = directPublishedDiscountedForBand(groupId, directBand) || 1;
    const customerReference = reference + touristTax;
    return {
      ...item, ota, labKey, markup, pubblicare, finale, netto, commission, reference, customerReference, touristTax, directBand,
      finaleRatio: customerReference ? finale / customerReference - 1 : 0,
      nettoRatio: netto / reference - 1,
    };
  })));
}
function optimizeRatesLabMarkupsToObjective() {
  if (!ratesLab?.groupId) return;
  const groupId = ratesLab.groupId;
  const objective = Math.max(-0.20, Math.min(1, Number(ratesLab.objective) || 0));
  if (!(netCanoneValue() > 0)) return;
  const exactMarkupFor = item => {
      const band = item.plan.ota === "booking"
        ? (ratePlanBand(item.plan) || "nr")
        : item.plan.ota === "airbnb" && ratePlanBand(item.plan) === "refund" ? "refund" : "nr";
      const reference = directPublishedDiscountedForBand(groupId, band) || 0;
      if (!(reference > 0)) return null;
      const targetNet = reference * (1 + objective);
      let low = 0;
      let high = 5;
      for (let index = 0; index < 64; index += 1) {
        const middle = (low + high) / 2;
        const simulation = ratePlanSimulation(groupId, item.plan, { planMarkup: middle, seasonality: ratesLab.seasonality });
        if ((Number(simulation.netto) || 0) < targetNet) low = middle;
        else high = middle;
      }
      return Math.max(0, Math.round(((low + high) / 2) * 10000) / 10000);
  };
  for (const ota of STRATEGY_OTAS.filter(item => item.id !== "airbnb")) {
    for (const item of ratePlanSimulationsForOta(groupId, ota.id)) {
      const exactMarkup = exactMarkupFor(item);
      if (exactMarkup === null) continue;
      ratesLab.markups[ratesLabPlanKey(item.plan)] = exactMarkup;
    }
  }
  const airbnbRows = ratePlanSimulationsForOta(groupId, "airbnb");
  const referencePlan = ratesLabAirbnbReferencePlan(groupId);
  const referenceRow = airbnbRows.find(item => item.plan.id === referencePlan?.id)
    || airbnbRows.find(item => !item.plan.airbnbMobileVariant && ratePlanBand(item.plan) === "refund")
    || airbnbRows[0];
  if (referenceRow) {
    const sharedMarkup = exactMarkupFor(referenceRow);
    if (sharedMarkup !== null) normalizeRatesLabAirbnbMarkups(groupId, ratesLab.markups, sharedMarkup);
  }
}

const STABLE_TAB_SELECTOR = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"])';
function stableTabElements(root) {
  return [...root.querySelectorAll(STABLE_TAB_SELECTOR)].filter(element => {
    if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}
function stableTabDescriptor(element, index) {
  return {
    id: element.id || "",
    tag: element.tagName,
    type: element.getAttribute("type") || "",
    name: element.getAttribute("name") || "",
    data: { ...element.dataset },
    index,
  };
}
function findStableTabTarget(root, descriptor) {
  const elements = stableTabElements(root);
  if (descriptor.id) {
    const byId = document.getElementById(descriptor.id);
    if (byId && elements.includes(byId)) return byId;
  }
  const candidates = elements.filter(element => {
    if (element.tagName !== descriptor.tag) return false;
    if ((element.getAttribute("type") || "") !== descriptor.type) return false;
    if (descriptor.name && element.getAttribute("name") !== descriptor.name) return false;
    return Object.entries(descriptor.data).every(([key, value]) => element.dataset[key] === value);
  });
  return candidates[0] || elements[Math.min(descriptor.index, Math.max(0, elements.length - 1))] || null;
}
function bindStableTabNavigation(root) {
  if (root.dataset.stableTabNavigation === "true") return;
  root.dataset.stableTabNavigation = "true";
  root.addEventListener("keydown", event => {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    const current = event.target.closest(STABLE_TAB_SELECTOR);
    if (!current || !root.contains(current)) return;
    const elements = stableTabElements(root);
    const currentIndex = elements.indexOf(current);
    if (currentIndex < 0 || elements.length < 2) return;
    const nextIndex = (currentIndex + (event.shiftKey ? -1 : 1) + elements.length) % elements.length;
    const descriptor = stableTabDescriptor(elements[nextIndex], nextIndex);
    event.preventDefault();
    event.stopImmediatePropagation();
    current.blur();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = findStableTabTarget(root, descriptor);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "nearest", inline: "nearest" });
      const textInputTypes = ["text", "search", "tel", "url", "email", "password"];
      if (target.tagName === "TEXTAREA" || (target.tagName === "INPUT" && textInputTypes.includes(target.type))) target.select?.();
    }));
  }, true);
}
function renderRatesLabChart(rows) {
  const width = 1200, left = 0, right = 0, top = 110, rowH = 72, gridTop = 82, height = Math.max(310, top + rows.length * rowH + 30);
  const objective = Number(ratesLab?.objective) || 0;
  const tolerance = Math.max(0, Number(ratesLab?.tolerance) || 0);
  const easyObjective = (1 + objective) * 1.10 - 1;
  const refundObjective = (1 + objective) * 1.20 - 1;
  const nrReferenceRow = rows.find(row => ratePlanBand(row.plan) === "nr") || rows[0] || {};
  const siteNrReference = Number(nrReferenceRow.reference) || 0;
  const siteNrWithTaxReference = Number(nrReferenceRow.customerReference) || siteNrReference;
  // The percentage grid is deliberately compact: every displayed 5% band is half-width,
  // while 0% stays centred in the complete chart. Objective bands keep their prior width.
  const axisMin = -0.60, axisMax = 0.60;
  const ticks = Array.from({ length: 13 }, (_, i) => -0.30 + i * .05);
  const visualBandTolerance = Math.min(tolerance, 0.015);
  const otaColors = { booking: "#e8f3fc", expedia: "#fff0e2", airbnb: "#ffe9eb", vrbo: "#e8f4eb" };
  const renderPanel = ({ id, title, description, referenceLabel, zeroReference, netPosition, finalPosition, netLabelRatio, finalLabelRatio, showTargets = false }) => {
    const x = ratio => left + ((Math.max(axisMin, Math.min(axisMax, Number(ratio) || 0)) - axisMin) / (axisMax - axisMin)) * (width - left - right);
    const otaBands = STRATEGY_OTAS.map(ota => {
      const indexes = rows.map((row, index) => row.ota.id === ota.id ? index : -1).filter(index => index >= 0);
      if (!indexes.length) return "";
      const first = Math.min(...indexes), last = Math.max(...indexes);
      const y = top + first * rowH - rowH / 2;
      const h = (last - first + 1) * rowH;
      return `<rect class="rates-ota-band ota-${ota.id}" x="0" y="${y}" width="${width}" height="${h}" fill="${otaColors[ota.id] || "#f4f7f9"}"/><line class="rates-ota-separator" x1="0" y1="${y + h}" x2="${width}" y2="${y + h}"/>`;
    }).join("");
    const bookingIndexes = rows.map((row, index) => row.ota.id === "booking" ? index : -1).filter(index => index >= 0);
    const bookingY = bookingIndexes.length ? top + Math.min(...bookingIndexes) * rowH - rowH / 2 : top;
    const bookingH = bookingIndexes.length ? (Math.max(...bookingIndexes) - Math.min(...bookingIndexes) + 1) * rowH : 0;
    const allRowsY = top - rowH / 2;
    const allRowsH = rows.length * rowH;
    const targetBand = (center, cssClass, areaY, areaH) => {
      const start = Math.max(axisMin, center - visualBandTolerance), end = Math.min(axisMax, center + visualBandTolerance);
      return `<rect class="rates-booking-target ${cssClass}" x="${x(start)}" y="${areaY}" width="${Math.max(0, x(end) - x(start))}" height="${areaH}"/>`;
    };
    const objectiveStart = Math.max(axisMin, objective - visualBandTolerance), objectiveEnd = Math.min(axisMax, objective + visualBandTolerance);
    const targetBands = showTargets
      ? `<rect class="rates-target-band" x="${x(objectiveStart)}" y="${gridTop}" width="${Math.max(0, x(objectiveEnd) - x(objectiveStart))}" height="${height - gridTop - 18}"/>${bookingIndexes.length ? targetBand(easyObjective, "easy", bookingY, bookingH) : ""}${rows.some(row => ["booking", "airbnb"].includes(row.ota.id) && ratePlanBand(row.plan) === "refund") ? targetBand(refundObjective, "refund", allRowsY, allRowsH) : ""}`
      : "";
    const grid = ticks.map(value => `<g class="${Math.abs(value) < .0001 ? "zero" : ""}"><line x1="${x(value)}" y1="${gridTop}" x2="${x(value)}" y2="${height - 16}"/><text x="${x(value)}" y="${gridTop - 8}">${formatValue(value, "0%")}</text></g>`).join("");
    const dots = rows.map((row, index) => {
      const y = top + index * rowH;
      const net = netPosition(row);
      const final = finalPosition(row);
      const netLabel = netLabelRatio(row);
      const finalLabel = finalLabelRatio(row);
      const planBand = ["booking", "airbnb"].includes(row.ota.id) ? ratePlanBand(row.plan) : "nr";
      const rowObjective = planBand === "easy" ? easyObjective : planBand === "refund" ? refundObjective : objective;
      const netTone = showTargets && Math.abs(net - rowObjective) <= tolerance ? "in-target" : "";
      const baseObjectiveDot = showTargets && ((row.ota.id === "booking" && ["easy", "refund"].includes(planBand)) || (row.ota.id === "airbnb" && planBand === "refund"))
        ? `<circle class="rates-dot base-objective" cx="${x(objective)}" cy="${y}" r="5"><title>Obiettivo base NR ${formatValue(objective, "0.00%")}</title></circle>` : "";
      return `<g class="rates-dot-row"><text class="rates-label" x="8" y="${y - 4}">${escapeHtml(row.ota.label)} · ${escapeHtml(row.plan.name)}</text><text class="rates-reference" x="8" y="${y + 15}">${referenceLabel(row)}</text><line class="rates-range" x1="${x(net)}" y1="${y}" x2="${x(final)}" y2="${y}"/>${baseObjectiveDot}<circle class="rates-dot final" cx="${x(final)}" cy="${y}" r="7"><title>Cliente ${formatValue(row.finale)} · ${formatValue(finalLabel, "0.00%")}</title></circle><circle class="rates-dot published ${netTone}" cx="${x(net)}" cy="${y}" r="8"><title>Netto OTA ${formatValue(row.netto)} · ${formatValue(netLabel, "0.00%")}</title></circle><text class="rates-value-label final" x="${x(final)}" y="${y - 12}">${formatValue(row.finale)} · ${formatValue(finalLabel, "0.0%")}</text><text class="rates-value-label published" x="${x(net)}" y="${y + 21}">${formatValue(row.netto)} · ${formatValue(netLabel, "0.0%")}</text></g>`;
    }).join("");
    const markers = showTargets ? `<span class="rates-marker nr">NR ${formatValue(objective, "0.00%")}</span><span class="rates-marker easy">Easy ${formatValue(easyObjective, "0.00%")}</span><span class="rates-marker refund">Refund ${formatValue(refundObjective, "0.00%")}</span>` : "";
    return `<section class="rates-graph-panel rates-graph-${id}"><div class="rates-graph-head"><div><h3>${title}</h3><p>${description}</p></div><div class="rates-graph-markers">${markers}</div></div><div class="rates-chart-wrap"><svg class="rates-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><text class="rates-zero-reference" x="${x(0)}" y="24">${zeroReference}</text><text class="rates-zero-caption" x="${x(0)}" y="42">0,00%</text>${otaBands}${targetBands}<g class="rates-grid">${grid}</g>${dots}</svg></div></section>`;
  };
  const renderTaxPanel = () => {
    const chartWidth = 720;
    const chartLeft = 210;
    const chartRight = 26;
    const chartTop = 70;
    const chartRowH = 62;
    const chartHeight = Math.max(250, chartTop + rows.length * chartRowH + 22);
    const values = rows.flatMap(row => [Number(row.customerReference) || 0, Number(row.finale) || 0]).filter(value => value > 0);
    const minimum = values.length ? Math.min(...values) : 0;
    const maximum = values.length ? Math.max(...values) : 1;
    const padding = Math.max(1, (maximum - minimum) * .12);
    const rangeMin = Math.max(0, minimum - padding);
    const rangeMax = Math.max(rangeMin + 1, maximum + padding);
    const x = value => chartLeft + ((Math.max(rangeMin, Math.min(rangeMax, Number(value) || 0)) - rangeMin) / (rangeMax - rangeMin)) * (chartWidth - chartLeft - chartRight);
    const bands = STRATEGY_OTAS.map(ota => {
      const indexes = rows.map((row, index) => row.ota.id === ota.id ? index : -1).filter(index => index >= 0);
      if (!indexes.length) return "";
      const first = Math.min(...indexes), last = Math.max(...indexes);
      const y = chartTop + first * chartRowH - chartRowH / 2;
      const h = (last - first + 1) * chartRowH;
      return `<rect class="rates-ota-band ota-${ota.id}" x="0" y="${y}" width="${chartWidth}" height="${h}" fill="${otaColors[ota.id] || "#f4f7f9"}"/><line class="rates-ota-separator" x1="0" y1="${y + h}" x2="${chartWidth}" y2="${y + h}"/>`;
    }).join("");
    const rowsMarkup = rows.map((row, index) => {
      const y = chartTop + index * chartRowH;
      const direct = Number(row.customerReference) || 0;
      const final = Number(row.finale) || 0;
      const delta = direct ? final / direct - 1 : 0;
      const xDirect = x(direct);
      const xFinal = x(final);
      const direction = delta >= 0 ? "delta-positive" : "delta-negative";
      return `<g class="rates-tax-row"><text class="rates-label" x="8" y="${y - 4}">${escapeHtml(row.ota.label)} · ${escapeHtml(row.plan.name)}</text><text class="rates-reference" x="8" y="${y + 14}">Sito + tassa ${formatValue(direct)}</text><line class="rates-range" x1="${xDirect}" y1="${y}" x2="${xFinal}" y2="${y}"/><circle class="rates-dot published" cx="${xDirect}" cy="${y}" r="7"><title>Sito + tassa ${formatValue(direct)}</title></circle><circle class="rates-dot final" cx="${xFinal}" cy="${y}" r="7"><title>Cliente OTA ${formatValue(final)}</title></circle><text class="rates-tax-value published" x="${xDirect}" y="${y + 20}">${formatValue(direct)}</text><text class="rates-tax-value final" x="${xFinal}" y="${y - 12}">${formatValue(final)}</text><text class="rates-tax-delta ${direction}" x="${Math.max(chartLeft, Math.min(chartWidth - chartRight, (xDirect + xFinal) / 2))}" y="${y - 27}">${formatValue(delta, "0.0%")}</text></g>`;
    }).join("");
    return `<section class="rates-graph-panel rates-graph-with-tax"><div class="rates-graph-head"><div><h3>Confronto con tassa di soggiorno</h3><p>Blu: sito diretto con tassa. Rosso: cliente OTA con tassa. La linea mostra il delta.</p></div></div><div class="rates-chart-wrap"><svg class="rates-chart rates-tax-chart" viewBox="0 0 ${chartWidth} ${chartHeight}" role="img" aria-label="Confronto con tassa di soggiorno">${bands}${rowsMarkup}</svg></div></section>`;
  };
  return `<div class="rates-dual-charts">${renderPanel({
    id: "without-tax",
    title: "Confronto senza tassa di soggiorno",
    description: "Blu: netto OTA. Rosso: prezzo cliente. Posizione ordinata sul riferimento NR senza tassa.",
    referenceLabel: row => `Rif. sito ${formatValue(row.reference)}`,
    zeroReference: `Rif. NR sito ${formatValue(siteNrReference)}`,
    netPosition: row => siteNrReference ? (Number(row.netto) || 0) / siteNrReference - 1 : 0,
    finalPosition: row => siteNrReference ? (Number(row.finale) || 0) / siteNrReference - 1 : 0,
    netLabelRatio: row => Number(row.nettoRatio) || 0,
    finalLabelRatio: row => row.reference ? (Number(row.finale) || 0) / row.reference - 1 : 0,
    showTargets: true
  })}${renderTaxPanel()}</div>`;
}
function renderRatesLabPrintMarkups(rows) {
  const seasonality = Number(ratesLab?.seasonality) || 0;
  const body = rows.map(row => {
    const totalMarkup = (1 + seasonality) * (1 + row.markup) - 1;
    return `<tr><td>${escapeHtml(row.ota.label)}</td><td>${escapeHtml(row.plan.name)}</td><td>${formatValue(row.markup, "0.00%")}</td><td>${formatValue(seasonality, "0.00%")}</td><td>${formatValue(totalMarkup, "0.00%")}</td></tr>`;
  }).join("");
  return `<section class="rates-print-markups"><h3>Markup impostati per OTA</h3><table><thead><tr><th>OTA</th><th>Piano tariffario</th><th>Markup OTA / piano</th><th>Markup stagionalita</th><th>Markup complessivo</th></tr></thead><tbody>${body}</tbody></table></section>`;
}
function renderRatesLab() {
  const groupId = ratesLab?.groupId || parameterStrategy || STRATEGY_GROUPS[0].id;
  initRatesLab(groupId);
  const group = STRATEGY_GROUPS.find(item => item.id === groupId);
  const allRows = ratesLabRows({ includeHidden: true });
  const rows = allRows.filter(row => ratesLab.visibleOtas?.[row.ota.id] !== false);
  const controls = STRATEGY_OTAS.map(ota => {
    const otaRows = allRows.filter(row => row.ota.id === ota.id);
    const visible = ratesLab.visibleOtas?.[ota.id] !== false;
    const mobileToggle = ota.id === "airbnb" ? `<button type="button" class="rates-mobile-toggle" data-rates-airbnb-mobile aria-pressed="${ratesLab.showAirbnbMobile !== false}">${ratesLab.showAirbnbMobile !== false ? "Nascondi Mobile" : "Mostra Mobile"}</button>` : "";
    return `<section class="rates-control-card ota-${ota.id}"><div class="rates-control-head"><h3>${escapeHtml(ota.label)}</h3>${mobileToggle}</div><label class="rates-ota-visible"><input type="checkbox" data-rates-ota-visible="${ota.id}" ${visible ? "checked" : ""}><span>Mostra nel grafico</span></label>${otaRows.length ? otaRows.map(row => `<label><span>${escapeHtml(row.plan.name)}</span><input type="number" min="0" max="300" step="0.1" value="${(row.markup * 100).toFixed(2)}" data-rates-markup="${escapeHtml(row.labKey)}"><small>% markup</small></label>`).join("") : `<p>Predisposta: nessun piano attivo.</p>`}</section>`;
  }).join("");
  return `<div class="rates-lab-page">
    <section class="page-head"><div><p class="eyebrow">${escapeHtml(group?.label || "Categoria")}</p><h2>Grafico OTA Rates VS2</h2><p>Il grafico parte dai Parametri correnti. Le prove restano indipendenti finche non scegli Applica ai parametri.</p></div><div class="rates-actions"><button data-rates-reset>Ripristina dai parametri</button><button class="primary" data-rates-optimize>Calcola markup obiettivo ${formatValue(ratesLab.objective, "0.00%")}</button><button data-rates-load>Carica salvato</button><button data-rates-save>Salva scenario</button><button class="primary" data-rates-apply>Applica ai parametri</button><button data-rates-export>Esporta CSV</button><button class="primary" data-rates-print>Stampa</button></div></section>
    <section class="panel rates-season-control"><div class="rates-objective-controls"><label><span>Markup stagionalita simulato</span><input type="number" min="0" max="200" step="0.1" value="${(ratesLab.seasonality * 100).toFixed(2)}" data-rates-season><small>%</small></label><label><span>Obiettivo netto OTA vs sito</span><input type="number" min="-20" max="100" step="0.1" value="${(ratesLab.objective * 100).toFixed(2)}" data-rates-objective><small>%</small></label><label><span>Tolleranza fascia</span><input type="number" min="0" max="30" step="0.1" value="${(ratesLab.tolerance * 100).toFixed(2)}" data-rates-tolerance><small>±%</small></label><label class="rates-scenario-name"><span>Nome scenario</span><input type="text" maxlength="80" value="${escapeHtml(ratesLab.scenarioName || "")}" placeholder="Es. Markup prudente" data-rates-scenario-name></label></div><div class="rates-legend"><span><i class="final"></i>Prezzo finale cliente</span><span><i class="published"></i>Netto OTA dopo provvigione</span><span><i class="target"></i>Fascia obiettivo</span></div></section>
    <div class="rates-control-grid">${controls}</div>
    ${renderRatesLabPrintMarkups(rows)}
    <section class="panel rates-chart-panel">${renderRatesLabChart(rows)}</section>
  </div>`;
}
function ratePlanBand(plan) {
  const name = String(plan?.name || "").toLowerCase();
  if (name.includes("not refundable") || name.includes("not-refundable") || name.includes("non rimborsabile") || name === "nr") return "nr";
  if (name.includes("easy")) return "easy";
  if (name.includes("refund") || name.includes("rimborsabile") || name.includes("ref")) return "refund";
  return "";
}
function ratePlanDeltaValue(fromValue, toValue) {
  const from = Number(fromValue) || 0;
  const to = Number(toValue) || 0;
  return { amount: to - from, ratio: from ? (to - from) / from : 0 };
}
function ratePlanDeltaCell(fromValue, toValue) {
  const delta = ratePlanDeltaValue(fromValue, toValue);
  const tone = delta.amount > 0.004 ? "positive" : delta.amount < -0.004 ? "negative" : "neutral";
  const amountPrefix = delta.amount > 0.004 ? "+" : "";
  const ratioPrefix = delta.ratio > 0.00004 ? "+" : "";
  return `<span class="plan-delta-value ${tone}">${amountPrefix}${formatValue(delta.amount)}</span><small>${ratioPrefix}${formatValue(delta.ratio, "0.00%")}</small>`;
}
function categoryRatePlanDeltaSection(groupId, otaAccordion = false) {
  const otaBlocks = STRATEGY_OTAS.map(ota => {
    const byBand = {};
    const otaSimulations = ratePlanSimulationsForOta(groupId, ota.id);
    otaSimulations.forEach(item => {
      const band = ratePlanBand(item.plan);
      if (band && !byBand[band]) byBand[band] = item;
    });
    let comparisons = [
      ["NR · punto zero", byBand.nr, byBand.nr],
      ["Easy vs NR", byBand.nr, byBand.easy],
      ["Refund vs NR", byBand.nr, byBand.refund]
    ].filter(([, from, to]) => from && to);
    if (!comparisons.length && otaSimulations.length) {
      comparisons = [[`${otaSimulations[0].plan.name} · punto zero`, otaSimulations[0], otaSimulations[0]]];
    }
    if (!comparisons.length) {
      if (!otaAccordion) return "";
      return `<details class="plan-delta-ota plan-delta-accordion empty">
        <summary><span>${escapeHtml(ota.label)}</span><span class="strategy-pill">Da collegare</span></summary>
        <div class="plan-delta-empty">I piani tariffari e i relativi delta di ${escapeHtml(ota.label)} saranno visualizzati qui quando verranno mappati.</div>
      </details>`;
    }
    const body = comparisons.map(([label, from, to]) => `<tr>
      <td><strong>${label}</strong></td>
      <td class="num">${ratePlanDeltaCell(from.sim.afterPlanMarkup, to.sim.afterPlanMarkup)}</td>
      <td class="num">${ratePlanDeltaCell(from.sim.targetCliente, to.sim.targetCliente)}</td>
      <td class="num">${ratePlanDeltaCell(from.sim.pubblicare, to.sim.pubblicare)}</td>
      <td class="num">${ratePlanDeltaCell(from.sim.netto, to.sim.netto)}</td>
    </tr>`).join("");
    const table = `<div class="table-wrap"><table class="plan-delta-table">
      <thead><tr><th>Confronto</th><th class="num">Base dopo piano</th><th class="num">Prezzo finale cliente</th><th class="num">Prezzo da pubblicare</th><th class="num">Netto stimato OTA</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`;
    if (otaAccordion) return `<details class="plan-delta-ota plan-delta-accordion">
      <summary><span>${escapeHtml(ota.label)}</span><span class="strategy-pill on">${comparisons.length} ${comparisons.length === 1 ? "confronto" : "confronti"}</span></summary>
      ${table}
    </details>`;
    return `<div class="plan-delta-ota">
      <div class="plan-delta-title"><h4>${escapeHtml(ota.label)}</h4><span class="badge">Confronto piani</span></div>
      ${table}
    </div>`;
  }).filter(Boolean).join("");
  if (!otaBlocks) return "";
  return `<section class="plan-delta-summary">
    <div class="plan-delta-heading">
      <div><h3>Delta tra piani tariffari</h3><p>${otaAccordion ? "Seleziona una OTA per aprire tutti i relativi delta." : "NR è il punto zero. Easy e Refund sono confrontati direttamente con NR, in euro e in percentuale."}</p></div>
    </div>
    <div class="plan-delta-grid">${otaBlocks}</div>
  </section>`;
}
function categoryStrategyOtaSections(groupId) {
  return STRATEGY_OTAS.map(ota => {
    const strategyCount = categoryOtaRows(groupId, ota.id).length;
    const planCount = ratePlanSimulationsForOta(groupId, ota.id).length;
    const panelKey = `${groupId}:${ota.id}`;
    const isOpen = Boolean(categoryOtaOpen[panelKey]);
    return `<details class="panel policy-wide ota-param-section category-ota-section category-ota-collapsible" data-category-ota-details="${panelKey}" data-category-ota-loaded="${isOpen ? "1" : "0"}" ${isOpen ? "open" : ""}>
      <summary class="category-ota-summary">
        <h3>${escapeHtml(ota.label)}</h3>
        <span class="category-ota-summary-meta"><span class="badge">${strategyCount} strategie mappate</span><span class="badge">${planCount} ${planCount === 1 ? "piano attivo" : "piani attivi"}</span></span>
      </summary>
      ${isOpen ? `<div class="category-ota-content">
        <h4>Promo e scontistiche</h4>
        ${categoryOtaStrategyTable(groupId, ota.id)}
        <h4>Piani tariffari</h4>
        ${strategyRatePlanTable(groupId, ota.id)}
      </div>` : ""}
    </details>`;
  }).join("");
}
function categoryOtaRows(groupId, otaId) {
  let rows = STRATEGY_DISCOUNT_ROWS.filter(row => strategyRowSupportsOta(row, otaId)).filter(row => {
    const cfg = strategyDiscountConfig(groupId, row.id);
    return cfg.active === "SI" && cfg.otas[otaId] === "SI";
  });
  if (otaId === "booking") {
    const selected = bookingRatePlanGeniusSelection(groupId);
    const row = selected && STRATEGY_DISCOUNT_ROWS.find(item => item.id === selected.rowId);
    rows = rows.filter(item => item.family !== "Genius");
    if (row) {
      rows.push(row);
    }
  }
  return rows.sort((a, b) => STRATEGY_DISCOUNT_ROWS.indexOf(a) - STRATEGY_DISCOUNT_ROWS.indexOf(b));
}
function categoryOtaStrategyTable(groupId, otaId) {
  const rows = categoryOtaRows(groupId, otaId);
  if (!rows.length) {
    return `<div class="table-wrap strategy-table"><table>
      <thead><tr><th>Promo</th><th>Tipo</th><th>Attiva</th><th>% sconto</th><th>Mapping OTA</th><th>Stato</th></tr></thead>
      <tbody><tr><td colspan="6" class="muted-cell">Nessuna scontistica attiva e mappata su questa OTA per la categoria selezionata.</td></tr></tbody>
    </table></div>`;
  }
  const applicable = new Set(activeStrategyRowsForSimulation(groupId, otaId).flatMap(item => {
    if (Array.isArray(item.nightly)) return item.nightly.filter(Boolean).map(night => night.row.id);
    return [item.row.id];
  }));
  const ratePlanGenius = otaId === "booking" ? bookingRatePlanGeniusSelection(groupId) : null;
  const body = rows.map(row => {
    const cfg = strategyDiscountConfig(groupId, row.id);
    const isApplied = applicable.has(row.id);
    const isRatePlanGenius = ratePlanGenius?.rowId === row.id;
    const displayCfg = isRatePlanGenius ? {
      ...cfg,
      active: "SI",
      otas: { ...cfg.otas, booking: "SI" },
      otaDiscounts: { ...(cfg.otaDiscounts || {}), booking: ratePlanGenius.discount },
    } : cfg;
    return `<tr>
      <td><strong>${escapeHtml(row.code)}</strong><small>${escapeHtml(row.note)}</small></td>
      <td>${escapeHtml(row.family)}</td>
      <td>${strategyYesNoSelect(displayCfg.active, `data-strategy-field="active" data-strategy-group="${groupId}" data-strategy-row="${row.id}"`)}</td>
      <td>${strategyOtaDiscountSelect(displayCfg, groupId, row.id, otaId)}</td>
      <td>${strategyYesNoSelect(displayCfg.otas[otaId], `data-strategy-field="ota" data-strategy-group="${groupId}" data-strategy-row="${row.id}" data-strategy-ota="${otaId}"`)}</td>
      <td><span class="strategy-pill ${isApplied ? "on" : ""}">${isApplied ? "Applicata ora" : "Configurata, non applicata"}</span></td>
    </tr>`;
  }).join("");
  return `<div class="table-wrap strategy-table"><table>
    <thead><tr><th>Promo</th><th>Tipo</th><th>Attiva</th><th>% sconto</th><th>Mapping OTA</th><th>Stato</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`;
}
function inputResultValue(row) {
  if (row === 5) return seasonalBase();
  const pageByRow = { 6: "booking", 7: "airbnb", 8: "expedia", 9: "vrbo" };
  return targetAfterTiming(pageByRow[row]);
}
function seasonalitySelect() {
  const current = currentSeasonalityRule().id;
  return `<select class="input-cell seasonality-select" data-seasonality-select>${SEASONALITY_RULES.map(r => `<option value="${r.id}" ${r.id === current ? "selected" : ""}>${escapeHtml(r.label)}</option>`).join("")}</select>`;
}
function seasonalityPanel(groupId = "") {
  const rule = currentSeasonalityRule();
  const breakdown = groupId ? categorySeasonalityBreakdown(groupId) : null;
  const effectiveMarkup = effectiveSeasonalityMarkup(groupId);
  const baseValue = groupId ? netCanoneSeasonalValue(groupId) : seasonalBase();
  const weightEditor = groupId ? `<details class="seasonality-weight-editor"><summary>Profilo tariffe giornaliere</summary><div class="seasonality-weight-grid">${SEASONALITY_RULES.map(item => `<label><span>${escapeHtml(item.label)}</span><input class="input-cell" type="number" min="1" max="200" step="0.01" data-season-base-weight="${item.id}" data-season-base-group="${groupId}" value="${(categorySeasonalityBaseWeight(groupId, item.id) * 100).toFixed(2)}"><small>% della base Altissima</small></label>`).join("")}<label><span>Weekend (ven-sab)</span><input class="input-cell" type="number" min="0" max="200" step="0.01" data-season-weekend-markup data-season-weekend-group="${groupId}" value="${(categoryWeekendBaseMarkup(groupId) * 100).toFixed(2)}"><small>maggiorazione base %</small></label></div></details>` : "";
  return `<div class="seasonality-panel">
    <div>
      <strong>Seleziona regola stagionalita</strong>
      <small>Primo markup applicato al canone/prezzo sorgente prima dei markup OTA.</small>
    </div>
    <div>${seasonalitySelect()}</div>
    <div><span class="badge">Markup ${formatValue(effectiveMarkup, "0.00%")}</span><small>${breakdown?.active && breakdown.peakNights > 0 && breakdown.baseNights > 0 ? "Calcolo giornaliero ponderato sull'incasso" : (breakdown?.baseLabel || rule.label)} · Base per target: ${formatValue(baseValue)}</small></div>
  </div>${weightEditor}`;
}
function channelLink(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("booking.com")) return "booking";
  if (n.includes("airbnb")) return "airbnb";
  if (n.includes("expedia")) return "expedia";
  if (n.includes("vrbo")) return "vrbo";
  return null;
}
function channelPolicyRange(page) {
  return {
    booking: [68, 87],
    expedia: [92, 101],
    airbnb: [106, 117],
    vrbo: [121, 127],
  }[page] || null;
}
function channelCounts(page) {
  const range = channelPolicyRange(page);
  if (!range) return { configured: 0, activeToday: 0, outOfWindow: 0 };
  let configured = 0, activeToday = 0, outOfWindow = 0;
  for (let r = range[0]; r <= range[1]; r++) {
    if (String(getCell("Basic_NR_markup", `E${r}`).v).toUpperCase() === "SI") {
      configured++;
      if (String(val("Basic_NR_markup", `BJ${r}`)).toUpperCase() === "SI") activeToday++; else outOfWindow++;
    }
  }
  for (const p of customPromosFor(page)) {
    if (String(p.active).toUpperCase() === "SI") {
      configured++;
      if (isCustomPromoActive(p)) activeToday++; else outOfWindow++;
    }
  }
  return { configured, activeToday, outOfWindow };
}
function dayDiffFromToday(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((new Date(y, m - 1, d).getTime() - start) / 86400000);
}
function expirySignals(page) {
  const range = channelPolicyRange(page);
  const signals = { expired: 0, expiring: 0, validWithEnd: 0 };
  const add = to => {
    const diff = dayDiffFromToday(to);
    if (diff === null) return;
    if (diff < 0) signals.expired++;
    else if (diff <= 7) signals.expiring++;
    else signals.validWithEnd++;
  };
  if (range) {
    for (let r = range[0]; r <= range[1]; r++) {
      if (String(getCell("Basic_NR_markup", `E${r}`).v).toUpperCase() === "SI") add(datePartsToIso(r, ["N","O","P"]));
    }
  }
  for (const p of customPromosFor(page)) {
    if (String(p.active).toUpperCase() === "SI") add(p.to);
  }
  return signals;
}
function parameterBlock(title, start, end, sourceName) {
  const rows = activeSourceRows(start, end, sourceName);
  return `<section class="panel"><h3>${title}</h3>${table(["Voce","Fonte","Attivo","Sconto"], rows, [3])}</section>`;
}
function otaParameterSection(title, start, end) {
  const rows = activeSourceRows(start, end, title);
  return `<section class="panel policy-wide ota-param-section">
    <h3>${escapeHtml(title)}</h3>
    <h4>Promo/sconti attivi</h4>
    ${table(["Voce","Fonte","Attivo","Sconto"], rows, [3])}
    <h4>Policy sorgente modificabile</h4>
    ${policyCards(start, end)}
  </section>`;
}
function activeSourceRows(start, end, sourceName) {
  const rows = [];
  const page = pageForTitle(sourceName);
  for (let r = start; r <= end; r++) {
    const active = effectivePolicyActive(`E${r}`);
    const discount = val("Basic_NR_markup", `F${r}`);
    const name = promoName(r);
    if (String(active).toUpperCase() === "SI" && name) {
      rows.push([name, sourceName, policyStatus(r), discount]);
    }
  }
  for (const p of customPromosFor(page)) {
    if (isCustomPromoActive(p)) rows.push([`${p.name} (custom)`, sourceName, `${customPromoStatus(p)} - ${logicPreset(p.logic, page).label}`, customDiscount(p)]);
  }
  return rows.length ? rows : [["Nessuna promo attiva", "", "", ""]];
}
function policyBlock(title, start, end) {
  return `<section class="panel policy-wide"><h3>${title}</h3>${policyCards(start, end)}</section>`;
}
function promoPair(row) {
  const technical = val("Basic_NR_markup", `C${row}`) || "";
  const friendly = val("Basic_NR_markup", `D${row}`) || "";
  if (!technical) return { name: friendly || val("Basic_NR_markup", `B${row}`) || "", description: "" };
  if (!friendly) return { name: technical, description: "" };
  return String(friendly).length <= String(technical).length
    ? { name: friendly, description: technical }
    : { name: technical, description: friendly };
}
function promoName(row) { return promoPair(row).name; }
function promoDescription(row) { return promoPair(row).description; }
function inputField(sheet, addr, label, hint) { return `<div class="field"><label>${label}<small>${hint || ""}</small></label>${input(sheet, addr)}</div>`; }
function inputDecimals(sheet, addr) {
  return sheet === "Basic_NR_markup" && ["C6", "C7", "C8", "C9"].includes(normAddr(addr)) ? 3 : 2;
}
function input(sheet, addr, type = "text") {
  const c = getCell(sheet, addr);
  const decimals = inputDecimals(sheet, addr);
  const value = typeof c.v === "number" ? c.v.toLocaleString("it-IT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : displayRaw(c.v);
  return `<input class="input-cell" data-sheet="${sheet}" data-addr="${addr}" value="${escapeHtml(value)}" ${type === "date" ? "type=date" : ""} />`;
}
function select(sheet, addr, choices) {
  const v = displayRaw(getCell(sheet, addr).v);
  return `<select class="input-cell" data-sheet="${sheet}" data-addr="${addr}">${choices.map(c => {
    const value = typeof c === "object" ? c.value : c;
    const label = typeof c === "object" ? c.label : c;
    return `<option value="${escapeHtml(value)}" ${String(value)===v?"selected":""}>${escapeHtml(label)}</option>`;
  }).join("")}</select>`;
}
function discountOptions(current) {
  const base = new Set([0, .01, .02, .03, .04, .05, .06, .07, .08, .09, .10, .12, .15, .18, .20, .22, .25, .28, .30, .35, .40, .45, .50, .60, .70]);
  for (const sheet of Object.values(state.sheets)) for (const cell of Object.values(sheet.cells)) if (!cell.f && typeof cell.v === "number" && cell.v >= 0 && cell.v <= .8) base.add(Math.round(cell.v * 10000) / 10000);
  const n = Number(current); if (Number.isFinite(n) && n >= 0 && n <= .8) base.add(Math.round(n * 10000) / 10000);
  return [...base].sort((a,b)=>a-b).map(v => ({ value: String(v), label: formatValue(v, "0%") }));
}
function discountSelect(sheet, addr) {
  return editablePercentInput(getCell(sheet, addr).v, `data-sheet="${sheet}" data-addr="${addr}"`);
}
function renderPromo(title, start, end, policyStart, policyEnd) {
  const activeRows = activeSourceRows(policyStart, policyEnd, title);
  const audit = promoAudit(title);
  const page = pageForTitle(title);
  const historyOpen = !!otaHistoryOpen[page];
  return `${head(title, "Gestisci attivazione, percentuali e regole collegate. Gli sconti sono selezionabili da menu a tendina e partono dai valori gia evidenziati nel file.")}
  <div class="ota-tools"><button class="secondary" data-toggle-ota-history="${page}">${historyOpen ? "Nascondi storico OTA" : "Apri storico OTA"}</button></div>
  ${historyOpen ? renderOtaHistoryPanel(page, title, policyStart, policyEnd) : ""}
  <section class="panel audit-panel"><h3>Controllo collegamenti e impatto prezzo</h3>${table(["Parametro","Valore","Nota"], audit, [1])}</section>
  ${customPromoPanel(page)}
  <section class="panel"><h3>Promo/sconti attivi oggi</h3>${table(["Promo","Fonte","Stato","% sconto applicato"], activeRows, [3])}</section>
  <section class="panel policy-wide policy-under-active"><h3>Policy sorgente modificabile</h3>${policyCards(policyStart, policyEnd)}</section>`;
}
function renderOtaHistoryPanel(page, title, policyStart, policyEnd) {
  const rows = [];
  let configured = 0, active = 0, inactive = 0, out = 0;
  for (let r = policyStart; r <= policyEnd; r++) {
    const name = promoName(r);
    if (!name) continue;
    const configuredState = String(getCell("Basic_NR_markup", `E${r}`).v || "").toUpperCase();
    const status = policyStatus(r);
    if (configuredState === "SI") configured++; else inactive++;
    if (status === "Attiva" || status === "Attiva nel periodo") active++;
    else if (configuredState === "SI") out++;
    rows.push([name, "Workbook", configuredState || "NO", status, val("Basic_NR_markup", `F${r}`)]);
  }
  for (const p of customPromosFor(page)) {
    const status = customPromoStatus(p);
    if (String(p.active).toUpperCase() === "SI") configured++; else inactive++;
    if (isCustomPromoActive(p)) active++; else if (String(p.active).toUpperCase() === "SI") out++;
    rows.push([p.name, "Custom", p.active, status, customDiscount(p)]);
  }
  const logs = otaLogs(page, title, rows.map(r => r[0])).slice(0, 40);
  const logRows = logs.length ? logs.map(l => `<div class="log-item"><strong>${escapeHtml(l.t)}</strong>${l.action ? ` <span class="log-tag">${escapeHtml(l.action)}</span>` : ""}<br>${escapeHtml(l.msg)}</div>`).join("") : `<div class="notice">Nessuna attivita registrata per ${escapeHtml(title)} in questa sessione.</div>`;
  return `<section class="panel ota-history-panel">
    <div class="panel-title-row"><h3>Storico e stato attivita ${escapeHtml(title)}</h3><span class="badge">${logs.length} eventi</span></div>
    <div class="history-kpis">
      <span>Attive oggi <strong>${active}</strong></span>
      <span>Configurate SI <strong>${configured}</strong></span>
      <span>Fuori periodo <strong>${out}</strong></span>
      <span>Disattivate <strong>${inactive}</strong></span>
    </div>
    ${table(["Promo/offerta","Origine","Configurata","Stato oggi","Sconto"], rows, [4])}
    <h3 class="subhead">Ultime attivita ${escapeHtml(title)}</h3>
    <div class="log-list ota-log-list">${logRows}</div>
  </section>`;
}
function otaLogs(page, title, promoNames = []) {
  const tokens = [page, title, ...promoNames].filter(Boolean).map(x => String(x).toLowerCase());
  return (state.logs || []).filter(l => {
    if (l.ota === page) return true;
    const msg = String(l.msg || "").toLowerCase();
    return tokens.some(t => t && msg.includes(t));
  });
}
function customPromoPanel(page) {
  const promos = customPromosFor(page);
  const categoryList = categoriesFor(page);
  const defaultCategory = categoryList[0] || "Custom";
  const categoryOptions = categoryList.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  const rows = promos.length ? promos.map(p => `<div class="custom-row">
    <div><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.category || "Custom")} - ${escapeHtml(logicPreset(p.logic, page).label)}</span></div>
    <div>${escapeHtml(p.active)} · ${formatValue(customDiscount(p), "0%")}</div>
    <div>${escapeHtml(p.from || "sempre")} / ${escapeHtml(p.to || "sempre")}</div>
    <button class="danger" data-delete-custom="${escapeHtml(p.id)}">Elimina</button>
  </div>`).join("") : `<div class="notice">Nessuna promo custom creata per questa OTA.</div>`;
  return `<section class="panel custom-panel">
    <h3>Aggiungi promo/offerta custom</h3>
    <div class="custom-form" data-custom-page="${page}">
      <label class="promo-name-field">Nome promo<input class="input-cell" data-custom-field="name" placeholder="Es. Summer mobile deal"></label>
      <label class="category-field">Categoria<select class="input-cell" data-custom-field="categoryMode" data-category-select="${page}">${categoryOptions}<option value="__new__">+ Nuova categoria</option></select></label>
      <label class="new-category-field" data-new-category-wrap hidden>Nuova categoria<input class="input-cell" data-custom-field="categoryNew" placeholder="Nome categoria"></label>
      <label class="active-field">Attiva<select class="input-cell" data-custom-field="active"><option>SI</option><option selected>NO</option></select></label>
      <label class="discount-field">Sconto${editablePercentInput(.10, `data-custom-field="discount"`, "discount-percent-options")}</label>
      <label class="logic-field">Logica<select class="input-cell logic-select" data-custom-field="logic" data-logic-select="${page}">${logicOptionsHtml(page, defaultCategory)}</select></label>
      <label class="date-from-field">Valida dal<input class="input-cell" type="date" data-custom-field="from"></label>
      <label class="date-to-field">Valida al<input class="input-cell" type="date" data-custom-field="to"></label>
      <button class="primary custom-add-btn" data-add-custom="${page}">Aggiungi</button>
    </div>
    <div class="logic-help" data-logic-help>${logicHelpHtml(page, defaultCategory)}</div>
    <h3 class="subhead">Promo custom salvate</h3>
    <div class="custom-list">${rows}</div>
  </section>`;
}
function policyCards(start, end) {
  const rows = [];
  for (let r = start; r <= end; r++) {
    rows.push([
      promoName(r),
      promoDescription(r),
      select("Basic_NR_markup",`E${r}`, ["SI","NO",""]),
      discountSelect("Basic_NR_markup",`F${r}`),
      dateInput(r, "from"),
      dateInput(r, "to"),
      `${policyStatus(r)} - Applicato: ${formatValue(val("Basic_NR_markup",`BK${r}`), "0%")}`
    ]);
  }
  return `<div class="policy-table">${table(["Promo/offerta","Descrizione","Attiva","Sconto","Valida dal","Valida al","Stato oggi"], rows, [])}</div>`;
}
function promoAudit(title) {
  const page = pageForTitle(title);
  const effects = customEffects();
  const customRows = page && page !== title ? [
    ["Promo custom attive", customPromosFor(page).filter(isCustomPromoActive).length, "Create direttamente nel software"],
    ["Fattore custom OTA", pctText(effects.otaFactor[page] || 1), "Moltiplica il fattore del workbook"],
    ["Fattore Stay/Timing custom", pctText(effects.timingFactor[page] || 1), "Applicato dopo stagionalita e markup OTA"],
  ] : [];
  if (page === "airbnb") customRows.push(["Special custom Airbnb", pctText(effects.airbnbSpecial), "Somma delle Special custom attive"]);
  const map = {
    "Booking.com": [["Prezzo NR originale", val("Basic_NR_markup", "C5"), "Input manuale"], ["Markup stagionalita", seasonalityMarkup(), currentSeasonalityRule().label], ["Base dopo stagionalita", seasonalBase(), "Primo passaggio obbligatorio"], ["Target dopo markup OTA e Stay/Timing", targetAfterTiming("booking"), "Stagionalita -> markup Booking -> Stay/Timing"], ["Fattore sconto Booking", pctText(val("Basic_NR_markup", "S72")), "MIN tra combinazioni cumulabili del file"]],
    "Expedia": [["Prezzo NR originale", val("Basic_NR_markup", "C5"), "Input manuale"], ["Markup stagionalita", seasonalityMarkup(), currentSeasonalityRule().label], ["Base dopo stagionalita", seasonalBase(), "Primo passaggio obbligatorio"], ["Target dopo markup OTA e Stay/Timing", targetAfterTiming("expedia"), "Stagionalita -> markup Expedia -> Stay/Timing"], ["Fattore sconto Expedia", pctText(val("Basic_NR_markup", "S95")), "Logica Expedia del workbook"]],
    "Airbnb": [["Prezzo NR originale", val("Basic_NR_markup", "C5"), "Input manuale"], ["Markup stagionalita", seasonalityMarkup(), currentSeasonalityRule().label], ["Base dopo stagionalita", seasonalBase(), "Primo passaggio obbligatorio"], ["Target dopo markup OTA e Stay/Timing", targetAfterTiming("airbnb"), "Stagionalita -> markup Airbnb -> Stay/Timing"], ["Fattore sconto Airbnb", pctText(val("Basic_NR_markup", "S107")), "Logica Airbnb del workbook"], ["Special cumulabili", pctText(val("Basic_NR_markup", "S113")), "High rated guest + Mobile only, se attive"]],
    "Vrbo": [["Prezzo NR originale", val("Basic_NR_markup", "C5"), "Input manuale"], ["Markup stagionalita", seasonalityMarkup(), currentSeasonalityRule().label], ["Base dopo stagionalita", seasonalBase(), "Primo passaggio obbligatorio"], ["Target dopo markup OTA e Stay/Timing", targetAfterTiming("vrbo"), "Stagionalita -> markup Vrbo -> Stay/Timing"], ["Fattore sconto Vrbo", pctText(val("Basic_NR_markup", "U128")), "Mono-applicabilita e priorita del workbook"], ["Sconto Vrbo prioritario", pctText(val("Basic_NR_markup", "U122")), "Massimo sconto prioritario del workbook"]],
  };
  return [...(map[title] || []), ...customRows];
}
function pctText(v) { return formatValue(v, "0.00%"); }
function productRange(sheet, start, end) {
  const a = splitAddr(start), b = splitAddr(end);
  let product = 1;
  for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
    for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) product *= toNumber(val(sheet, `${numToCol(c)}${r}`));
  }
  return product;
}
function renderStrategies() {
  const subtitle = "Mappa centrale delle politiche 2026/27: Last minute, Prenota prima, Long stay, restrizioni e piani tariffari salvati per categoria e OTA.";
  if (!strategyPage || !STRATEGY_GROUPS.some(g => g.id === strategyPage)) {
    const cards = STRATEGY_GROUPS.map(group => {
      const counts = strategyCounts(group.id);
      return `<button class="strategy-card" data-strategy-open="${group.id}">
        <span>${escapeHtml(group.label)}</span>
        <em>${group.subtitle ? escapeHtml(group.subtitle) : "&nbsp;"}</em>
        <strong>${counts.active} scontistiche attive</strong>
        <small>${counts.mapped} mapping OTA impostati</small>
      </button>`;
    }).join("");
    return `${head("Politiche e Strategie 2026/27", subtitle)}
    <section class="strategy-grid">${cards}</section>`;
  }
  const group = STRATEGY_GROUPS.find(g => g.id === strategyPage);
  const section = (id, title, meta, content, extra = "") => {
    const key = `${group.id}:${id}`;
    return `<details class="panel strategy-section strategy-collapsible" data-strategy-section="${key}" ${strategySectionOpen[key] ? "open" : ""} ${extra}>
      <summary class="strategy-section-summary"><span>${escapeHtml(title)}</span><span class="strategy-section-meta">${meta || ""}<b class="strategy-section-toggle" aria-hidden="true"></b></span></summary>
      <div class="strategy-section-content">${content}</div>
    </details>`;
  };
  return `${head(`Politiche e Strategie 2026/27 - ${group.label}`, subtitle)}
  <div class="strategy-actions"><button data-strategy-back>← Torna alle categorie</button></div>
  ${section("discounts", "SCONTISTICHE", `<span class="badge">${strategyCounts(group.id).active} attive</span>`, strategyDiscountTable(group.id))}
  ${section("restrictions", "RESTRIZIONI", "", strategyPlaceholderTable(["Restrizione", "Attiva", "Valore", "Booking", "Expedia", "Airbnb", "Vrbo", "Nota"]))}
  ${section("conditions", "CONDIZIONI", strategyConditionSummaryBadges(group.id), strategyConditionTable(group.id), `id="strategy-conditions"`)}
  ${section("rateplans", "PIANI TARIFFARI", "", strategyRatePlanTable(group.id))}`;
}
function strategyDiscountTable(groupId) {
  const groups = [
    { title: "LAST MINUTE", family: "Last minute" },
    { title: "PRENOTA PRIMA", family: "Prenota prima" },
    { title: "LONG STAY", family: "Long stay" },
    { title: "GENIUS", family: "Genius" },
    { title: "MOBILE", family: "Mobile" },
    { title: "SCONTO PAESE", family: "Paese" },
    { title: "OFFERTE / CAMPAGNE", family: "Offerte" },
  ];
  return `<div class="strategy-family-grid">${groups.map(group => strategyFamilyTable(groupId, group)).join("")}</div>`;
}
function strategyFamilyTable(groupId, group) {
  const key = `${groupId}:family:${group.family}`;
  const rows = STRATEGY_DISCOUNT_ROWS.filter(row => row.family === group.family).map(row => {
    const cfg = strategyDiscountConfig(groupId, row.id);
    const otaCells = STRATEGY_OTAS.map(ota => strategyRowSupportsOta(row, ota.id)
      ? `<td>${strategyOtaControl(groupId, row.id, cfg, ota)}</td>`
      : `<td class="muted-cell">Non prevista</td>`).join("");
    const mapped = STRATEGY_OTAS.filter(ota => strategyRowSupportsOta(row, ota.id) && cfg.otas[ota.id] === "SI").map(ota => `${ota.label} ${formatValue(strategyOtaDiscount(cfg, ota.id), "0%")}`).join(", ") || "Nessuna OTA";
    return `<tr>
      <td><strong>${escapeHtml(row.code)}</strong><small>${escapeHtml(row.note)}</small></td>
      <td>${strategyYesNoSelect(cfg.active, `data-strategy-field="active" data-strategy-group="${groupId}" data-strategy-row="${row.id}"`)}</td>
      ${otaCells}
      <td><span class="strategy-pill ${cfg.active === "SI" ? "on" : ""}">${cfg.active === "SI" ? "Attiva" : "Disattiva"}</span><small>${escapeHtml(mapped)}</small></td>
    </tr>`;
  }).join("");
  return `<details class="strategy-family-card strategy-family-collapsible" data-strategy-section="${key}" ${strategySectionOpen[key] ? "open" : ""}>
    <summary class="strategy-family-head">
      <h4>${escapeHtml(group.title)}</h4>
      <span>${STRATEGY_DISCOUNT_ROWS.filter(row => row.family === group.family).length} regole <b class="strategy-family-toggle" aria-hidden="true"></b></span>
    </summary>
    <div class="table-wrap strategy-table"><table>
      <thead><tr><th>Promo</th><th>Attiva generale</th>${STRATEGY_OTAS.map(ota => `<th>${ota.label}<small>Attiva + %</small></th>`).join("")}<th>Stato mapping</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </details>`;
}
function strategyPlaceholderTable(headers) {
  return `<div class="table-wrap strategy-table"><table>
    <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody><tr><td colspan="${headers.length}" class="muted-cell">Struttura pronta: qui inseriremo le politiche effettive appena mi passi regole, vincoli e piani tariffari.</td></tr></tbody>
  </table></div>`;
}
function strategyConditionCounts(groupId) {
  const conditions = state.strategies?.[groupId]?.conditions || {};
  const totals = {
    totalEur: 0,
    totalPct: 0,
    nightEur: 0,
    nightPct: 0,
    prnEur: 0,
    prnPct: 0,
    unitEur: 0,
    unitPct: 0,
    personEur: 0,
    personPct: 0,
  };
  let active = 0, mapped = 0;
  for (const cfg of Object.values(conditions)) {
    if (cfg.active === "SI") {
      active++;
      const amount = Number(cfg.amount) || 0;
      const isPct = cfg.valueType === "pct";
      const period = cfg.period === "night" ? "night" : "prn";
      const basis = cfg.basis === "person" ? "person" : "unit";
      totals[isPct ? "totalPct" : "totalEur"] += amount;
      totals[`${period}${isPct ? "Pct" : "Eur"}`] += amount;
      totals[`${basis}${isPct ? "Pct" : "Eur"}`] += amount;
    }
    mapped += Object.values(cfg.otas || {}).filter(v => v === "SI").length;
  }
  return { active, mapped, ...totals };
}
function strategyConditionSummaryBadges(groupId) {
  const counts = strategyConditionCounts(groupId);
  const money = value => value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = value => value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<div class="condition-summary">
    <span class="badge">${counts.active} attive</span>
    <span class="badge condition-total">Notte EUR ${money(counts.nightEur)}</span>
    <span class="badge condition-total">Notte % ${pct(counts.nightPct)}%</span>
    <span class="badge condition-total">PRN EUR ${money(counts.prnEur)}</span>
    <span class="badge condition-total">PRN % ${pct(counts.prnPct)}%</span>
    <span class="badge condition-total">Unita EUR ${money(counts.unitEur)}</span>
    <span class="badge condition-total">Unita % ${pct(counts.unitPct)}%</span>
    <span class="badge condition-total">Persona EUR ${money(counts.personEur)}</span>
    <span class="badge condition-total">Persona % ${pct(counts.personPct)}%</span>
    <span class="badge condition-total strong">Totale EUR ${money(counts.totalEur)}</span>
    <span class="badge condition-total strong">Totale % ${pct(counts.totalPct)}%</span>
  </div>`;
}
function strategyConditionConfig(groupId, conditionId) {
  if (!state.strategies) state.strategies = defaultStrategyState();
  if (!state.strategies[groupId] || !state.strategies[groupId].conditions?.[conditionId]) state.strategies = mergeStrategyState(state.strategies);
  return state.strategies[groupId].conditions[conditionId];
}
function conditionCostForOta(groupId, otaId, targetBase = 0) {
  const conditions = state.strategies?.[groupId]?.conditions || {};
  const nights = Math.max(1, Number(simulatedNights()) || 1);
  let eur = 0, pctValue = 0, nightEur = 0, prnEur = 0, personEur = 0, unitEur = 0, count = 0;
  for (const cfg of Object.values(conditions)) {
    if (cfg.active !== "SI" || cfg.otas?.[otaId] !== "SI") continue;
    count++;
    const multiplier = cfg.period === "night" ? nights : 1;
    const amount = Math.max(0, Number(cfg.amount) || 0);
    const lineCost = cfg.valueType === "pct" ? targetBase * (amount / 100) * multiplier : amount * multiplier;
    eur += lineCost;
    if (cfg.valueType === "pct") pctValue += lineCost;
    if (cfg.period === "night") nightEur += lineCost; else prnEur += lineCost;
    if (cfg.basis === "person") personEur += lineCost; else unitEur += lineCost;
  }
  return { total: eur, pctValue, nightEur, prnEur, personEur, unitEur, count, source: "mapped" };
}
function otaCostForPlan(groupId, otaId, targetBase = 0) {
  const manualOta = manualOtaCostTotalValue(groupId, otaId);
  if (manualOta !== null) {
    return {
      total: manualOta,
      pctValue: 0,
      nightEur: 0,
      prnEur: manualOta,
      personEur: 0,
      unitEur: manualOta,
      count: manualOta > 0 ? 1 : 0,
      source: "manual-ota",
    };
  }
  return conditionCostForOta(groupId, otaId, targetBase);
}
function conditionBasisSelect(value, groupId, conditionId) {
  return `<select class="input-cell strategy-select" data-condition-field="basis" data-condition-group="${groupId}" data-condition-id="${conditionId}">
    <option value="unit" ${value !== "person" ? "selected" : ""}>A unita</option>
    <option value="person" ${value === "person" ? "selected" : ""}>A persona</option>
  </select>`;
}
function conditionPeriodSelect(value, groupId, conditionId) {
  return `<select class="input-cell strategy-select" data-condition-field="period" data-condition-group="${groupId}" data-condition-id="${conditionId}">
    <option value="stay" ${value !== "night" ? "selected" : ""}>PRN</option>
    <option value="night" ${value === "night" ? "selected" : ""}>A notte</option>
  </select>`;
}
function conditionValueTypeSelect(value, groupId, conditionId) {
  return `<select class="input-cell strategy-select" data-condition-field="valueType" data-condition-group="${groupId}" data-condition-id="${conditionId}">
    <option value="eur" ${value !== "pct" ? "selected" : ""}>EUR</option>
    <option value="pct" ${value === "pct" ? "selected" : ""}>%</option>
  </select>`;
}
function conditionAmountInput(value, groupId, conditionId) {
  const options = CONDITION_AMOUNT_VALUES.map(v => `<option value="${v}">${v.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</option>`).join("");
  const display = (Number(value) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<div class="percent-combo-wrap condition-amount-wrap">
    <input class="input-cell condition-amount-input" data-condition-field="amount" data-condition-group="${groupId}" data-condition-id="${conditionId}" value="${escapeHtml(display)}">
    <select class="input-cell percent-preset-select" data-condition-amount-preset title="Valori rapidi">
      <option value=""></option>${options}
    </select>
  </div>`;
}
function strategyConditionTable(groupId) {
  const rows = STRATEGY_CONDITION_ROWS.map(row => {
    const cfg = strategyConditionConfig(groupId, row.id);
    const otaCells = STRATEGY_OTAS.map(ota => `<td>${strategyYesNoSelect(cfg.otas[ota.id], `data-condition-field="ota" data-condition-group="${groupId}" data-condition-id="${row.id}" data-condition-ota="${ota.id}"`)}</td>`).join("");
    const mapped = STRATEGY_OTAS.filter(ota => cfg.otas[ota.id] === "SI").map(ota => ota.label).join(", ") || "Nessuna OTA";
    return `<tr>
      <td><strong>${escapeHtml(row.label)}</strong><small>${escapeHtml(mapped)}</small></td>
      <td>${conditionBasisSelect(cfg.basis, groupId, row.id)}</td>
      <td>${conditionPeriodSelect(cfg.period, groupId, row.id)}</td>
      <td>${strategyYesNoSelect(cfg.active, `data-condition-field="active" data-condition-group="${groupId}" data-condition-id="${row.id}"`)}</td>
      ${otaCells}
      <td>${conditionAmountInput(cfg.amount, groupId, row.id)}</td>
      <td>${conditionValueTypeSelect(cfg.valueType, groupId, row.id)}</td>
      <td><span class="strategy-pill ${cfg.active === "SI" ? "on" : ""}">${cfg.active === "SI" ? "Attiva" : "Disattiva"}</span></td>
    </tr>`;
  }).join("");
  return `<div class="table-wrap strategy-table condition-table"><table>
    <thead><tr><th>Condizione/costo</th><th>Tipo</th><th>Periodo</th><th>Attiva</th>${STRATEGY_OTAS.map(ota => `<th>${ota.label}</th>`).join("")}<th>Prezzo/valore</th><th>Unita valore</th><th>Stato</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}
function strategyRatePlanTable(groupId, otaId = "") {
  if (!otaId) return `<div class="strategy-family-grid">${STRATEGY_OTAS.map(ota => strategyRatePlanOtaCard(groupId, ota)).join("")}</div>`;
  return strategyRatePlanInnerTable(groupId, otaId);
}
function strategyRatePlanOtaCard(groupId, ota) {
  const plans = STRATEGY_RATE_PLANS.filter(plan => plan.groupId === groupId && plan.ota === ota.id && !plan.airbnbMobileVariant);
  return `<article class="strategy-family-card rate-plan-ota-card">
    <div class="strategy-family-head">
      <h4>${escapeHtml(ota.label)}</h4>
      <span>${plans.length} piani</span>
    </div>
    ${strategyRatePlanInnerTable(groupId, ota.id)}
  </article>`;
}
function strategyRatePlanInnerTable(groupId, otaId = "") {
  const plans = STRATEGY_RATE_PLANS.filter(plan => plan.groupId === groupId && (!otaId || plan.ota === otaId) && !(otaId === "airbnb" && plan.airbnbMobileVariant));
  const airbnbOnly = otaId === "airbnb";
  const showGenius2 = otaId === "booking";
  const optionHeaders = airbnbOnly
    ? `<th class="airbnb-discount-heading">Sconto NR<small>-10%</small></th>`
    : `<th>Genius 1<small>10%</small></th>${showGenius2 ? `<th>Genius 2<small>15%</small></th>` : ""}<th>Preferiti<small>5%</small></th>`;
  const columnCount = airbnbOnly ? 15 : (showGenius2 ? 17 : 16);
  if (!plans.length) {
    return `<div class="table-wrap strategy-table rate-plan-table"><table>
      <thead><tr><th>Piano tariffario</th><th>OTA</th><th>Attivo</th><th>Ricarico base</th>${optionHeaders}<th>Ricarico complessivo</th><th>Prezzo cliente finale</th><th>Pubblicare barrato</th><th>Costi condizioni</th><th>Markup definitivo da canone netto</th><th>Netto dopo provvigione</th><th>Riferimento sito diretto</th><th>Delta netto OTA vs sito</th><th>Policy cancellazione</th><th>Incasso</th></tr></thead>
      <tbody><tr><td colspan="${columnCount}" class="muted-cell">Nessun piano tariffario ancora mappato per questa categoria.</td></tr></tbody>
    </table></div>`;
  }
  const rows = plans.map(plan => {
    const cfg = strategyRatePlanConfig(groupId, plan.id);
    const totalMarkup = ratePlanTotalMarkup(cfg, plan.ota);
    const sim = ratePlanSimulation(groupId, plan);
    const statusClass = sim.deltaMin >= -0.004 ? "ok" : "bad";
    return `<tr class="${plan.airbnbMobileVariant ? "airbnb-mobile-rate" : ""}">
      <td>${ratePlanNameCell(plan, `Piano tariffario ${titleForPage(plan.ota)}`)}</td>
      <td>${escapeHtml(titleForPage(plan.ota))}</td>
      <td>${strategyYesNoSelect(cfg.active, `data-rate-plan-field="active" data-rate-plan-group="${groupId}" data-rate-plan-id="${plan.id}"`)}</td>
      <td>${ratePlanMarkupSelect(cfg.baseMarkup, groupId, plan.id, "baseMarkup")}</td>
      <td>${airbnbOnly
        ? `<span class="rate-plan-flag ${plan.fixedAirbnbDiscount ? "checked" : ""}"><span>${plan.fixedAirbnbDiscount ? "10% fisso" : "Non applicato"}</span></span>`
        : ratePlanFixedFlag(cfg.genius1, groupId, plan.id, "genius1", 0.10, "10%")}</td>
      ${airbnbOnly ? "" : `${showGenius2 ? `<td>${ratePlanFixedFlag(cfg.genius2, groupId, plan.id, "genius2", 0.15, "15%")}</td>` : ""}<td>${ratePlanFixedFlag(cfg.preferred, groupId, plan.id, "preferred", 0.05, "5%")}</td>`}
      <td><span class="rate-total">${formatValue(totalMarkup, "0.00%")}</span><small>${airbnbOnly ? "Markup Airbnb" : "Base + Genius/Preferiti"}</small></td>
      <td><strong>${formatValue(sim.targetCliente)}</strong><small>Cliente prima costi ${formatValue(sim.clientBeforeConditions)}</small></td>
      <td><strong>${formatValue(sim.pubblicare)}</strong><small>Normale con costi ${formatValue(sim.pubblicareTariffa)} · canone ${formatValue(sim.grossAfterPostPlMarkup)}</small></td>
      <td><strong>${formatValue(sim.conditionCost.total)}</strong><small>${sim.conditionCost.source === "manual-ota" ? "Totale costi OTA manuale" : `${sim.conditionCost.count} condizioni`}</small></td>
      <td><strong>${formatValue(sim.markupPub, "0.00%")}</strong><small>Pubblicare vs canone netto</small></td>
      <td><strong>${formatValue(sim.netto)}</strong><small>Provvigione ${formatValue(sim.commission, "0.00%")}</small></td>
      <td><strong>${formatValue(sim.directPublished)}</strong><small>NR manuale + fascia ${formatValue(categoryRatePlanTierMarkup(groupId, plan), "0.00%")}</small></td>
      <td><span class="delta-pill ${statusClass}">${formatValue(sim.deltaMin)}</span><small>${formatValue(sim.deltaMinRatio, "0.00%")}</small></td>
      <td>${escapeHtml(plan.policy)}</td>
      <td>${escapeHtml(plan.collection)}</td>
    </tr>`;
  }).join("");
  return `<div class="table-wrap strategy-table rate-plan-table"><table>
    <thead><tr><th>Piano tariffario</th><th>OTA</th><th>Attivo</th><th>Ricarico base</th>${optionHeaders}<th>Ricarico complessivo</th><th>Prezzo cliente finale</th><th>Pubblicare barrato</th><th>Costi condizioni</th><th>Markup definitivo da canone netto</th><th>Netto dopo provvigione</th><th>Riferimento sito diretto</th><th>Delta netto OTA vs sito</th><th>Policy cancellazione</th><th>Incasso</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}
function ratePlanMarkupSelect(value, groupId, planId, field) {
  return editablePercentInput(value, `data-rate-plan-field="${field}" data-rate-plan-group="${groupId}" data-rate-plan-id="${planId}"`, "rate-markup-options", "strategy-select markup-select");
}
function ratePlanFixedFlag(value, groupId, planId, field, fixedValue, label) {
  const checked = (Number(value) || 0) > 0.000001;
  return `<label class="rate-plan-flag ${checked ? "checked" : ""}">
    <input type="checkbox" data-rate-plan-field="${field}" data-rate-plan-group="${groupId}" data-rate-plan-id="${planId}" data-rate-plan-flag data-rate-plan-flag-value="${fixedValue}" ${checked ? "checked" : ""}>
    <span>${escapeHtml(label)}</span>
  </label>`;
}
function ratePlanTotalMarkup(cfg, otaId = "") {
  if (otaId === "airbnb") return Number(cfg.baseMarkup) || 0;
  return (Number(cfg.baseMarkup) || 0) + (Number(cfg.genius1) || 0) + (otaId === "booking" ? (Number(cfg.genius2) || 0) : 0) + (Number(cfg.preferred) || 0);
}
function bookingPreferredActive(plan, cfg) {
  return plan?.ota === "booking" && (Number(cfg?.preferred) || 0) > 0.000001;
}
function otaCommission(page, preferred = false) {
  if (page === "booking" && preferred) {
    return Math.max(0, Math.min(.95, Number(bookingPreferredConfig().commissionBase) || 0));
  }
  const map = { booking: "C14", airbnb: "C15", expedia: "C16", vrbo: "C17" };
  return Math.max(0, Math.min(.95, toNumber(val("Basic_NR_markup", map[page] || "C14"))));
}
function ratePlanTierMarkup(plan) {
  const name = String(plan?.name || "").toLowerCase();
  if (name.includes("not refundable") || name.includes("not-refundable") || name === "nr") return 0;
  if (name.includes("easy")) return 0.10;
  if (name.includes("refund") || name.includes("ref")) return 0.20;
  return 0;
}
function categoryRatePlanTierMarkup(groupId, plan) {
  // In ogni categoria NR, Easy e Refund partono dalla stessa base stagionalizzata.
  // La distanza tra le fasce è governata esclusivamente dal markup del piano.
  return 0;
}
function strategyDiscountFactor(groupId, otaId, options = {}) {
  return activeStrategyRowsForSimulation(groupId, otaId, options).reduce((factor, item) => {
    return factor * (1 - Math.max(0, Math.min(.95, Number(item.discount) || 0)));
  }, 1);
}

function allocateRoundedCurrency(total, weights, count) {
  const length = Math.max(1, Number(count) || (Array.isArray(weights) ? weights.length : 1));
  let normalized = Array.isArray(weights) && weights.length === length
    ? weights.map(value => Math.max(0, Number(value) || 0))
    : Array(length).fill(1);
  let weightTotal = normalized.reduce((sum, value) => sum + value, 0);
  if (!(weightTotal > 0)) {
    normalized = Array(length).fill(1);
    weightTotal = length;
  }
  const roundedTotal = roundCurrency(Math.max(0, Number(total) || 0));
  let assigned = 0;
  return normalized.map((weight, index) => {
    if (index === length - 1) return roundCurrency(roundedTotal - assigned);
    const value = roundCurrency(roundedTotal * weight / weightTotal);
    assigned = roundCurrency(assigned + value);
    return value;
  });
}

function bookingNightlyGrossAmounts(groupId, sourceTotal, planMarkup, grossTotal, hasSeasonalityOverride) {
  const nights = simulatedNights();
  if (!(Number(nights) > 0)) return [];
  let weights = null;
  if (!hasSeasonalityOverride) {
    const components = categorySeasonalNightComponents(groupId, sourceTotal);
    if (components?.length === nights) {
      weights = components.map(night => roundCurrency(night.baseNight * (1 + night.markup) * (1 + planMarkup)));
    }
  }
  return allocateRoundedCurrency(grossTotal, weights, nights);
}

function bookingDiscountedCanone(groupId, grossTotal, nightlyGross) {
  const active = activeStrategyRowsForSimulation(groupId, "booking");
  const mixedLmIndex = active.findIndex(item => item?.weighted
    && item.row?.id?.startsWith("lm-weighted-")
    && Array.isArray(item.nightly));
  if (mixedLmIndex < 0) {
    const factor = discountFactorForItems(active);
    return { amount: grossTotal * factor, factor, lmDiscountEuro: 0 };
  }

  const mixedLm = active[mixedLmIndex];
  const beforeFactor = discountFactorForItems(active.slice(0, mixedLmIndex));
  const afterFactor = discountFactorForItems(active.slice(mixedLmIndex + 1));
  const nightly = nightlyGross.length === mixedLm.nightly.length
    ? nightlyGross
    : allocateRoundedCurrency(grossTotal, null, mixedLm.nightly.length);
  const lmDiscountEuro = mixedLm.nightly.reduce((sum, item, index) => {
    const discount = item ? Math.max(0, Math.min(.95, Number(item.discount) || 0)) : 0;
    return sum + nightly[index] * discount;
  }, 0);
  const amount = Math.max(0, grossTotal * beforeFactor - lmDiscountEuro) * afterFactor;
  return {
    amount,
    factor: grossTotal > 0 ? amount / grossTotal : 1,
    lmDiscountEuro,
  };
}
function bookingPublishedPresentationFactor(groupId) {
  // Booking espone come prezzo barrato il canone dopo la
  // prima promo commerciale non temporale (es. Mobile), mentre LM/PP/LOS
  // continuano ad abbattere il prezzo fino al finale cliente. I costi OTA
  // restano sempre fuori dagli sconti e vengono aggiunti integralmente.
  const initial = activeStrategyRowsForSimulation(groupId, "booking")
    .filter(item => !["Last minute", "Prenota prima", "Long stay", "Genius"].includes(item.row.family))
    .sort((a, b) => (Number(b.discount) || 0) - (Number(a.discount) || 0))[0];
  return initial ? 1 - Math.max(0, Math.min(.95, Number(initial.discount) || 0)) : 1;
}
function airbnbInitialDiscountFactor(plan) {
  return plan?.fixedAirbnbDiscount ? 0.90 : 1;
}
function ratePlanSimulation(groupId, plan, options = {}) {
  const cfg = strategyRatePlanConfig(groupId, plan.id);
  const band = ratePlanBand(plan);
  const tierMarkup = directTierFactor(band) - 1;
  // Nuova regola aziendale: ogni piano OTA parte sempre dal canone NR stagionalizzato.
  const directNetCanone = netCanoneValue();
  const directTierBase = netCanoneSeasonalValue(groupId);
  const requestedPlanMarkup = Number(options.planMarkup);
  const planMarkup = Number.isFinite(requestedPlanMarkup) ? Math.max(0, requestedPlanMarkup) : ratePlanTotalMarkup(cfg, plan.ota);
  const preferred = bookingPreferredActive(plan, cfg);
  const pricingMarkup = pricingTargetPctForOta(plan.ota, preferred);
  const requestedSeasonality = Number(options.seasonality);
  const currentSeasonality = effectiveSeasonalityMarkup(groupId);
  const hasSeasonalityOverride = Number.isFinite(requestedSeasonality) && Math.abs(requestedSeasonality - currentSeasonality) > 0.0000001;
  const afterPlanMarkup = hasSeasonalityOverride
    ? directNetCanone * (1 + Math.max(0, requestedSeasonality)) * (1 + planMarkup)
    : categoryTotalAfterPlanMarkup(groupId, directNetCanone, planMarkup);
  const usesOtaMarkup = false;
  const afterOtaMarkup = usesOtaMarkup ? afterPlanMarkup * (1 + pricingMarkup) : afterPlanMarkup;
  const baseBeforePl = usesOtaMarkup ? afterOtaMarkup : afterPlanMarkup;
  const grossBeforeDiscounts = baseBeforePl + plExtraValue();
  const postPlMarkup = postPlMarkupValue();
  const grossAfterPostPlMarkup = grossBeforeDiscounts * (1 + postPlMarkup);
  const airbnbInitialFactor = plan.ota === "airbnb" ? airbnbInitialDiscountFactor(plan) : 1;
  const discountOptions = plan.ota === "airbnb" ? { includeMobile: plan.airbnbMobileVariant === true } : {};
  let discountFactor = Math.max(0.0001, airbnbInitialFactor * strategyDiscountFactor(groupId, plan.ota, discountOptions));
  let clientBeforeConditions = grossAfterPostPlMarkup * discountFactor;
  let bookingNightlyGross = [];
  let bookingLmDiscountEuro = 0;
  if (plan.ota === "booking") {
    bookingNightlyGross = bookingNightlyGrossAmounts(
      groupId,
      directNetCanone,
      planMarkup,
      grossAfterPostPlMarkup,
      hasSeasonalityOverride,
    );
    const bookingDiscount = bookingDiscountedCanone(groupId, grossAfterPostPlMarkup, bookingNightlyGross);
    clientBeforeConditions = bookingDiscount.amount;
    discountFactor = Math.max(0.0001, bookingDiscount.factor);
    bookingLmDiscountEuro = bookingDiscount.lmDiscountEuro;
  }
  const targetTariffa = clientBeforeConditions;
  const conditionCost = otaCostForPlan(groupId, plan.ota, clientBeforeConditions);
  const calculatedTarget = clientBeforeConditions + conditionCost.total;
  const commission = otaCommission(plan.ota, preferred);
  const directPublishedGross = directPublishedForBand(groupId, band);
  // Il confronto col sito usa il prezzo realmente pagato dopo le promo sito.
  // La costruzione del lordo OTA resta invece ancorata al canone NR non scontato.
  const directPublished = directPublishedDiscountedForBand(groupId, band);
  const minimumOwnerNet = directPublished * 1.05;
  const minimumTarget = minimumOwnerNet > 0 && commission < 0.999 ? minimumOwnerNet / (1 - commission) : 0;
  const targetCliente = calculatedTarget;
  const floorAdjustment = minimumTarget - calculatedTarget;
  // Prezzo normale OTA: canone lordo + costi OTA. Booking sconta soltanto
  // il canone: i costi restano fuori dalla base promo e vengono riaggiunti
  // integralmente al cliente. Non devono quindi essere gonfiati dividendo
  // l'intero target (costi compresi) per il fattore sconto.
  // Regola Booking unica per tutte le categorie: le promo incidono sul
  // canone, mentre i costi OTA vengono aggiunti integralmente dopo gli sconti.
  const costsOutsideDiscount = plan.ota === "booking" || plan.ota === "airbnb";
  const technicalGrossWithCosts = grossAfterPostPlMarkup + conditionCost.total;
  // Booking e Airbnb possono esporre un barrato gia ridotto dal rispettivo
  // primo sconto commerciale; LM/PP/LOS proseguono fino al finale cliente.
  const presentationFactor = plan.ota === "booking"
    ? bookingPublishedPresentationFactor(groupId)
    : plan.ota === "airbnb"
      ? airbnbInitialFactor
      : 1;
  const publishedCanone = grossAfterPostPlMarkup * presentationFactor;
  const pubblicareTariffa = costsOutsideDiscount ? publishedCanone + conditionCost.total : technicalGrossWithCosts;
  const pubblicare = costsOutsideDiscount ? pubblicareTariffa : targetCliente / discountFactor;
  const effectivePublishedDiscount = pubblicare > 0 ? Math.max(0, 1 - targetCliente / pubblicare) : 0;
  // La tassa di soggiorno e' un incasso di passaggio: non entra mai nella
  // base su cui l'OTA trattiene la propria provvigione.
  const touristTax = Math.max(0, Number(simulationTouristTax(groupId).total) || 0);
  const commissionableCustomerAmount = Math.max(0, targetCliente - touristTax);
  const netto = commissionableCustomerAmount * (1 - commission);
  const directNet = directNetCanone;
  const deltaMin = netto - directPublished;
  return {
    planMarkup,
    tierMarkup,
    pricingMarkup,
    usesOtaMarkup,
    preferred,
    band,
    directNetCanone,
    directTierBase,
    seasonalTierBase: grossBeforeDiscounts,
    afterPlanMarkup,
    afterOtaMarkup,
    baseBeforePl,
    grossBeforeDiscounts,
    postPlMarkup,
    grossAfterPostPlMarkup,
    bookingNightlyGross,
    bookingLmDiscountEuro,
    clientBeforeConditions,
    calculatedTarget,
    floorAdjustment,
    targetTariffa,
    conditionCost,
    costsOutsideDiscount,
    technicalGrossWithCosts,
    presentationFactor,
    publishedCanone,
    targetCliente,
    pubblicare,
    pubblicareTariffa,
    discountFactor,
    algorithmDiscountTotal: 1 - discountFactor,
    discountTotal: costsOutsideDiscount ? effectivePublishedDiscount : 1 - discountFactor,
    commission,
    touristTax,
    commissionableCustomerAmount,
    netto,
    markupPub: netCanoneValue() ? pubblicare / netCanoneValue() - 1 : 0,
    directNet,
    directPublished,
    directPublishedGross,
    minimumOwnerNet,
    minimumTarget,
    deltaMin,
    deltaMinRatio: directPublished ? deltaMin / directPublished : 0,
  };
}
function ratePlanSimulationsForOta(groupId, otaId, options = {}) {
  const memoKey = `${groupId}|${otaId}|${JSON.stringify(options)}`;
  const cached = renderMemo?.ratePlanSimulations.get(memoKey);
  if (cached) return cached;
  const result = ratePlanSimulationsForOtaUncached(groupId, otaId, options);
  renderMemo?.ratePlanSimulations.set(memoKey, result);
  return result;
}
function ratePlanSimulationsForOtaUncached(groupId, otaId, options = {}) {
  const rows = STRATEGY_RATE_PLANS
    .filter(plan => plan.groupId === groupId && plan.ota === otaId)
    .map(plan => {
      const labKey = ratesLabPlanKey(plan);
      const requestedMarkup = Number(options.markups?.[labKey] ?? options.markups?.[plan.id]);
      return {
        plan,
        cfg: strategyRatePlanConfig(groupId, plan.id),
        sim: ratePlanSimulation(groupId, plan, {
          ...options,
          planMarkup: Number.isFinite(requestedMarkup) ? requestedMarkup : options.planMarkup,
        }),
      };
    })
    .filter(item => item.cfg.active === "SI");
  // Le varianti Airbnb standard/mobile condividono lo stesso motore in ogni
  // categoria; cambiano soltanto configurazioni, markup, promo e costi salvati.
  if (otaId !== "airbnb") return rows;

  const standardNr = rows.find(item => !item.plan.airbnbMobileVariant && ratePlanBand(item.plan) === "nr");
  const standardRefund = rows.find(item => !item.plan.airbnbMobileVariant && ratePlanBand(item.plan) === "refund");
  if (!standardNr) return rows;

  const mobileDiscount = Math.max(0, ...STRATEGY_DISCOUNT_ROWS
    .filter(row => row.family === "Mobile" && strategyRowSupportsOta(row, "airbnb"))
    .map(row => ({ row, cfg: strategyDiscountConfig(groupId, row.id) }))
    .filter(item => item.cfg.active === "SI" && item.cfg.otas?.airbnb === "SI")
    .map(item => Number(strategyOtaDiscount(item.cfg, "airbnb")) || 0));

  return rows.map(item => {
    if (!item.plan.airbnbMobileVariant) return item;
    const band = ratePlanBand(item.plan);
    const source = band === "refund" ? standardRefund : standardNr;
    if (!source) return item;
    const cost = Math.max(0, Number(source.sim.conditionCost?.total) || 0);
    const targetCliente = band === "refund"
      ? standardNr.sim.targetCliente
      : Math.max(0, source.sim.targetCliente - cost) * (1 - mobileDiscount) + cost;
    const pubblicare = source.sim.targetCliente;
    const commission = item.sim.commission;
    const touristTax = Math.max(0, Number(simulationTouristTax(groupId).total) || 0);
    const commissionableCustomerAmount = Math.max(0, targetCliente - touristTax);
    const netto = commissionableCustomerAmount * (1 - commission);
    const directPublished = item.sim.directPublished;
    return {
      ...item,
      sim: {
        ...item.sim,
        clientBeforeConditions: Math.max(0, targetCliente - cost),
        calculatedTarget: targetCliente,
        targetTariffa: Math.max(0, targetCliente - cost),
        targetCliente,
        pubblicare,
        pubblicareTariffa: pubblicare,
        publishedCanone: Math.max(0, pubblicare - cost),
        effectivePublishedDiscount: pubblicare > 0 ? Math.max(0, 1 - targetCliente / pubblicare) : 0,
        discountTotal: pubblicare > 0 ? Math.max(0, 1 - targetCliente / pubblicare) : 0,
        touristTax,
        commissionableCustomerAmount,
        netto,
        markupPub: netCanoneValue() ? pubblicare / netCanoneValue() - 1 : 0,
        deltaMin: netto - directPublished,
        deltaMinRatio: directPublished ? (netto - directPublished) / directPublished : 0,
      },
    };
  });
}
function strategyDiscountConfig(groupId, rowId) {
  if (!state.strategies) state.strategies = defaultStrategyState();
  if (!state.strategies[groupId]) state.strategies = mergeStrategyState(state.strategies);
  return state.strategies[groupId].discounts[rowId];
}
function strategyRatePlanConfig(groupId, planId) {
  if (!state.strategies) state.strategies = defaultStrategyState();
  if (!state.strategies[groupId] || !state.strategies[groupId].ratePlans?.[planId]) state.strategies = mergeStrategyState(state.strategies);
  return state.strategies[groupId].ratePlans[planId] || { active: "NO" };
}
function strategyCounts(groupId) {
  const discounts = state.strategies?.[groupId]?.discounts || {};
  let active = 0, mapped = 0;
  for (const cfg of Object.values(discounts)) {
    if (cfg.active === "SI") active++;
    mapped += STRATEGY_OTAS.filter(ota => cfg.otas?.[ota.id] === "SI").length;
  }
  return { active, mapped };
}
function strategyYesNoSelect(value, attrs) {
  return `<select class="input-cell strategy-select" ${attrs}><option value="NO" ${value !== "SI" ? "selected" : ""}>NO</option><option value="SI" ${value === "SI" ? "selected" : ""}>SI</option></select>`;
}
function strategyDiscountSelect(value, groupId, rowId) {
  return editablePercentInput(value, `data-strategy-field="discount" data-strategy-group="${groupId}" data-strategy-row="${rowId}"`, "strategy-discount-options", "strategy-select");
}
function strategyOtaDiscount(cfg, otaId) {
  const v = Number(cfg.otaDiscounts?.[otaId]);
  if (Number.isFinite(v)) return Math.max(0, Math.min(.95, v));
  return Math.max(0, Math.min(.95, Number(cfg.discount) || 0));
}
function strategyOtaDiscountSelect(cfg, groupId, rowId, otaId) {
  const value = strategyOtaDiscount(cfg, otaId);
  return editablePercentInput(value, `data-strategy-field="otaDiscount" data-strategy-group="${groupId}" data-strategy-row="${rowId}" data-strategy-ota="${otaId}"`, "strategy-discount-options", "strategy-select");
}
function strategyOtaControl(groupId, rowId, cfg, ota) {
  return `<div class="ota-discount-cell">
    ${strategyYesNoSelect(cfg.otas[ota.id], `data-strategy-field="ota" data-strategy-group="${groupId}" data-strategy-row="${rowId}" data-strategy-ota="${ota.id}"`)}
    ${strategyOtaDiscountSelect(cfg, groupId, rowId, ota.id)}
  </div>`;
}
function setStrategyField(groupId, rowId, field, value, otaId = "") {
  const group = STRATEGY_GROUPS.find(g => g.id === groupId);
  const row = STRATEGY_DISCOUNT_ROWS.find(r => r.id === rowId);
  if (!group || !row) return;
  const cfg = strategyDiscountConfig(groupId, rowId);
  let changed = false;
  if (row.family === "Genius" && ["genius1", "genius2"].includes(row.id)) {
    const levelField = row.id;
    const otherLevel = row.id === "genius2" ? "genius1" : "genius2";
    const bookingPlans = STRATEGY_RATE_PLANS
      .filter(plan => plan.groupId === groupId && plan.ota === "booking")
      .map(plan => strategyRatePlanConfig(groupId, plan.id))
      .filter(planCfg => planCfg.active === "SI");
    if (field === "otaDiscount" && otaId === "booking") {
      const next = parsePercentInput(value, 0);
      for (const planCfg of bookingPlans) {
        planCfg[levelField] = next;
        planCfg[otherLevel] = 0;
      }
      changed = true;
    }
    if ((field === "active" && value !== "SI") || (field === "ota" && otaId === "booking" && value !== "SI")) {
      for (const planCfg of bookingPlans) planCfg[levelField] = 0;
      changed = true;
    }
  }
  if (field === "active") {
    const next = value === "SI" ? "SI" : "NO";
    changed = changed || cfg.active !== next;
    cfg.active = next;
    if (next === "SI") {
      for (const ota of STRATEGY_OTAS) {
        if (cfg.otas[ota.id] !== "SI") changed = true;
        cfg.otas[ota.id] = "SI";
      }
    }
  }
  if (field === "discount") {
    const next = parsePercentInput(value, 0);
    changed = changed || Math.abs((Number(cfg.discount) || 0) - next) > 0.000001;
    cfg.discount = next;
  }
  if (field === "ota" && (otaId === "site" || STRATEGY_OTAS.some(o => o.id === otaId))) {
    const next = value === "SI" ? "SI" : "NO";
    changed = changed || cfg.otas[otaId] !== next;
    cfg.otas[otaId] = next;
  }
  if (field === "otaDiscount" && (otaId === "site" || STRATEGY_OTAS.some(o => o.id === otaId))) {
    if (!cfg.otaDiscounts) cfg.otaDiscounts = {};
    const next = parsePercentInput(value, 0);
    changed = changed || Math.abs((Number(cfg.otaDiscounts[otaId]) || 0) - next) > 0.000001;
    cfg.otaDiscounts[otaId] = next;
    // LM, PP e LOS usano Booking come percentuale master della categoria.
    // Le altre OTA ricevono lo stesso valore, mantenendo indipendenti i flag SI/NO.
    if (otaId === "booking" && ["Last minute", "Prenota prima", "Long stay"].includes(row.family)) {
      for (const ota of STRATEGY_OTAS) {
        changed = changed || Math.abs((Number(cfg.otaDiscounts[ota.id]) || 0) - next) > 0.000001;
        cfg.otaDiscounts[ota.id] = next;
      }
      changed = changed || Math.abs((Number(cfg.discount) || 0) - next) > 0.000001;
      cfg.discount = next;
    }
  }
  if (!changed) return;
  dirty = true;
  log(`Strategia ${group.label}: aggiornata ${row.code}`, { action: "strategia aggiornata", gruppo: group.label, promo: row.code });
  render();
  updateSaveState("Modifiche non salvate");
}
function parseAmountInput(value, fallback = 0) {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  const n = Number(text.replace(",", "."));
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
}
function setConditionField(groupId, conditionId, field, value, otaId = "") {
  const group = STRATEGY_GROUPS.find(g => g.id === groupId);
  const row = STRATEGY_CONDITION_ROWS.find(r => r.id === conditionId);
  if (!group || !row) return;
  const cfg = strategyConditionConfig(groupId, conditionId);
  let changed = false;
  if (field === "active") {
    const next = value === "SI" ? "SI" : "NO";
    changed = cfg.active !== next;
    cfg.active = next;
  }
  if (field === "basis") {
    const next = value === "person" ? "person" : "unit";
    changed = cfg.basis !== next;
    cfg.basis = next;
  }
  if (field === "period") {
    const next = value === "night" ? "night" : "stay";
    changed = cfg.period !== next;
    cfg.period = next;
  }
  if (field === "valueType") {
    const next = value === "pct" ? "pct" : "eur";
    changed = cfg.valueType !== next;
    cfg.valueType = next;
  }
  if (field === "amount") {
    const next = parseAmountInput(value, 0);
    changed = Math.abs((Number(cfg.amount) || 0) - next) > 0.000001;
    cfg.amount = next;
  }
  if (field === "ota" && STRATEGY_OTAS.some(o => o.id === otaId)) {
    const next = value === "SI" ? "SI" : "NO";
    changed = cfg.otas[otaId] !== next;
    cfg.otas[otaId] = next;
  }
  if (!changed) return;
  if (["active", "amount", "valueType"].includes(field)) syncNetCanoneFromCategoryCosts(groupId);
  dirty = true;
  log(`Condizione ${group.label}: aggiornata ${row.label}`, { action: "condizione aggiornata", gruppo: group.label, condizione: row.label });
  render();
  updateSaveState("Modifiche non salvate");
}
function calculatorButtons() {
  const rows = [
    ["raddeg", "π", "e", "C", "⌫"],
    ["sin(", "cos(", "tan(", "asin(", "acos("],
    ["atan(", "ln(", "log(", "sqrt(", "^"],
    ["7", "8", "9", "(", ")"],
    ["4", "5", "6", "×", "÷"],
    ["1", "2", "3", "+", "-"],
    ["0", ",", "%", "!", "="],
  ];
  return rows.map(row => `<div class="calculator-row">${row.map(label => {
    const action = label === "=" ? "equals" : label === "C" ? "clear" : label === "⌫" ? "backspace" : label === "raddeg" ? "angle" : "insert";
    const text = label === "raddeg" ? calculatorAngleMode.toUpperCase() : label;
    return `<button class="calculator-key ${action === "equals" ? "primary" : ""}" data-calc-action="${action}" data-calc-value="${escapeHtml(label)}">${escapeHtml(text)}</button>`;
  }).join("")}</div>`).join("");
}
function calculatorBody() {
  const result = calculatorResult || "0";
  return `<div class="calculator-shell">
    <div class="calculator-display">
      <label>Espressione</label>
      <input class="input-cell calculator-expression" data-calculator-expression value="${escapeHtml(calculatorExpression)}" placeholder="Es. sin(30)+sqrt(144)">
      <label>Risultato</label>
      <div class="calculator-result">${escapeHtml(result)}</div>
    </div>
    <div class="calculator-tools">
      <div class="calculator-hint">Modalita angoli: <strong>${calculatorAngleMode === "deg" ? "gradi" : "radianti"}</strong></div>
      ${calculatorButtons()}
    </div>
    <div class="calculator-reference">
      <h3>Funzioni disponibili</h3>
      <div class="calc-ref-grid">
        <span>sin, cos, tan</span><span>asin, acos, atan</span><span>ln, log</span><span>sqrt</span><span>^ potenza</span><span>! fattoriale</span><span>π, e</span><span>% percentuale</span>
      </div>
    </div>
  </div>`;
}
function renderCalculatorPopup() {
  if (!calculatorOpen) return "";
  const x = Math.max(12, Math.min(calculatorPosition.x, window.innerWidth - 360));
  const y = Math.max(12, Math.min(calculatorPosition.y, window.innerHeight - 120));
  return `<aside class="calculator-popup" style="left:${x}px; top:${y}px;" data-calculator-popup>
    <div class="calculator-popup-head" data-calculator-drag>
      <strong>Calcolatrice scientifica</strong>
      <button class="ghost calculator-close" data-calculator-close title="Chiudi">×</button>
    </div>
    ${calculatorBody()}
  </aside>`;
}
function renderScientificCalculator() {
  return `${head("Calcolatrice scientifica", "Calcoli rapidi scientifici integrati nel software: funzioni trigonometriche, logaritmi, radici, potenze, percentuali e fattoriale.")}
  <section class="panel calculator-panel">${calculatorBody()}</section>`;
}
function factorial(n) {
  if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n || n > 170) throw new Error("Fattoriale non valido");
  let out = 1;
  for (let i = 2; i <= n; i++) out *= i;
  return out;
}
function evaluateCalculatorExpression(expr) {
  let text = String(expr || "").trim();
  if (!text) return "";
  text = text
    .replace(/,/g, ".")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/π/g, "pi")
    .replace(/\^/g, "**");
  text = smartPercentExpression(text)
    .replace(/(\d+(?:\.\d+)?)%/g, "($1/100)")
    .replace(/(\d+)!/g, "fact($1)");
  if (!/^[0-9+\-*/().,\s_a-zA-Z*%]+$/.test(text)) throw new Error("Caratteri non validi");
  const angle = calculatorAngleMode;
  const sin = x => Math.sin(angle === "deg" ? x * Math.PI / 180 : x);
  const cos = x => Math.cos(angle === "deg" ? x * Math.PI / 180 : x);
  const tan = x => Math.tan(angle === "deg" ? x * Math.PI / 180 : x);
  const asin = x => {
    const v = Math.asin(x);
    return angle === "deg" ? v * 180 / Math.PI : v;
  };
  const acos = x => {
    const v = Math.acos(x);
    return angle === "deg" ? v * 180 / Math.PI : v;
  };
  const atan = x => {
    const v = Math.atan(x);
    return angle === "deg" ? v * 180 / Math.PI : v;
  };
  const sqrt = Math.sqrt, ln = Math.log, log = Math.log10, abs = Math.abs, exp = Math.exp, round = Math.round, floor = Math.floor, ceil = Math.ceil;
  const pi = Math.PI, e = Math.E, fact = factorial;
  const value = Function("sin","cos","tan","asin","acos","atan","sqrt","ln","log","abs","exp","round","floor","ceil","pi","e","fact", `"use strict"; return (${text});`)(sin, cos, tan, asin, acos, atan, sqrt, ln, log, abs, exp, round, floor, ceil, pi, e, fact);
  if (!Number.isFinite(value)) throw new Error("Risultato non valido");
  return value.toLocaleString("it-IT", { maximumFractionDigits: 12 });
}
function smartPercentExpression(text) {
  let out = text;
  let prev = "";
  const simpleLeft = String.raw`(?:\([^()]+\)|\d+(?:\.\d+)?)`;
  const rx = new RegExp(`(${simpleLeft})\\s*([+\\-])\\s*(\\d+(?:\\.\\d+)?)%`, "g");
  while (out !== prev) {
    prev = out;
    out = out.replace(rx, (_, left, op, pct) => `${left}${op}(${left}*${pct}/100)`);
  }
  return out;
}
function restoreCalculatorCursor() {
  requestAnimationFrame(() => {
    const input = document.querySelector("[data-calculator-popup] [data-calculator-expression]")
      || document.querySelector("[data-calculator-expression]");
    if (!input) return;
    const start = Math.max(0, Math.min(calculatorCursorPosition, input.value.length));
    const end = Math.max(start, Math.min(calculatorSelectionEnd, input.value.length));
    input.focus();
    input.setSelectionRange(start, end);
  });
}
function updateCalculatorExpression(next, compute = false, cursor = null) {
  calculatorExpression = next;
  const nextCursor = cursor === null ? calculatorExpression.length : cursor;
  calculatorCursorPosition = nextCursor;
  calculatorSelectionEnd = nextCursor;
  if (compute) {
    try {
      calculatorResult = evaluateCalculatorExpression(calculatorExpression) || "0";
      calculatorJustEvaluated = true;
    } catch (err) {
      calculatorResult = `Errore: ${err.message}`;
      calculatorJustEvaluated = false;
    }
  }
  render();
  restoreCalculatorCursor();
}
function handleCalculatorAction(action, value) {
  if (action === "clear") {
    calculatorResult = "";
    calculatorJustEvaluated = false;
    return updateCalculatorExpression("", false, 0);
  }
  if (action === "backspace") {
    calculatorJustEvaluated = false;
    const start = Math.max(0, Math.min(calculatorCursorPosition, calculatorExpression.length));
    const end = Math.max(start, Math.min(calculatorSelectionEnd, calculatorExpression.length));
    if (end > start) return updateCalculatorExpression(`${calculatorExpression.slice(0, start)}${calculatorExpression.slice(end)}`, false, start);
    if (start === 0) return restoreCalculatorCursor();
    return updateCalculatorExpression(`${calculatorExpression.slice(0, start - 1)}${calculatorExpression.slice(start)}`, false, start - 1);
  }
  if (action === "angle") {
    calculatorAngleMode = calculatorAngleMode === "deg" ? "rad" : "deg";
    return updateCalculatorExpression(calculatorExpression, true);
  }
  if (action === "equals") return updateCalculatorExpression(calculatorExpression, true);
  const insert = value === "π" ? "π" : value === "e" ? "e" : value === "×" || value === "÷" ? value : value;
  const isOperator = ["+", "-", "×", "÷", "^"].includes(insert);
  if (calculatorJustEvaluated) {
    const validResult = calculatorResult && !calculatorResult.startsWith("Errore") ? calculatorResult : "";
    calculatorExpression = isOperator ? validResult : "";
    calculatorCursorPosition = calculatorExpression.length;
    calculatorSelectionEnd = calculatorCursorPosition;
  }
  calculatorJustEvaluated = false;
  const start = Math.max(0, Math.min(calculatorCursorPosition, calculatorExpression.length));
  const end = Math.max(start, Math.min(calculatorSelectionEnd, calculatorExpression.length));
  const next = `${calculatorExpression.slice(0, start)}${insert}${calculatorExpression.slice(end)}`;
  updateCalculatorExpression(next, false, start + insert.length);
}
function forecastConfig() {
  if (!state.forecast) state.forecast = defaultForecastState();
  return state.forecast[state.forecast.mode];
}
function forecastAverage(values) {
  const clean = values.filter(value => value !== null && value !== undefined && value !== "").map(Number).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}
function forecastStaggerTargets(rows) {
  return rows.map((row, index) => {
    if (index === 10) return { ...row, adrTarget: null, revTarget: null, rooms: null };
    const source = index === 0 ? rows[0] : rows[index + 1];
    return { ...row, adrTarget: source.adrTarget, revTarget: source.revTarget, rooms: source.rooms };
  });
}
function forecastCurve(config, mode) {
  const min = Math.max(0, Number(config.minPrice) || 0);
  const max = Math.max(min, Number(config.maxPrice) || min);
  if (mode === "mono") {
    const target = [min];
    const level = Math.max(2, Math.min(9, Math.round(Number(config.curveLevel) || 7)));
    const weight = Math.max(0, Number(config.curveWeight) || 0);
    for (let i = 1; i <= 10; i++) {
      if (i < level) target[i] = Math.min(max, min + (i + 1) * ((max - min) * weight / level));
      else if (i < 10) target[i] = target[i - 1] + ((max - target[i - 1]) / Math.max(1, 10 - i));
      else target[i] = max;
    }
    return target.map((value, levelIndex) => ({
      level: levelIndex,
      basePrice: target[Math.max(0, levelIndex - 1)],
      adrTarget: levelIndex < 10 ? value : null,
      revTarget: levelIndex < 10 ? value : null,
      rooms: levelIndex < 10 ? 1 : null,
    }));
  }
  const levelLimit = Math.max(1, Math.min(9, Math.round(Number(config.curveLevel) || 6)));
  const weight = Math.max(0, Number(config.curveWeight) || 0);
  const base = [];
  for (let i = 0; i <= 10; i++) {
    if (i <= 1) base[i] = min;
    else if (i <= levelLimit) base[i] = min + ((max - min) * weight * i / 10);
    else base[i] = base[i - 1] + ((max - base[i - 1]) / (10 - i + 1));
  }
  const types = config.unitTypes || [];
  const units = types.reduce((sum, row) => sum + Math.max(0, Number(row.units) || 0), 0);
  const weightedMultiplier = units ? types.reduce((sum, row) => sum + (Math.max(0, Number(row.units) || 0) * Math.max(0, Number(row.multiplier) || 0)), 0) / units : 0;
  const rows = base.map((price, levelIndex) => {
    const rooms = units * (.25 + (.70 * levelIndex / 10));
    const adrTarget = price * weightedMultiplier;
    return { level: levelIndex, basePrice: price, adrTarget, revTarget: adrTarget * rooms, rooms };
  });
  return forecastStaggerTargets(rows);
}
function forecastIsoDate(value, fallback) {
  const date = new Date(`${value || fallback}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? new Date(`${fallback}T00:00:00Z`) : date;
}
function forecastSellableDays(config, monthIndex, mode) {
  const opening = forecastIsoDate(config.opening, "2026-01-01");
  const closing = forecastIsoDate(config.closing, "2026-12-31");
  const year = opening.getUTCFullYear();
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  const from = new Date(Math.max(start.getTime(), opening.getTime()));
  const to = new Date(Math.min(end.getTime(), closing.getTime()));
  const days = to < from ? 0 : Math.floor((to - from) / 86400000) + 1;
  if (mode !== "multi") return days;
  const units = (config.unitTypes || []).reduce((sum, row) => sum + Math.max(0, Number(row.units) || 0), 0);
  return days * units;
}
function forecastBandAverage(curve, band) {
  const values = curve.slice(band.min, Math.min(10, band.max + 1)).map(row => row.adrTarget);
  return forecastAverage(values);
}
function forecastMonthlyImportance(config, mode, curve, monthIndex) {
  const opening = forecastIsoDate(config.opening, "2026-01-01");
  const year = opening.getUTCFullYear();
  const monthStart = new Date(Date.UTC(year, monthIndex, 1));
  const monthEnd = new Date(Date.UTC(year, monthIndex + 1, 0));
  let weighted = 0, totalDays = 0;
  for (const band of FORECAST_SEASON_BANDS) {
    const [fromMonth, fromDay] = band.from.split("-").map(Number);
    const [toMonth, toDay] = band.to.split("-").map(Number);
    const bandStart = new Date(Date.UTC(year, fromMonth - 1, fromDay));
    const bandEnd = new Date(Date.UTC(year, toMonth - 1, toDay));
    const from = new Date(Math.max(monthStart.getTime(), bandStart.getTime()));
    const to = new Date(Math.min(monthEnd.getTime(), bandEnd.getTime()));
    if (to < from) continue;
    const days = Math.floor((to - from) / 86400000) + 1;
    weighted += forecastBandAverage(curve, band) * days;
    totalDays += days;
  }
  return totalDays ? weighted / totalDays : forecastAverage(curve.map(row => row.adrTarget));
}
function forecastModel() {
  const mode = state.forecast?.mode === "multi" ? "multi" : "mono";
  const config = state.forecast[mode];
  const curve = forecastCurve(config, mode);
  const months = FORECAST_MONTHS.map((name, index) => {
    const revenue = Math.max(0, Number(config.revenues[index]) || 0);
    const nights = Math.max(0, Number(config.nights[index]) || 0);
    const sellable = forecastSellableDays(config, index, mode);
    return {
      name, revenue, nights, adr: nights ? revenue / nights : 0,
      occupancy: sellable ? nights / sellable : 0,
      importance: forecastMonthlyImportance(config, mode, curve, index), sellable,
    };
  });
  const totalRevenue = months.reduce((sum, row) => sum + row.revenue, 0);
  const totalNights = months.reduce((sum, row) => sum + row.nights, 0);
  const budgetAdr = totalNights ? totalRevenue / totalNights : 0;
  const averageBase = forecastAverage(curve.map(row => row.basePrice));
  const averageTarget = forecastAverage(curve.map(row => row.adrTarget));
  const averageImportance = forecastAverage(months.map(row => row.importance));
  return { mode, config, curve, months, totalRevenue, totalNights, budgetAdr, averageBase, averageTarget, averageImportance, gapBase: averageBase ? budgetAdr / averageBase - 1 : 0, gapPotential: averageImportance ? budgetAdr / averageImportance - 1 : 0 };
}
function forecastMoneyInput(field, value, extra = "") {
  return `<input class="input-cell forecast-input" type="number" step="0.01" min="0" data-forecast-field="${field}" ${extra} value="${Number(value) || 0}">`;
}
function forecastPercentInput(field, value) {
  return `<input class="input-cell forecast-input" type="number" step="0.01" min="0" data-forecast-field="${field}" value="${((Number(value) || 0) * 100).toFixed(2)}"><span class="forecast-input-suffix">%</span>`;
}
function forecastScenarioPresets(mode) {
  return mode === "mono" ? [
    ["Protezione", .25, 7, "Crescita dolce, ideale per mercati incerti"],
    ["Recovery", .15, 7, "Prezzi quasi bloccati al minimo per riempire"],
    ["Dynamic", .35, 6, "Equilibrio tra occupazione e ADR"],
    ["Yield", .45, 5, "Assetto reattivo per domanda elevata"],
    ["Peak", .60, 5, "Massimizzazione nelle date evento"],
  ] : [
    ["OK", .35, 6, "Configurazione di riferimento del foglio"],
    ["Protezione", .25, 7, "Curva piatta, focus sul volume"],
    ["Recovery", .50, 6, "Crescita dolce, focus sul riempimento"],
    ["Dynamic", .80, 5, "Crescita lineare, focus sull'equilibrio"],
    ["Yield", 1.20, 5, "Curva ripida, focus ADR"],
    ["Peak", 1.80, 5, "Curva a L, focus massimizzazione"],
  ];
}
function forecastScenarioPanel(model) {
  return `<section class="panel forecast-scenarios"><div class="forecast-section-title"><div><h3>Scenari</h3><p>Seleziona un assetto per aggiornare peso e livello della curva.</p></div></div>
    <div class="forecast-scenario-grid">${forecastScenarioPresets(model.mode).map(([name, weight, level, note]) => `<button class="forecast-scenario ${model.config.scenario === name ? "active" : ""}" data-forecast-scenario="${escapeHtml(name)}" data-forecast-weight="${weight}" data-forecast-level="${level}"><strong>${escapeHtml(name)}</strong><span>Peso ${formatValue(weight, "0.00")} · Livello ${level}</span><small>${escapeHtml(note)}</small></button>`).join("")}</div>
  </section>`;
}
function forecastUnitTypes(model) {
  if (model.mode !== "multi") return "";
  const rows = model.config.unitTypes.map((row, index) => `<div class="forecast-unit-row">
    <input class="input-cell" data-forecast-unit-field="name" data-forecast-unit-index="${index}" value="${escapeHtml(row.name)}">
    <input class="input-cell" type="number" min="0" step="1" data-forecast-unit-field="units" data-forecast-unit-index="${index}" value="${row.units}">
    <input class="input-cell" type="number" min="0" step="0.01" data-forecast-unit-field="multiplier" data-forecast-unit-index="${index}" value="${row.multiplier}">
    <button class="danger forecast-unit-delete" title="Elimina tipologia" data-forecast-unit-delete="${index}">×</button>
  </div>`).join("");
  const units = model.config.unitTypes.reduce((sum, row) => sum + Number(row.units || 0), 0);
  const multiplier = units ? model.config.unitTypes.reduce((sum, row) => sum + Number(row.units || 0) * Number(row.multiplier || 0), 0) / units : 0;
  return `<section class="panel forecast-units"><div class="forecast-section-title"><div><h3>Composizione Multiunit</h3><p>Numero unità e moltiplicatore ADR per tipologia.</p></div><span class="badge">${units} unità · coeff. ${formatValue(multiplier, "0.00")}</span></div>
    <div class="forecast-unit-head"><span>Tipologia</span><span>N. unità</span><span>Moltiplicatore</span><span></span></div>${rows}<button data-forecast-unit-add>Aggiungi tipologia</button>
  </section>`;
}
function forecastParameters(model) {
  const c = model.config;
  return `<section class="panel forecast-parameters"><div class="forecast-section-title"><div><h3>Parametri</h3><p>Input principali della curva e periodo di vendita.</p></div><span class="badge">${model.mode === "mono" ? "Monounit" : "Multiunit"}</span></div>
    <div class="forecast-field-grid">
      <label>Prezzo minimo${forecastMoneyInput("minPrice", c.minPrice)}</label>
      <label>Prezzo massimo${forecastMoneyInput("maxPrice", c.maxPrice)}</label>
      <label>Peso curva<div class="forecast-input-with-suffix">${forecastPercentInput("curveWeight", c.curveWeight)}</div></label>
      <label>Livello curva<input class="input-cell forecast-input" type="number" min="1" max="9" step="1" data-forecast-field="curveLevel" value="${c.curveLevel}"></label>
      <label>Apertura<input class="input-cell forecast-input" type="date" data-forecast-field="opening" value="${escapeHtml(c.opening)}"></label>
      <label>Chiusura<input class="input-cell forecast-input" type="date" data-forecast-field="closing" value="${escapeHtml(c.closing)}"></label>
    </div>
  </section>`;
}
function forecastKpis(model) {
  return `<div class="forecast-kpis">
    <article><span>Budget ricavi</span><strong>€ ${formatValue(model.totalRevenue)}</strong><small>${model.totalNights} notti previste</small></article>
    <article><span>ADR budget</span><strong>€ ${formatValue(model.budgetAdr)}</strong><small>Ricavi / notti</small></article>
    <article><span>ADR potenziale medio</span><strong>€ ${formatValue(model.averageImportance)}</strong><small>Ponderato per stagionalità</small></article>
    <article class="${model.gapPotential >= 0 ? "positive" : "negative"}"><span>Budget vs potenziale</span><strong>${formatValue(model.gapPotential, "0.00%")}</strong><small>Scostamento ADR</small></article>
  </div>`;
}
function forecastCurveTable(model) {
  const maxRev = Math.max(1, ...model.curve.map(row => row.revTarget));
  const rows = model.curve.map(row => `<tr><td><strong>${row.level}</strong></td><td class="num">${formatValue(row.basePrice)}</td><td class="num">${formatValue(row.adrTarget)}</td><td class="num">${formatValue(row.revTarget)}</td>${model.mode === "multi" ? `<td class="num">${formatValue(row.rooms)}</td>` : ""}<td><div class="forecast-mini-bar"><i style="width:${Math.max(2, row.revTarget / maxRev * 100)}%"></i></div></td></tr>`).join("");
  return `<section class="panel forecast-curve"><div class="forecast-section-title"><div><h3>Curva livelli 0–10</h3><p>Prezzo base, ADR obiettivo e ricavo teorico calcolati dai parametri.</p></div><span class="badge">Media ADR ${formatValue(model.averageTarget)}</span></div><div class="table-wrap"><table><thead><tr><th>Livello</th><th class="num">Base price</th><th class="num">ADR target</th><th class="num">Rev target</th>${model.mode === "multi" ? `<th class="num">Camere</th>` : ""}<th>Progressione</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
function forecastMonthlyTable(model) {
  const rows = model.months.map((row, index) => `<tr>
    <td><strong>${row.name}</strong></td>
    <td>${forecastMoneyInput("revenue", row.revenue, `data-forecast-month="${index}"`)}</td>
    <td>${forecastMoneyInput("nights", row.nights, `data-forecast-month="${index}" step="1"`)}</td>
    <td class="num"><strong>${formatValue(row.adr)}</strong></td>
    ${model.mode === "multi" ? `<td class="num">${formatValue(row.occupancy, "0.00%")}</td>` : ""}
    <td class="num">${formatValue(row.importance)}</td><td class="num">${row.sellable}</td>
  </tr>`).join("");
  return `<section class="panel forecast-monthly"><div class="forecast-section-title"><div><h3>Budget mensile</h3><p>Ricavi e notti sono modificabili; ADR, occupazione e importanza stagionale si aggiornano automaticamente.</p></div></div><div class="table-wrap"><table><thead><tr><th>Mese</th><th>Ricavi EUR</th><th>Notti</th><th class="num">ADR</th>${model.mode === "multi" ? `<th class="num">Occupazione</th>` : ""}<th class="num">ADR importanza</th><th class="num">Giorni vendibili</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th>Totale / media</th><th class="num">${formatValue(model.totalRevenue)}</th><th class="num">${model.totalNights}</th><th class="num">${formatValue(model.budgetAdr)}</th>${model.mode === "multi" ? `<th></th>` : ""}<th class="num">${formatValue(model.averageImportance)}</th><th></th></tr></tfoot></table></div></section>`;
}
function forecastSeasonalityTable(model) {
  const rows = FORECAST_SEASON_BANDS.map(band => `<tr><td>${band.from.replace("-", "/")} – ${band.to.replace("-", "/")}</td><td class="num">MIN ${band.min}</td><td class="num">MAX ${band.max}</td><td class="num"><strong>${formatValue(forecastBandAverage(model.curve, band))}</strong></td></tr>`).join("");
  return `<details class="panel forecast-seasonality"><summary><span>Importanza stagionalità estiva</span><span class="badge">15 periodi</span></summary><div class="table-wrap"><table><thead><tr><th>Periodo</th><th class="num">Livello minimo</th><th class="num">Livello massimo</th><th class="num">ADR medio</th></tr></thead><tbody>${rows}</tbody></table></div></details>`;
}
function touristTaxDataset() {
  return window.TOURIST_TAX_DATA || { columns: [], rows: [] };
}
function touristTaxColumnIndex(name) {
  return touristTaxDataset().columns.indexOf(name);
}
function touristTaxRecord(index) {
  const data = touristTaxDataset();
  const source = data.rows[index] || [];
  const edit = state.touristTaxEdits?.[index] || {};
  const record = {};
  data.columns.forEach((column, columnIndex) => { record[column] = Object.prototype.hasOwnProperty.call(edit, column) ? edit[column] : (source[columnIndex] ?? ""); });
  return record;
}
function touristTaxMoney(value) {
  const normalized = String(value ?? "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}
function touristTaxDateValue(value) {
  const match = String(value || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : 0;
}
function touristTaxMonth(value) {
  const match = String(value || "").match(/^\d{2}\/(\d{2})\/(\d{4})$/);
  return match ? `${match[2]}/${match[3]}` : "";
}
function touristTaxOptionList(values, selected, emptyLabel) {
  return `<option value="">${escapeHtml(emptyLabel)}</option>${values.map(value => `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(value)}</option>`).join("")}`;
}
function touristTaxRuleKey(comune, provincia, rate, maxNights) {
  return [comune, provincia, Number(rate).toFixed(2), Number(maxNights)].join("|");
}
function touristTaxRules() {
  const groups = new Map();
  touristTaxDataset().rows.forEach((_, index) => {
    const row = touristTaxRecord(index);
    const comune = String(row.Comune || "").trim();
    if (!comune) return;
    const provincia = String(row["Prov."] || "").trim();
    const rate = touristTaxMoney(row["Tariffa standard"]);
    const maxNights = Math.max(0, Math.round(touristTaxMoney(row["Max giorni"])));
    const key = touristTaxRuleKey(comune, provincia, rate, maxNights);
    const item = groups.get(key) || { key, comune, provincia, rate, maxNights, uses: 0, properties: new Set(), firstDate: 0, lastDate: 0 };
    const date = touristTaxDateValue(row["Data arrivo"]);
    item.uses++;
    if (row.Immobile) item.properties.add(String(row.Immobile));
    if (date && (!item.firstDate || date < item.firstDate)) item.firstDate = date;
    if (date > item.lastDate) item.lastDate = date;
    groups.set(key, item);
  });
  const rules = [...groups.values()];
  const maxUses = new Map();
  rules.forEach(rule => maxUses.set(rule.comune, Math.max(maxUses.get(rule.comune) || 0, rule.uses)));
  return rules.map(rule => {
    const edit = state.touristTaxRuleEdits?.[rule.key] || {};
    return { ...rule, rate: Object.prototype.hasOwnProperty.call(edit, "rate") ? Number(edit.rate) : rule.rate, maxNights: Object.prototype.hasOwnProperty.call(edit, "maxNights") ? Number(edit.maxNights) : rule.maxNights, active: Object.prototype.hasOwnProperty.call(edit, "active") ? Boolean(edit.active) : rule.rate > 0, note: edit.note || "", primary: rule.uses === maxUses.get(rule.comune) };
  }).sort((a, b) => a.comune.localeCompare(b.comune, "it", { sensitivity: "base" }) || Number(b.primary) - Number(a.primary) || b.uses - a.uses);
}
function touristTaxRuleDate(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleDateString("it-IT", { timeZone: "UTC" }) : "—";
}
function touristTaxRuleCatalog() {
  const query = touristTaxFilters.search.trim().toLocaleLowerCase("it-IT");
  const all = touristTaxRules();
  const variantsByComune = new Map();
  all.forEach(rule => variantsByComune.set(rule.comune, (variantsByComune.get(rule.comune) || 0) + 1));
  const rules = all.filter(rule => {
    if (query && ![rule.comune, rule.provincia, rule.note].some(value => String(value || "").toLocaleLowerCase("it-IT").includes(query))) return false;
    if (touristTaxFilters.initial && rule.comune.charAt(0).toLocaleUpperCase("it-IT") !== touristTaxFilters.initial) return false;
    if (touristTaxFilters.comune && rule.comune !== touristTaxFilters.comune) return false;
    if (touristTaxFilters.provincia && rule.provincia !== touristTaxFilters.provincia) return false;
    return true;
  });
  const activeMunicipalities = new Set(rules.filter(rule => rule.active && rule.rate > 0).map(rule => rule.comune)).size;
  const ambiguous = new Set(rules.filter(rule => variantsByComune.get(rule.comune) > 1).map(rule => rule.comune)).size;
  const rows = rules.map(rule => `<tr data-tax-rule-row="${escapeHtml(rule.key)}">
    <td><strong>${escapeHtml(rule.comune)}</strong><small>${escapeHtml(rule.provincia)}</small></td>
    <td><span class="strategy-pill ${rule.primary ? "on" : ""}">${rule.primary ? "Prevalente nel file" : "Variante rilevata"}</span></td>
    <td><input class="input-cell tax-rule-number" inputmode="decimal" value="${formatValue(rule.rate)}" data-tax-rule-rate></td>
    <td><input class="input-cell tax-rule-number" type="number" min="0" step="1" value="${rule.maxNights}" data-tax-rule-nights></td>
    <td><select class="input-cell" data-tax-rule-active><option value="1" ${rule.active ? "selected" : ""}>Attiva</option><option value="0" ${!rule.active ? "selected" : ""}>Non applicata</option></select></td>
    <td class="num">${rule.uses.toLocaleString("it-IT")}</td><td class="num">${rule.properties.size.toLocaleString("it-IT")}</td>
    <td>${touristTaxRuleDate(rule.firstDate)}<small>fino al ${touristTaxRuleDate(rule.lastDate)}</small></td>
    <td><input class="input-cell" value="${escapeHtml(rule.note)}" placeholder="Nota/regola stagionale" data-tax-rule-note></td>
    <td><button class="primary" data-tax-rule-save="${escapeHtml(rule.key)}">Salva</button></td>
  </tr>`).join("");
  return `<section class="tourist-tax-rule-kpis"><article><span>Comuni con tassa</span><strong>${activeMunicipalities}</strong></article><article><span>Regole rilevate</span><strong>${rules.length}</strong></article><article><span>Comuni con varianti</span><strong>${ambiguous}</strong></article><article><span>Formula</span><strong class="tax-formula">EUR × persone × notti tassabili</strong></article></section>
  <section class="panel tourist-tax-rules"><div class="tourist-tax-results-head"><div><h3>Archivio regole comunali</h3><p>Tariffa per persona/notte e massimo di notti tassabili ricavati da “Tariffa standard” e “Max giorni”. Le varianti restano visibili per non perdere regole stagionali o storiche.</p></div><span class="badge">${new Set(rules.map(rule => rule.comune)).size} comuni filtrati</span></div>
  <div class="table-wrap"><table><thead><tr><th>Comune</th><th>Regola</th><th>EUR persona/notte</th><th>Max notti</th><th>Applicazione</th><th class="num">Riscontri</th><th class="num">Immobili</th><th>Periodo osservato</th><th>Nota manuale</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="10">Nessuna regola trovata.</td></tr>`}</tbody></table></div></section>`;
}
function touristTaxFilteredRows() {
  const data = touristTaxDataset();
  const query = touristTaxFilters.search.trim().toLocaleLowerCase("it-IT");
  const rows = [];
  for (let index = 0; index < data.rows.length; index++) {
    const row = touristTaxRecord(index);
    const comune = String(row.Comune || "");
    if (query && ![row["ID Pren."], row.Immobile, comune, row.Provider].some(value => String(value || "").toLocaleLowerCase("it-IT").includes(query))) continue;
    if (touristTaxFilters.initial && comune.charAt(0).toLocaleUpperCase("it-IT") !== touristTaxFilters.initial) continue;
    if (touristTaxFilters.comune && comune !== touristTaxFilters.comune) continue;
    if (touristTaxFilters.provincia && row["Prov."] !== touristTaxFilters.provincia) continue;
    if (touristTaxFilters.immobile && row.Immobile !== touristTaxFilters.immobile) continue;
    if (touristTaxFilters.ota && row.OTA !== touristTaxFilters.ota) continue;
    if (touristTaxFilters.month && touristTaxMonth(row["Data arrivo"]) !== touristTaxFilters.month) continue;
    const incassato = touristTaxMoney(row["Imp. incassato"]);
    if (touristTaxFilters.status === "incassato" && incassato <= 0) continue;
    if (touristTaxFilters.status === "da-incassare" && incassato > 0) continue;
    rows.push({ index, row });
  }
  const compareText = (a, b, field) => String(a.row[field] || "").localeCompare(String(b.row[field] || ""), "it", { sensitivity: "base" });
  rows.sort((a, b) => {
    if (touristTaxFilters.sort === "date-asc") return touristTaxDateValue(a.row["Data arrivo"]) - touristTaxDateValue(b.row["Data arrivo"]);
    if (touristTaxFilters.sort === "comune") return compareText(a, b, "Comune") || compareText(a, b, "Immobile");
    if (touristTaxFilters.sort === "netto-desc") return touristTaxMoney(b.row["Imp. netto"]) - touristTaxMoney(a.row["Imp. netto"]);
    return touristTaxDateValue(b.row["Data arrivo"]) - touristTaxDateValue(a.row["Data arrivo"]);
  });
  return rows;
}
function touristTaxEditor() {
  if (touristTaxEditingIndex === null) return "";
  const data = touristTaxDataset();
  const row = touristTaxRecord(touristTaxEditingIndex);
  return `<section class="panel tourist-tax-editor">
    <div class="tourist-tax-editor-head"><div><h3>Modifica prenotazione ${escapeHtml(row["ID Pren."] || "")}</h3><p>Le modifiche vengono salvate nello stato locale; il CSV sorgente resta invariato.</p></div><button data-tax-edit-cancel>Chiudi</button></div>
    <div class="tourist-tax-edit-grid">${data.columns.map(column => `<label><span>${escapeHtml(column)}</span><input class="input-cell" data-tax-edit-field="${escapeHtml(column)}" value="${escapeHtml(row[column] || "")}"></label>`).join("")}</div>
    <div class="tourist-tax-edit-actions"><button class="primary" data-tax-edit-save="${touristTaxEditingIndex}">Salva modifiche</button><button class="danger" data-tax-edit-restore="${touristTaxEditingIndex}">Ripristina riga originale</button></div>
  </section>`;
}
function touristTaxComparison(rows) {
  const groups = new Map();
  rows.forEach(({ row }) => {
    const key = row.Comune || "Non indicato";
    const item = groups.get(key) || { comune: key, prenotazioni: 0, calcolato: 0, esenzioni: 0, netto: 0, incassato: 0 };
    item.prenotazioni++;
    item.calcolato += touristTaxMoney(row["Imp. calcolato"]);
    item.esenzioni += touristTaxMoney(row.Esenzioni);
    item.netto += touristTaxMoney(row["Imp. netto"]);
    item.incassato += touristTaxMoney(row["Imp. incassato"]);
    groups.set(key, item);
  });
  const top = [...groups.values()].sort((a, b) => b.netto - a.netto).slice(0, 15);
  return `<details class="panel tourist-tax-comparison"><summary><span>Confronto comuni</span><span class="badge">${groups.size} comuni filtrati</span></summary>
    <div class="table-wrap"><table><thead><tr><th>Comune</th><th class="num">Prenotazioni</th><th class="num">Calcolato</th><th class="num">Esenzioni</th><th class="num">Netto</th><th class="num">Incassato</th></tr></thead><tbody>${top.map(item => `<tr><td><strong>${escapeHtml(item.comune)}</strong></td><td class="num">${item.prenotazioni}</td><td class="num">€ ${formatValue(item.calcolato)}</td><td class="num">€ ${formatValue(item.esenzioni)}</td><td class="num">€ ${formatValue(item.netto)}</td><td class="num">€ ${formatValue(item.incassato)}</td></tr>`).join("")}</tbody></table></div>
  </details>`;
}
function renderTouristTax() {
  const data = touristTaxDataset();
  if (!data.rows.length) return `${head("Tassa di soggiorno 2026", "Archivio non disponibile.")}<section class="panel"><p>Nessun dato caricato.</p></section>`;
  const allRecords = data.rows.map((_, index) => touristTaxRecord(index));
  const uniques = field => [...new Set(allRecords.map(row => String(row[field] || "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
  const comuni = uniques("Comune");
  const province = uniques("Prov.");
  const immobili = uniques("Immobile");
  const otas = uniques("OTA");
  const months = [...new Set(allRecords.map(row => touristTaxMonth(row["Data arrivo"])).filter(Boolean))].sort((a, b) => { const [am, ay] = a.split("/").map(Number); const [bm, by] = b.split("/").map(Number); return ay - by || am - bm; });
  const initials = [...new Set(comuni.map(value => value.charAt(0).toLocaleUpperCase("it-IT")))].sort();
  const filtered = touristTaxFilteredRows();
  const totals = filtered.reduce((sum, { row }) => { sum.calcolato += touristTaxMoney(row["Imp. calcolato"]); sum.esenzioni += touristTaxMoney(row.Esenzioni); sum.netto += touristTaxMoney(row["Imp. netto"]); sum.incassato += touristTaxMoney(row["Imp. incassato"]); return sum; }, { calcolato: 0, esenzioni: 0, netto: 0, incassato: 0 });
  const pageSize = 50;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  touristTaxPage = Math.min(Math.max(1, touristTaxPage), pageCount);
  const pageRows = filtered.slice((touristTaxPage - 1) * pageSize, touristTaxPage * pageSize);
  const tableRows = pageRows.map(({ index, row }) => `<tr>
    <td><strong>${escapeHtml(row["ID Pren."] || "")}</strong></td><td>${escapeHtml(row.Immobile || "")}</td><td>${escapeHtml(row.Comune || "")}<small>${escapeHtml(row["Prov."] || "")}</small></td>
    <td>${escapeHtml(row["Data arrivo"] || "")}</td><td>${escapeHtml(row["Data partenza"] || "")}</td><td class="num">${escapeHtml(row.Notti || "")}</td><td class="num">${escapeHtml(row["Ospiti prn."] || "")}</td>
    <td class="num">€ ${formatValue(touristTaxMoney(row["Tariffa standard"]))}</td><td class="num">€ ${formatValue(touristTaxMoney(row["Imp. calcolato"]))}</td><td class="num">€ ${formatValue(touristTaxMoney(row.Esenzioni))}</td><td class="num"><strong>€ ${formatValue(touristTaxMoney(row["Imp. netto"]))}</strong></td><td class="num">€ ${formatValue(touristTaxMoney(row["Imp. incassato"]))}</td>
    <td><span class="strategy-pill ${touristTaxMoney(row["Imp. incassato"]) > 0 ? "on" : ""}">${touristTaxMoney(row["Imp. incassato"]) > 0 ? "Incassato" : "Da incassare"}</span></td><td><button data-tax-edit="${index}">Modifica</button></td>
  </tr>`).join("");
  return `${head("Tassa di soggiorno 2026", `Matrice comunale ricavata da ${data.rows.length.toLocaleString("it-IT")} movimenti del file ${data.source}. Le regole sono pronte per il successivo collegamento al calcolo del soggiorno.`)}
  ${touristTaxEditor()}
  <section class="panel tourist-tax-filters">
    <div class="tourist-tax-filter-grid">
      <label class="tax-search"><span>Ricerca Comune</span><input class="input-cell" data-tax-filter="search" value="${escapeHtml(touristTaxFilters.search)}" placeholder="Comune, provincia o nota"></label>
      <label><span>Comune</span><select class="input-cell" data-tax-filter="comune">${touristTaxOptionList(comuni, touristTaxFilters.comune, "Tutti i comuni")}</select></label>
      <label><span>Provincia</span><select class="input-cell" data-tax-filter="provincia">${touristTaxOptionList(province, touristTaxFilters.provincia, "Tutte")}</select></label>
      <label><span>Immobile</span><select class="input-cell" data-tax-filter="immobile">${touristTaxOptionList(immobili, touristTaxFilters.immobile, "Tutti gli immobili")}</select></label>
      <label><span>OTA</span><select class="input-cell" data-tax-filter="ota">${touristTaxOptionList(otas, touristTaxFilters.ota, "Tutte")}</select></label>
      <label><span>Mese arrivo</span><select class="input-cell" data-tax-filter="month">${touristTaxOptionList(months, touristTaxFilters.month, "Tutti i mesi")}</select></label>
      <label><span>Incasso</span><select class="input-cell" data-tax-filter="status"><option value="">Tutti</option><option value="incassato" ${touristTaxFilters.status === "incassato" ? "selected" : ""}>Incassato</option><option value="da-incassare" ${touristTaxFilters.status === "da-incassare" ? "selected" : ""}>Da incassare</option></select></label>
      <label><span>Ordina</span><select class="input-cell" data-tax-filter="sort"><option value="date-desc" ${touristTaxFilters.sort === "date-desc" ? "selected" : ""}>Data più recente</option><option value="date-asc" ${touristTaxFilters.sort === "date-asc" ? "selected" : ""}>Data meno recente</option><option value="comune" ${touristTaxFilters.sort === "comune" ? "selected" : ""}>Comune</option><option value="netto-desc" ${touristTaxFilters.sort === "netto-desc" ? "selected" : ""}>Importo netto</option></select></label>
      <button class="danger" data-tax-reset-filters>Reset filtri</button>
    </div>
    <div class="tax-alphabet"><button class="${!touristTaxFilters.initial ? "active" : ""}" data-tax-initial="">Tutti</button>${initials.map(initial => `<button class="${touristTaxFilters.initial === initial ? "active" : ""}" data-tax-initial="${initial}">${initial}</button>`).join("")}</div>
  </section>
  ${touristTaxRuleCatalog()}
  <details class="panel tourist-tax-history"><summary><span>Apri storico movimenti usato come fonte</span><span class="badge">${filtered.length.toLocaleString("it-IT")} righe filtrate</span></summary>
  <section class="tourist-tax-kpis"><article><span>Prenotazioni filtrate</span><strong>${filtered.length.toLocaleString("it-IT")}</strong></article><article><span>Importo calcolato</span><strong>€ ${formatValue(totals.calcolato)}</strong></article><article><span>Esenzioni</span><strong>€ ${formatValue(totals.esenzioni)}</strong></article><article><span>Importo netto</span><strong>€ ${formatValue(totals.netto)}</strong></article><article><span>Importo incassato</span><strong>€ ${formatValue(totals.incassato)}</strong></article></section>
  ${touristTaxComparison(filtered)}
  <section class="panel tourist-tax-results"><div class="tourist-tax-results-head"><div><h3>Movimenti tassa di soggiorno</h3><p>Pagina ${touristTaxPage} di ${pageCount} · 50 righe per pagina</p></div><div class="tax-pagination"><button data-tax-page="${touristTaxPage - 1}" ${touristTaxPage <= 1 ? "disabled" : ""}>Precedente</button><button data-tax-page="${touristTaxPage + 1}" ${touristTaxPage >= pageCount ? "disabled" : ""}>Successiva</button></div></div>
    <div class="table-wrap tourist-tax-table"><table><thead><tr><th>ID</th><th>Immobile</th><th>Comune</th><th>Arrivo</th><th>Partenza</th><th class="num">Notti</th><th class="num">Ospiti</th><th class="num">Tariffa</th><th class="num">Calcolato</th><th class="num">Esenzioni</th><th class="num">Netto</th><th class="num">Incassato</th><th>Stato</th><th></th></tr></thead><tbody>${tableRows || `<tr><td colspan="14">Nessun risultato per i filtri selezionati.</td></tr>`}</tbody></table></div>
  </section></details>`;
}
function saveTouristTaxRule(key, row) {
  const source = touristTaxRules().find(rule => rule.key === key);
  if (!source || !row) return;
  const rate = Math.max(0, touristTaxMoney(row.querySelector("[data-tax-rule-rate]")?.value));
  const maxNights = Math.max(0, Math.round(Number(row.querySelector("[data-tax-rule-nights]")?.value) || 0));
  const active = row.querySelector("[data-tax-rule-active]")?.value === "1";
  const note = String(row.querySelector("[data-tax-rule-note]")?.value || "").trim();
  if (!state.touristTaxRuleEdits) state.touristTaxRuleEdits = {};
  state.touristTaxRuleEdits[key] = { rate, maxNights, active, note };
  dirty = true;
  log(`Tassa soggiorno: aggiornata regola ${source.comune} (€ ${formatValue(rate)}, max ${maxNights} notti)`, { action: "regola tassa soggiorno", comune: source.comune });
  saveState();
  render();
  showSaveConfirmation("Regola tassa di soggiorno salvata");
}
function saveTouristTaxEdit(index, root) {
  const data = touristTaxDataset();
  if (!data.rows[index]) return;
  const edits = {};
  root.querySelectorAll("[data-tax-edit-field]").forEach(input => {
    const column = input.dataset.taxEditField;
    const sourceValue = String(data.rows[index][touristTaxColumnIndex(column)] ?? "");
    if (input.value !== sourceValue) edits[column] = input.value;
  });
  if (!state.touristTaxEdits) state.touristTaxEdits = {};
  if (Object.keys(edits).length) state.touristTaxEdits[index] = edits;
  else delete state.touristTaxEdits[index];
  touristTaxEditingIndex = null;
  dirty = true;
  log(`Tassa soggiorno: aggiornata prenotazione ${touristTaxRecord(index)["ID Pren."] || index}`, { action: "tassa soggiorno", riga: index });
  saveState();
  render();
  showSaveConfirmation("Modifica tassa di soggiorno salvata");
}
function restoreTouristTaxRow(index) {
  if (!state.touristTaxEdits) state.touristTaxEdits = {};
  delete state.touristTaxEdits[index];
  touristTaxEditingIndex = null;
  dirty = true;
  log(`Tassa soggiorno: ripristinata riga ${index + 1}`, { action: "tassa soggiorno ripristino", riga: index });
  render();
  updateSaveState("Modifiche non salvate");
}
function renderForecast() {
  const model = forecastModel();
  return `${head("Forecast", "Motore previsionale ricavato dal foglio Copia di ok: curve prezzo, budget, ADR, occupazione, stagionalità e scenari Monounit/Multiunit.")}
    <section class="panel forecast-mode-bar"><div><h3>Modello operativo</h3><p>Seleziona la configurazione da simulare.</p></div><div class="forecast-mode-buttons"><button class="${model.mode === "mono" ? "primary" : ""}" data-forecast-mode="mono">Monounit</button><button class="${model.mode === "multi" ? "primary" : ""}" data-forecast-mode="multi">Multiunit</button></div></section>
    ${forecastKpis(model)}
    <div class="forecast-two-col">${forecastParameters(model)}${forecastUnitTypes(model) || forecastScenarioPanel(model)}</div>
    ${model.mode === "multi" ? forecastScenarioPanel(model) : ""}
    <div class="forecast-analysis-grid">${forecastCurveTable(model)}${forecastMonthlyTable(model)}</div>
    ${forecastSeasonalityTable(model)}`;
}
function updateForecastField(field, rawValue, monthIndex = null) {
  const config = forecastConfig();
  if (["opening", "closing"].includes(field)) config[field] = rawValue;
  else if (field === "revenue" || field === "nights") config[field === "revenue" ? "revenues" : "nights"][Number(monthIndex)] = Math.max(0, Number(rawValue) || 0);
  else if (field === "curveWeight") config[field] = Math.max(0, Number(rawValue) || 0) / 100;
  else config[field] = Math.max(0, Number(rawValue) || 0);
  dirty = true;
  log(`Forecast ${state.forecast.mode}: aggiornato ${field}`, { action: "forecast aggiornato" });
  render();
  updateSaveState("Modifiche non salvate");
}
function updateForecastUnit(index, field, rawValue) {
  const config = state.forecast.multi;
  if (!config.unitTypes[index]) return;
  config.unitTypes[index][field] = field === "name" ? String(rawValue) : Math.max(0, Number(rawValue) || 0);
  dirty = true;
  render();
  updateSaveState("Modifiche non salvate");
}
function renderMaster() {
  const paramRows = [];
  for (let r = 4; r <= 12; r++) paramRows.push([val("Calcolatore_3_Master",`A${r}`), val("Calcolatore_3_Master",`B${r}`), val("Calcolatore_3_Master",`C${r}`), val("Calcolatore_3_Master",`D${r}`), val("Calcolatore_3_Master",`E${r}`), val("Calcolatore_3_Master",`F${r}`)]);
  const rows = [];
  for (let r = 20; r <= 80; r++) rows.push([""+r, val("Calcolatore_3_Master",`A${r}`), val("Calcolatore_3_Master",`B${r}`), val("Calcolatore_3_Master",`C${r}`), val("Calcolatore_3_Master",`F${r}`), val("Calcolatore_3_Master",`H${r}`), val("Calcolatore_3_Master",`K${r}`), val("Calcolatore_3_Master",`L${r}`), val("Calcolatore_3_Master",`P${r}`), val("Calcolatore_3_Master",`Q${r}`)]);
  return `${head("Calcolatore 3 Master", "Vista operativa della tabella master: struttura, regime tariffario, canale, prezzi lordi/netti e scostamento sul riferimento sito diretto.")}
  <section class="panel"><h3>Parametri master</h3>${table(["Parametro","Sito","Booking","Booking netto","Expedia","Extra"], paramRows, [1,2,3,4,5])}</section>
  <section class="panel" style="margin-top:16px"><h3>Tabella master calcolata</h3>${table(["Riga","Struttura","Tariffa","Canale","Target lordo","Prezzo finale","Pubblicazione","Cliente","Netto","Gap"], rows, [4,5,6,7,8,9])}</section>`;
}
function renderRms() {
  return `${head("Ottimizzazione RMS Prices", "Sezione integrata del simulatore RMS: strutture, camere, target, calendario, matrici e storico simulazioni.")}
  <section class="panel rms-frame-panel">
    <iframe class="rms-frame" src="public/channel/rms/index.html" title="Ottimizzazione RMS Prices"></iframe>
  </section>`;
}
function renderRoomNight() {
  return renderRoomNightNative();
}
function renderWorkbook() {
  const sheet = DATA.sheets.find(s => s.name === currentSheet) || DATA.sheets[0];
  const maxCols = Math.min(sheet.maxCol, 45), maxRows = sheet.maxRow;
  let body = "";
  for (let r = 1; r <= maxRows; r++) {
    let cells = ""; let visible = !sheetSearch;
    for (let c = 1; c <= maxCols; c++) {
      const addr = `${numToCol(c)}${r}`; const cell = getCell(sheet.name, addr); const value = cell.f ? evalCell(sheet.name, addr) : cell.v;
      const text = formatValue(value, cell.s?.numFmt, addr); const formula = cell.f ? escapeHtml(cell.f) : "";
      if (sheetSearch && (`${addr} ${text} ${formula}`).toLowerCase().includes(sheetSearch.toLowerCase())) visible = true;
      const cls = `${cell.f ? "formula" : cell.v !== null && cell.v !== undefined ? "editable" : ""}`;
      cells += `<td class="${cls}" title="${formula || escapeHtml(text)}">${cell.f ? escapeHtml(text) : `<input class="input-cell" data-sheet="${sheet.name}" data-addr="${addr}" value="${escapeHtml(displayRaw(cell.v))}">`}</td>`;
    }
    if (visible) body += `<tr><td class="row-head">${r}</td>${cells}</tr>`;
  }
  const heads = Array.from({length:maxCols}, (_,i)=>`<th>${numToCol(i+1)}</th>`).join("");
  return `${head("Workbook completo", "Vista cella-per-cella del file originale. Le celle gialle sono editabili, quelle azzurre sono formule ricalcolate dal motore dell'app.")}
  <div class="sheet-tabs">${DATA.sheets.map(s => `<button class="sheet-tab ${s.name===sheet.name?"active":""}" data-sheet-tab="${s.name}">${s.name}</button>`).join("")}</div>
  <div class="sheet-tools"><input id="sheetSearch" class="search" value="${escapeHtml(sheetSearch)}" placeholder="Cerca valore, formula o cella"><span class="badge">${sheet.maxRow} righe x ${sheet.maxCol} colonne</span></div>
  <div class="sheet-grid"><table><thead><tr><th class="row-head"></th>${heads}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function simulationRateSummary(groupId) {
  const touristTax = Math.max(0, Number(simulationTouristTax(groupId).total) || 0);
  return STRATEGY_OTAS.flatMap(ota => ratePlanSimulationsForOta(groupId, ota.id).map(item => ({
    key: `${ota.id}::${item.plan.id}`,
    otaId: ota.id,
    ota: ota.label,
    planId: item.plan.id,
    plan: item.plan.name,
    markup: item.sim.planMarkup,
    published: item.sim.pubblicare,
    final: item.sim.targetCliente,
    commission: item.sim.commission,
    net: item.sim.netto,
    reference: item.sim.directPublished,
    customerReference: item.sim.directPublished + touristTax,
    touristTax,
    deltaFinalSite: item.sim.targetCliente - (item.sim.directPublished + touristTax),
    deltaFinalSiteRatio: item.sim.directPublished + touristTax ? item.sim.targetCliente / (item.sim.directPublished + touristTax) - 1 : 0,
    deltaNet: item.sim.deltaMin,
    deltaNetRatio: item.sim.deltaMinRatio,
  })));
}
function simulationParameterSummary(groupId) {
  const context = simulationContext(groupId);
  const tax = simulationTouristTax(groupId);
  return {
    netCanone: netCanoneValue(),
    nrPublished: nrPublishedValue(),
    plExtra: plExtraValue(),
    postPlMarkup: postPlMarkupValue(),
    seasonality: effectiveSeasonalityMarkup(groupId),
    seasonalityLabel: currentSeasonalityRule().label,
    directCosts: effectiveCategoryCostsEur(groupId),
    otaCosts: Object.fromEntries(STRATEGY_OTAS.map(ota => [ota.id, manualOtaCostTotalValue(groupId, ota.id) ?? 0])),
    propertyName: String(context.propertyName || "").trim(),
    comune: String(context.comune || "").trim(),
    people: Math.max(1, Number(context.people) || 1),
    touristTax: tax.total,
  };
}
function simulationSignature(groupId) {
  const context = simulationContext(groupId);
  return [
    groupId,
    String(context.propertyName || "").trim().toLowerCase(),
    String(context.comune || "").trim().toLowerCase(),
    state.strategySimulation?.checkIn || "",
    state.strategySimulation?.checkOut || "",
    Math.max(1, Number(context.people) || 1),
  ].join("|");
}
function parameterBaselineScenario(groupId, savedAt = new Date().toISOString()) {
  return {
    id: `baseline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: "Parametri iniziali",
    kind: "baseline",
    savedAt,
    objective: null,
    tolerance: null,
    seasonality: effectiveSeasonalityMarkup(groupId),
    parameters: simulationParameterSummary(groupId),
    rows: simulationRateSummary(groupId),
  };
}
function buildCurrentSimulationEntry(groupId) {
  const group = STRATEGY_GROUPS.find(item => item.id === groupId);
  if (!group) return null;
  const context = simulationContext(groupId);
  const savedAt = new Date().toISOString();
  const snapshot = serializeEditableState({ includeSimulationHistory: false });
  snapshot.logs = [];
  delete snapshot.forecast;
  delete snapshot.touristTaxEdits;
  delete snapshot.touristTaxRuleEdits;
  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    signature: simulationSignature(groupId),
    savedAt,
    updatedAt: savedAt,
    groupId,
    groupLabel: group.label,
    propertyName: String(context.propertyName || "").trim(),
    comune: String(context.comune || "").trim(),
    checkIn: state.strategySimulation?.checkIn || "",
    checkOut: state.strategySimulation?.checkOut || "",
    nights: simulatedNights() || 1,
    people: Math.max(1, Number(context.people) || 1),
    rateSummary: simulationRateSummary(groupId),
    baselineScenario: parameterBaselineScenario(groupId, savedAt),
    graphScenarios: [],
    ratesLab: savedRatesLabForGroup(groupId),
    snapshot,
  };
}
function savedRatesLabForGroup(groupId) {
  if (ratesLab?.groupId === groupId) return JSON.parse(JSON.stringify(ratesLab));
  try { return JSON.parse(localStorage.getItem(`gestione-channel-rates-lab-${groupId}`) || "null"); } catch { return null; }
}
function saveCurrentSimulation(groupId) {
  const freshEntry = buildCurrentSimulationEntry(groupId);
  if (!freshEntry) return;
  if (!state.simulationHistory) state.simulationHistory = [];
  const activeId = localStorage.getItem(`gestione-channel-active-simulation-${groupId}`) || "";
  const existing = state.simulationHistory.find(item =>
    item.groupId === groupId &&
    (item.id === activeId || (item.signature || "") === freshEntry.signature)
  );
  const entry = existing ? {
    ...freshEntry,
    id: existing.id,
    savedAt: existing.savedAt || freshEntry.savedAt,
    updatedAt: freshEntry.savedAt,
    graphScenarios: Array.isArray(existing.graphScenarios) ? existing.graphScenarios : [],
  } : freshEntry;
  if (existing) state.simulationHistory = state.simulationHistory.filter(item => item.id !== existing.id);
  state.simulationHistory.unshift(entry);
  state.simulationHistory = state.simulationHistory.slice(0, 20);
  localStorage.setItem(`gestione-channel-active-simulation-${groupId}`, entry.id);
  log(`Simulazione salvata: ${entry.propertyName || entry.groupLabel}`, { action: "simulazione salvata", gruppo: entry.groupLabel });
  saveState();
  render();
  showSaveConfirmation("Salvataggio effettuato: simulazione salvata nello storico");
}
function ensureRatesLabSimulationEntry(groupId) {
  if (!state.simulationHistory) state.simulationHistory = [];
  const signature = simulationSignature(groupId);
  const activeId = localStorage.getItem(`gestione-channel-active-simulation-${groupId}`) || "";
  let entry = state.simulationHistory.find(item => item.id === activeId && item.groupId === groupId && (item.signature || "") === signature);
  if (!entry) entry = state.simulationHistory.find(item => item.groupId === groupId && (item.signature || "") === signature);
  if (!entry) {
    entry = buildCurrentSimulationEntry(groupId);
    if (!entry) return null;
    state.simulationHistory.unshift(entry);
    state.simulationHistory = state.simulationHistory.slice(0, 20);
  }
  localStorage.setItem(`gestione-channel-active-simulation-${groupId}`, entry.id);
  return entry;
}
function captureRatesLabScenario(name = "") {
  if (!ratesLab?.groupId) return null;
  const savedAt = new Date().toISOString();
  const rows = ratesLabRows().map(row => ({
    key: row.labKey,
    otaId: row.ota.id,
    ota: row.ota.label,
    planId: row.plan.id,
    plan: row.plan.name,
    markup: row.markup,
    published: row.pubblicare,
    final: row.finale,
    commission: row.commission,
    net: row.netto,
    reference: row.reference,
    customerReference: row.customerReference,
    touristTax: row.touristTax,
    deltaFinalSite: row.finale - row.customerReference,
    deltaFinalSiteRatio: row.finaleRatio,
    deltaNet: row.netto - row.reference,
    deltaNetRatio: row.nettoRatio,
  }));
  return {
    id: `rates-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(name || "").trim(),
    kind: "graph",
    savedAt,
    objective: Number(ratesLab.objective) || 0,
    tolerance: Number(ratesLab.tolerance) || 0,
    seasonality: Number(ratesLab.seasonality) || 0,
    parameters: simulationParameterSummary(ratesLab.groupId),
    markups: JSON.parse(JSON.stringify(ratesLab.markups || {})),
    rows,
    ratesLab: JSON.parse(JSON.stringify(ratesLab)),
  };
}
function saveRatesLabScenarioToHistory() {
  if (!ratesLab?.groupId) return null;
  const entry = ensureRatesLabSimulationEntry(ratesLab.groupId);
  if (!entry) return null;
  if (!Array.isArray(entry.graphScenarios)) entry.graphScenarios = [];
  const defaultName = `Scenario ${entry.graphScenarios.length + 1}`;
  const scenario = captureRatesLabScenario(ratesLab.scenarioName || defaultName);
  if (!scenario) return null;
  if (!scenario.name) scenario.name = defaultName;
  entry.graphScenarios.push(scenario);
  if (simulationHistorySelections[entry.id]) simulationHistorySelections[entry.id].add(scenario.id);
  entry.updatedAt = scenario.savedAt;
  entry.ratesLab = scenario.ratesLab;
  entry.rateSummary = simulationRateSummary(entry.groupId);
  saveState();
  return { entry, scenario };
}
function restoreSavedSimulation(id) {
  const history = state.simulationHistory || [];
  const entry = history.find(item => item.id === id);
  if (!entry?.snapshot) return;
  const persisted = {
    ...entry.snapshot,
    simulationHistory: history,
    forecast: state.forecast,
    touristTaxEdits: state.touristTaxEdits || {},
    touristTaxRuleEdits: state.touristTaxRuleEdits || {},
    logs: state.logs || [],
  };
  localStorage.setItem(STORE_KEY, JSON.stringify(persisted));
  state = makeInitialState();
  state.simulationHistory = history;
  if (entry.snapshot.pricingInputs) state.pricingInputs = JSON.parse(JSON.stringify(entry.snapshot.pricingInputs));
  if (entry.ratesLab) localStorage.setItem(`gestione-channel-rates-lab-${entry.groupId}`, JSON.stringify(entry.ratesLab));
  localStorage.setItem(`gestione-channel-active-simulation-${entry.groupId}`, entry.id);
  ratesLab = null;
  parameterStrategy = entry.groupId;
  undoStack = [];
  redoStack = [];
  dirty = false;
  invalidate();
  log(`Simulazione riaperta: ${entry.propertyName || entry.groupLabel}`, { action: "simulazione riaperta", gruppo: entry.groupLabel });
  saveState();
  navigate("inputs");
  showSaveConfirmation();
}
function deleteSavedSimulation(id) {
  const entry = (state.simulationHistory || []).find(item => item.id === id);
  state.simulationHistory = (state.simulationHistory || []).filter(item => item.id !== id);
  if (entry && localStorage.getItem(`gestione-channel-active-simulation-${entry.groupId}`) === id) localStorage.removeItem(`gestione-channel-active-simulation-${entry.groupId}`);
  delete simulationHistorySelections[id];
  delete simulationHistoryOtaSelections[id];
  delete simulationHistoryReportOpen[id];
  saveState();
  render();
}
function legacyBaselineScenario(entry) {
  return {
    id: `baseline-${entry.id}`,
    name: "Parametri iniziali",
    kind: "baseline",
    savedAt: entry.savedAt,
    objective: null,
    tolerance: null,
    seasonality: Number(entry.ratesLab?.seasonality) || 0,
    parameters: entry.parameterSummary || {},
    rows: (entry.rateSummary || []).map((row, index) => ({
      key: row.key || `${row.otaId || row.ota || "ota"}::${row.planId || row.plan || index}`,
      ...row,
      markup: Number(row.markup) || 0,
      net: Number(row.net) || 0,
      reference: Number(row.reference) || 0,
      deltaNet: Number(row.deltaNet) || 0,
      deltaNetRatio: Number(row.deltaNetRatio) || 0,
    })),
  };
}
function simulationScenarios(entry) {
  const baseline = entry.baselineScenario || legacyBaselineScenario(entry);
  const graphScenarios = Array.isArray(entry.graphScenarios) ? entry.graphScenarios : [];
  return [baseline, ...graphScenarios];
}
function simulationSelection(entry) {
  const scenarios = simulationScenarios(entry);
  if (!simulationHistorySelections[entry.id]) simulationHistorySelections[entry.id] = new Set(scenarios.map(item => item.id));
  const validIds = new Set(scenarios.map(item => item.id));
  simulationHistorySelections[entry.id] = new Set([...simulationHistorySelections[entry.id]].filter(id => validIds.has(id)));
  return simulationHistorySelections[entry.id];
}
function simulationAvailableOtas(entry) {
  const ids = new Set(simulationScenarios(entry).flatMap(scenario => (scenario.rows || []).map(row => row.otaId).filter(Boolean)));
  return STRATEGY_OTAS.filter(ota => ids.has(ota.id));
}
function simulationOtaSelection(entry) {
  const available = simulationAvailableOtas(entry);
  const validIds = new Set(available.map(ota => ota.id));
  if (!simulationHistoryOtaSelections[entry.id]) simulationHistoryOtaSelections[entry.id] = new Set(validIds);
  simulationHistoryOtaSelections[entry.id] = new Set([...simulationHistoryOtaSelections[entry.id]].filter(id => validIds.has(id)));
  return simulationHistoryOtaSelections[entry.id];
}
function filterSimulationScenariosByOta(scenarios, otaSelection) {
  return scenarios.map(scenario => ({
    ...scenario,
    rows: (scenario.rows || []).filter(row => otaSelection.has(row.otaId)),
  }));
}
function reportScenariosForSelection(entry, scenarios, otaSelection) {
  const baselineRows = entry.baselineScenario?.rows?.length ? entry.baselineScenario.rows : (entry.rateSummary || []);
  const savedTouristTax = Math.max(0, Number(entry.baselineScenario?.parameters?.touristTax ?? entry.baselineScenario?.parameters?.touristTaxTotal) || 0);
  const siteReferences = new Map(baselineRows.map(row => [row.key, Number(row.reference) || 0]));
  const customerReferences = new Map(baselineRows.map(row => [row.key, Number(row.customerReference) || (Number(row.reference) || 0) + savedTouristTax]));
  return filterSimulationScenariosByOta(scenarios, otaSelection).map(scenario => ({
    ...scenario,
    rows: (scenario.rows || []).map(row => {
      const reference = Number(siteReferences.get(row.key) ?? row.reference) || 0;
      const customerReference = Number(customerReferences.get(row.key) ?? row.customerReference ?? reference) || 0;
      const net = Number(row.net) || 0;
      const final = Number(row.final) || 0;
      return {
        ...row,
        reference,
        customerReference,
        deltaFinalSite: final - customerReference,
        deltaFinalSiteRatio: customerReference ? final / customerReference - 1 : 0,
        deltaNet: net - reference,
        deltaNetRatio: reference ? net / reference - 1 : 0,
      };
    }),
  }));
}
function scenarioAverage(scenario, field) {
  const values = (scenario.rows || []).map(row => Number(row[field])).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function renderSimulationComparisonChart(scenarios) {
  if (!scenarios.length) return "";
  const values = scenarios.map(item => scenarioAverage(item, "deltaNetRatio"));
  const min = Math.min(-.20, ...values, 0);
  const max = Math.max(.30, ...values, 0);
  const width = 1080;
  const left = 245;
  const right = 28;
  const rowH = 54;
  const height = 52 + scenarios.length * rowH;
  const x = value => left + ((value - min) / Math.max(.0001, max - min)) * (width - left - right);
  const ticks = Array.from({ length: 7 }, (_, index) => min + (max - min) * index / 6);
  const grid = ticks.map(value => `<g><line x1="${x(value)}" y1="32" x2="${x(value)}" y2="${height - 15}"/><text x="${x(value)}" y="22">${formatValue(value, "0.0%")}</text></g>`).join("");
  const rows = scenarios.map((scenario, index) => {
    const value = values[index];
    const y = 55 + index * rowH;
    const tone = value >= 0 ? "positive" : "negative";
    return `<g><text class="comparison-chart-name" x="8" y="${y + 4}">${escapeHtml(scenario.name)}</text><line class="comparison-chart-range" x1="${x(0)}" y1="${y}" x2="${x(value)}" y2="${y}"/><circle class="comparison-chart-dot ${tone}" cx="${x(value)}" cy="${y}" r="7"/><text class="comparison-chart-value ${tone}" x="${x(value)}" y="${y - 12}">${formatValue(value, "0.00%")}</text></g>`;
  }).join("");
  return `<div class="simulation-comparison-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Delta netto medio degli scenari"><g class="comparison-chart-grid">${grid}</g><line class="comparison-chart-zero" x1="${x(0)}" y1="32" x2="${x(0)}" y2="${height - 15}"/>${rows}</svg></div>`;
}
function renderSimulationScenarioOverlayChart(scenarios) {
  if (!scenarios.length) return "";
  const palette = ["#0c5d95", "#d12b35", "#e67e22", "#0a9e68", "#6c4db3", "#5d6b78", "#b34389"];
  const rowMap = new Map();
  scenarios.forEach(scenario => (scenario.rows || []).forEach(row => {
    if (!rowMap.has(row.key)) rowMap.set(row.key, `${row.ota || row.otaId} · ${row.plan || row.planId}`);
  }));
  const rowKeys = [...rowMap.keys()];
  if (!rowKeys.length) return "";
  const values = scenarios.flatMap(scenario => (scenario.rows || []).map(row => Number(row.deltaNetRatio)).filter(Number.isFinite));
  const min = Math.min(-.20, ...values, 0);
  const max = Math.max(.30, ...values, 0);
  const width = 1180;
  const left = 300;
  const right = 34;
  const legendH = Math.ceil(scenarios.length / 3) * 22 + 18;
  const rowH = Math.max(54, scenarios.length * 13 + 22);
  const top = 36 + legendH;
  const height = top + rowKeys.length * rowH + 24;
  const x = value => left + ((value - min) / Math.max(.0001, max - min)) * (width - left - right);
  const ticks = Array.from({ length: 7 }, (_, index) => min + (max - min) * index / 6);
  const grid = ticks.map(value => `<g><line x1="${x(value)}" y1="${top - 22}" x2="${x(value)}" y2="${height - 14}"/><text x="${x(value)}" y="${top - 28}">${formatValue(value, "0.0%")}</text></g>`).join("");
  const legend = scenarios.map((scenario, index) => {
    const column = index % 3;
    const line = Math.floor(index / 3);
    const lx = 10 + column * 385;
    const ly = 18 + line * 22;
    return `<g><circle cx="${lx + 6}" cy="${ly}" r="5" fill="${palette[index % palette.length]}"/><text class="comparison-overlay-legend" x="${lx + 18}" y="${ly + 4}">${escapeHtml(scenario.name)}</text></g>`;
  }).join("");
  const rows = rowKeys.map((key, rowIndex) => {
    const centerY = top + rowIndex * rowH;
    const points = scenarios.map((scenario, scenarioIndex) => {
      const row = (scenario.rows || []).find(item => item.key === key);
      if (!row) return "";
      const value = Number(row.deltaNetRatio) || 0;
      const y = centerY + (scenarioIndex - (scenarios.length - 1) / 2) * 13;
      return `<circle class="comparison-overlay-dot" cx="${x(value)}" cy="${y}" r="6" fill="${palette[scenarioIndex % palette.length]}"><title>${escapeHtml(scenario.name)} · ${formatValue(value, "0.00%")} · netto ${formatValue(Number(row.net) || 0)}</title></circle>`;
    }).join("");
    return `<g><text class="comparison-chart-name" x="8" y="${centerY + 4}">${escapeHtml(rowMap.get(key))}</text><line class="comparison-overlay-row" x1="${x(min)}" y1="${centerY}" x2="${x(max)}" y2="${centerY}"/>${points}</g>`;
  }).join("");
  return `<div class="simulation-comparison-chart overlay"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Scenari sovrapposti per piano tariffario">${legend}<g class="comparison-chart-grid">${grid}</g><line class="comparison-chart-zero" x1="${x(0)}" y1="${top - 22}" x2="${x(0)}" y2="${height - 14}"/>${rows}</svg></div>`;
}
function renderSimulationRatesReportCharts(scenarios) {
  if (!scenarios.length) return "";
  const palette = ["#0c5d95", "#d12b35", "#e67e22", "#0a9e68", "#6c4db3", "#5d6b78", "#b34389"];
  const rowMap = new Map();
  scenarios.forEach(scenario => (scenario.rows || []).forEach(row => {
    if (!rowMap.has(row.key)) rowMap.set(row.key, `${row.ota || row.otaId} · ${row.plan || row.planId}`);
  }));
  const rowKeys = [...rowMap.keys()];
  if (!rowKeys.length) return "";

  const renderPanel = (title, withTax) => {
    const width = 1060;
    const left = 250;
    const right = 28;
    const top = 48 + Math.ceil(scenarios.length / 3) * 19;
    const rowH = Math.max(48, scenarios.length * 13 + 20);
    const height = top + rowKeys.length * rowH + 24;
    const min = -0.25;
    const max = 0.25;
    const x = value => left + ((Math.max(min, Math.min(max, value)) - min) / (max - min)) * (width - left - right);
    const ticks = Array.from({ length: 11 }, (_, index) => min + index * .05);
    const grid = ticks.map(value => `<g><line x1="${x(value)}" y1="${top - 16}" x2="${x(value)}" y2="${height - 12}"/><text x="${x(value)}" y="${top - 21}">${formatValue(value, "0%")}</text></g>`).join("");
    const legend = scenarios.map((scenario, index) => {
      const column = index % 3;
      const line = Math.floor(index / 3);
      const lx = 8 + column * 335;
      const ly = 16 + line * 19;
      return `<g><circle cx="${lx + 5}" cy="${ly}" r="4.5" fill="${palette[index % palette.length]}"/><text class="simulation-rate-legend" x="${lx + 16}" y="${ly + 3.5}">${escapeHtml(scenario.name)}</text></g>`;
    }).join("");
    const rows = rowKeys.map((key, rowIndex) => {
      const y = top + rowIndex * rowH;
      const points = scenarios.map((scenario, scenarioIndex) => {
        const row = (scenario.rows || []).find(item => item.key === key);
        if (!row) return "";
        const reference = Number(withTax ? row.customerReference : row.reference) || 0;
        if (!reference) return "";
        const net = Number(row.net) || 0;
        const final = Number(row.final) || 0;
        const netRatio = net / reference - 1;
        const finalRatio = final / reference - 1;
        const offset = (scenarioIndex - (scenarios.length - 1) / 2) * 12;
        const pointY = y + offset;
        const color = palette[scenarioIndex % palette.length];
        const label = `${scenario.name} · netto ${formatValue(net)} (${formatValue(netRatio, "0.00%")}) · cliente ${formatValue(final)} (${formatValue(finalRatio, "0.00%")})`;
        return `<g><line class="simulation-rate-row-line" x1="${x(netRatio)}" y1="${pointY}" x2="${x(finalRatio)}" y2="${pointY}" stroke="${color}"/><circle class="simulation-rate-net" cx="${x(netRatio)}" cy="${pointY}" r="5" fill="${color}"><title>${escapeHtml(label)}</title></circle><circle class="simulation-rate-final" cx="${x(finalRatio)}" cy="${pointY}" r="5" fill="#fff" stroke="${color}"><title>${escapeHtml(label)}</title></circle></g>`;
      }).join("");
      return `<g><text class="simulation-rate-name" x="8" y="${y + 4}">${escapeHtml(rowMap.get(key))}</text><line class="simulation-rate-baseline" x1="${x(min)}" y1="${y}" x2="${x(max)}" y2="${y}"/>${points}</g>`;
    }).join("");
    return `<section class="simulation-rate-report-panel"><h5>${title}</h5><p>Pieno: netto OTA. Vuoto: prezzo finale cliente. Colori: scenari salvati.</p><div class="simulation-rate-report-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}">${legend}<g class="simulation-rate-grid">${grid}</g><line class="simulation-rate-zero" x1="${x(0)}" y1="${top - 16}" x2="${x(0)}" y2="${height - 12}"/>${rows}</svg></div></section>`;
  };
  return `<div class="simulation-rates-report-grid">${renderPanel("Confronto senza tassa di soggiorno", false)}${renderPanel("Confronto con tassa di soggiorno", true)}</div>`;
}
function renderSimulationAmountsChart(scenarios) {
  if (!scenarios.length) return "";
  const metrics = [
    ["published", "Pubblicare", "published"],
    ["final", "Finale cliente", "final"],
    ["net", "Netto OTA", "net"],
  ];
  const values = scenarios.flatMap(scenario => metrics.map(([field]) => scenarioAverage(scenario, field)));
  const max = Math.max(1, ...values);
  const width = 1080;
  const left = 245;
  const right = 35;
  const rowH = 76;
  const height = 38 + scenarios.length * rowH;
  const x = value => left + (Math.max(0, value) / max) * (width - left - right);
  const rows = scenarios.map((scenario, scenarioIndex) => {
    const y = 46 + scenarioIndex * rowH;
    const bars = metrics.map(([field, label, cssClass], metricIndex) => {
      const value = scenarioAverage(scenario, field);
      const barY = y + metricIndex * 17;
      return `<rect class="comparison-amount-bar ${cssClass}" x="${left}" y="${barY - 9}" width="${Math.max(1, x(value) - left)}" height="10" rx="3"/><text class="comparison-amount-value" x="${Math.min(width - right, x(value) + 7)}" y="${barY}">${escapeHtml(label)} ${formatValue(value)}</text>`;
    }).join("");
    return `<g><text class="comparison-chart-name" x="8" y="${y + 11}">${escapeHtml(scenario.name)}</text>${bars}</g>`;
  }).join("");
  return `<div class="simulation-comparison-chart"><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Valori medi degli scenari">${rows}</svg></div>`;
}
function renderSimulationComparisonReport(entry, scenarios, otaSelection) {
  const reportScenarios = reportScenariosForSelection(entry, scenarios, otaSelection);
  if (!reportScenarios.length || !reportScenarios.some(scenario => scenario.rows?.length)) return `<div class="simulation-comparison-empty">Seleziona almeno uno scenario e una OTA.</div>`;
  const reference = reportScenarios[0];
  const referenceRows = new Map((reference.rows || []).map(row => [row.key, row]));
  const parameterSource = entry.baselineScenario?.parameters || reference.parameters || {};
  const scenarioCards = reportScenarios.map(scenario => `<article><span>${escapeHtml(scenario.kind === "baseline" ? "BASE" : "SCENARIO")}</span><strong>${escapeHtml(scenario.name)}</strong><small>Obiettivo ${scenario.objective === null || scenario.objective === undefined ? "—" : formatValue(scenario.objective, "0.00%")} · Markup medio ${formatValue(scenarioAverage(scenario, "markup"), "0.00%")}</small><b>Netto medio ${formatValue(scenarioAverage(scenario, "net"))}</b></article>`).join("");
  const rows = reportScenarios.flatMap(scenario => (scenario.rows || []).map(row => {
    const base = referenceRows.get(row.key) || {};
    const deltaFinal = Number(row.final) - (Number(base.final) || 0);
    const deltaNet = Number(row.net) - (Number(base.net) || 0);
    return `<tr><td>${escapeHtml(scenario.name)}</td><td>${escapeHtml(row.ota || row.otaId || "")}</td><td>${escapeHtml(row.plan || row.planId || "")}</td><td class="num">${formatValue(Number(row.markup) || 0, "0.00%")}</td><td class="num">${formatValue(Number(row.published) || 0)}</td><td class="num">${formatValue(Number(row.final) || 0)}</td><td class="num">${formatValue(Number(row.net) || 0)}</td><td class="num">${formatValue(Number(row.reference) || 0)}</td><td class="num">${formatValue(Number(row.deltaNet) || 0)}<small>${formatValue(Number(row.deltaNetRatio) || 0, "0.00%")}</small></td><td class="num">${formatValue(Number(row.customerReference) || 0)}</td><td class="num">${formatValue(Number(row.deltaFinalSite) || 0)}<small>${formatValue(Number(row.deltaFinalSiteRatio) || 0, "0.00%")}</small></td><td class="num">${formatValue(deltaFinal)}</td><td class="num">${formatValue(deltaNet)}</td></tr>`;
  })).join("");
  const otaCosts = parameterSource.otaCosts || {};
  return `<section class="simulation-comparison-report" data-comparison-report="${entry.id}">
    <div class="simulation-comparison-head"><div><span class="eyebrow">Report VS comparativo</span><h3>${escapeHtml(entry.propertyName || entry.groupLabel || "Simulazione")}</h3><p>${escapeHtml(entry.comune || "Comune non indicato")} · ${escapeHtml(entry.checkIn || "Data libera")} → ${escapeHtml(entry.checkOut || "Data libera")} · ${Number(entry.nights) || 1} notti · ${Number(entry.people) || 1} persone</p></div><div><button data-export-comparison="${entry.id}">Esporta CSV</button><button class="primary" data-print-comparison="${entry.id}">Stampa report</button><button data-close-comparison="${entry.id}">Chiudi</button></div></div>
    <div class="simulation-parameter-strip"><span><small>Canone netto</small><b>${formatValue(Number(parameterSource.netCanone) || 0)}</b></span><span><small>NR sito</small><b>${formatValue(Number(parameterSource.nrPublished) || 0)}</b></span><span><small>Stagionalita</small><b>${formatValue(Number(parameterSource.seasonality) || 0, "0.00%")}</b></span><span><small>Costi diretti</small><b>${formatValue(Number(parameterSource.directCosts) || 0)}</b></span><span><small>Costi Booking</small><b>${formatValue(Number(otaCosts.booking) || 0)}</b></span><span><small>Costi Airbnb</small><b>${formatValue(Number(otaCosts.airbnb) || 0)}</b></span><span><small>Persone</small><b>${Number(parameterSource.people) || entry.people || 1}</b></span><span><small>Tassa soggiorno</small><b>${formatValue(Number(parameterSource.touristTax) || 0)}</b></span></div>
    <div class="simulation-scenario-summary">${scenarioCards}</div>
    <div class="simulation-comparison-charts"><div class="comparison-chart-panel wide"><h4>Tariffe per scenario · confronto parallelo</h4>${renderSimulationRatesReportCharts(reportScenarios)}</div><div class="comparison-chart-panel wide"><h4>Scenari sovrapposti · delta netto OTA vs sito</h4>${renderSimulationScenarioOverlayChart(reportScenarios)}</div><div class="comparison-chart-panel"><h4>Delta netto medio OTA vs sito</h4>${renderSimulationComparisonChart(reportScenarios)}</div><div class="comparison-chart-panel"><h4>Valori medi per scenario</h4>${renderSimulationAmountsChart(reportScenarios)}</div></div>
    <div class="comparison-table-wrap"><table><thead><tr><th>Scenario</th><th>OTA</th><th>Piano</th><th class="num">Markup</th><th class="num">Pubblicare</th><th class="num">Finale cliente</th><th class="num">Netto OTA</th><th class="num">Netto sito</th><th class="num">Delta netto vs sito</th><th class="num">Sito cliente + tassa</th><th class="num">Delta finale vs sito+tassa</th><th class="num">Δ finale vs base</th><th class="num">Δ netto vs base</th></tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}
function renderSimulationHistory() {
  const entries = state.simulationHistory || [];
  const cards = entries.map(entry => {
    const date = new Date(entry.savedAt);
    const prices = (entry.rateSummary || []).slice(0, 4).map(row => `<span><b>${escapeHtml(row.ota)} · ${escapeHtml(row.plan)}</b><small>Pubblicare ${formatValue(row.published)} · Finale ${formatValue(row.final)}</small></span>`).join("");
    const scenarios = simulationScenarios(entry);
    const selection = simulationSelection(entry);
    const availableOtas = simulationAvailableOtas(entry);
    const otaSelection = simulationOtaSelection(entry);
    const scenarioOptions = scenarios.map(scenario => `<label class="simulation-scenario-choice ${scenario.kind === "baseline" ? "baseline" : ""}"><input type="checkbox" data-history-scenario="${scenario.id}" data-history-entry="${entry.id}" ${selection.has(scenario.id) ? "checked" : ""}><span><b>${escapeHtml(scenario.name)}</b><small>${scenario.kind === "baseline" ? "Parametri salvati" : `Grafico · ${escapeHtml(new Date(scenario.savedAt).toLocaleString("it-IT"))}`}</small></span></label>`).join("");
    const otaOptions = availableOtas.map(ota => `<label class="simulation-ota-choice ota-${ota.id}"><input type="checkbox" data-history-ota="${ota.id}" data-history-entry="${entry.id}" ${otaSelection.has(ota.id) ? "checked" : ""}><span>${escapeHtml(ota.label)}</span></label>`).join("");
    const selectedScenarios = scenarios.filter(scenario => selection.has(scenario.id));
    return `<article class="simulation-history-card">
      <div class="simulation-history-main"><div><span class="eyebrow">${escapeHtml(entry.groupLabel || entry.groupId)}</span><h3>${escapeHtml(entry.propertyName || "Simulazione senza nome")}</h3><p>${escapeHtml(entry.comune || "Comune non indicato")} · ${escapeHtml(entry.checkIn || "Data libera")} → ${escapeHtml(entry.checkOut || "Data libera")} · ${Number(entry.nights) || 1} notti</p></div><time>${escapeHtml(date.toLocaleString("it-IT"))}</time></div>
      <div class="simulation-history-prices">${prices || `<span><small>Nessuna tariffa calcolata salvata.</small></span>`}</div>
      <div class="simulation-history-scenarios"><div><h4>Parametri e scenari collegati</h4><span class="badge">${Math.max(0, scenarios.length - 1)} scenari grafico</span></div><div class="simulation-scenario-choices">${scenarioOptions}</div><div class="simulation-history-ota-filter"><strong>OTA incluse nel report</strong><div class="simulation-ota-choices">${otaOptions}</div></div></div>
      <div class="simulation-history-actions"><button class="primary" data-compare-simulation="${entry.id}">Genera report VS (${selection.size} scenari · ${otaSelection.size} OTA)</button><button data-restore-simulation="${entry.id}">Apri simulazione</button><button class="danger" data-delete-simulation="${entry.id}">Elimina</button></div>
      ${simulationHistoryReportOpen[entry.id] ? renderSimulationComparisonReport(entry, selectedScenarios, otaSelection) : ""}
    </article>`;
  }).join("");
  return `${head("Storico simulazioni", "Ogni simulazione conserva i parametri iniziali e tutti gli scenari markup salvati dal Grafico OTA Rates VS2.")}<section class="simulation-history-list">${cards || `<div class="panel empty-state"><h3>Nessuna simulazione salvata</h3><p>Apri Parametri, seleziona una categoria e usa il pulsante Salva simulazione.</p></div>`}</section>`;
}
function selectedSimulationScenarios(entry) {
  const selected = simulationSelection(entry);
  return simulationScenarios(entry).filter(scenario => selected.has(scenario.id));
}
function exportSimulationComparison(entryId) {
  const entry = (state.simulationHistory || []).find(item => item.id === entryId);
  if (!entry) return;
  const scenarios = reportScenariosForSelection(entry, selectedSimulationScenarios(entry), simulationOtaSelection(entry));
  if (!scenarios.length || !scenarios.some(scenario => scenario.rows?.length)) return;
  const rows = [["Simulazione", entry.propertyName || entry.groupLabel, "Comune", entry.comune || "", "Arrivo", entry.checkIn || "", "Partenza", entry.checkOut || "", "Notti", entry.nights || 1, "Persone", entry.people || 1], [], ["Scenario", "OTA", "Piano", "Markup %", "Pubblicare", "Finale cliente", "Provvigione %", "Netto OTA", "Netto sito", "Delta netto EUR", "Delta netto %", "Sito cliente + tassa", "Delta finale EUR", "Delta finale %"]];
  scenarios.forEach(scenario => (scenario.rows || []).forEach(row => rows.push([
    scenario.name, row.ota || row.otaId || "", row.plan || row.planId || "",
    (Number(row.markup) || 0) * 100, Number(row.published) || 0, Number(row.final) || 0,
    (Number(row.commission) || 0) * 100, Number(row.net) || 0, Number(row.reference) || 0,
    Number(row.deltaNet) || 0, (Number(row.deltaNetRatio) || 0) * 100,
    Number(row.customerReference) || 0, Number(row.deltaFinalSite) || 0, (Number(row.deltaFinalSiteRatio) || 0) * 100,
  ])));
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `confronto-scenari-${entry.groupId || "simulazione"}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
function renderLog() { return `${head("Storico operazioni", "Cronologia interna delle modifiche, salvataggi e annullamenti della sessione.")}<section class="panel"><h3>Ultime operazioni</h3><div class="log-list">${state.logs.map(l => `<div class="log-item"><strong>${l.t}</strong><br>${escapeHtml(l.msg)}</div>`).join("")}</div></section>`; }
function table(headers, rows, numeric = []) { return `<div class="table-wrap"><table><thead><tr>${headers.map((h,i)=>`<th class="${numeric.includes(i)?"num":""}">${h}</th>`).join("")}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map((v,i)=>`<td class="${numeric.includes(i)?"num":""}">${typeof v === "string" && (v.includes("data-sheet=") || v.includes("data-date-row=") || v.includes("data-seasonality-select") || v.includes("data-extra-field=") || v.includes("data-extra-money=") || v.includes("data-auto-value")) ? v : escapeHtml(formatValue(v, null, headers[i] || ""))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[ch])); }

function bindInputs(root) {
  root.querySelectorAll("[data-sheet][data-addr]").forEach(el => {
    const commit = () => setCell(el.dataset.sheet, el.dataset.addr, el.value, `${el.dataset.sheet}!${el.dataset.addr}`);
    el.addEventListener("change", () => commit());
    el.addEventListener("blur", commit);
    el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
  });
  root.querySelectorAll("[data-date-row][data-date-side]").forEach(el => {
    const commit = () => setPromoWindow(Number(el.dataset.dateRow), el.dataset.dateSide, el.value);
    el.addEventListener("change", commit);
    el.addEventListener("blur", commit);
  });
}
function applyDateWindowCells(row, side, iso) {
  const cols = side === "from" ? ["K","L","M"] : ["N","O","P"];
  const parts = isoToDateParts(iso);
  const values = [parts.day, parts.month, parts.year];
  cols.forEach((col, i) => { getCell("Basic_NR_markup", `${col}${row}`).v = values[i]; });
}
function setPromoWindow(row, side, value) {
  const before = datePartsToIso(row, side === "from" ? ["K","L","M"] : ["N","O","P"]);
  const after = value || "";
  if (before === after) return;
  undoStack.push({ type: "window", row, side, before, after, label: `${promoName(row)} ${side === "from" ? "dal" : "al"}` });
  applyDateWindowCells(row, side, after);
  redoStack = [];
  dirty = true;
  invalidate();
  log(`Periodo ${side === "from" ? "inizio" : "fine"} ${promoName(row)}: ${before || "vuoto"} -> ${after || "vuoto"}`, policyLogMeta(row, "periodo"));
  render();
  updateSaveState("Modifiche non salvate");
}
function syncCustomCategoryForm(panel) {
  if (!panel) return;
  const page = panel.dataset.customPage;
  const categorySelect = panel.querySelector(`[data-custom-field="categoryMode"]`);
  const newWrap = panel.querySelector("[data-new-category-wrap]");
  const logicSelect = panel.querySelector(`[data-custom-field="logic"]`);
  const help = panel.parentElement?.querySelector("[data-logic-help]");
  const category = categorySelect?.value || "";
  const isNew = category === "__new__";
  if (newWrap) newWrap.hidden = !isNew;
  if (logicSelect) logicSelect.innerHTML = logicOptionsHtml(page, isNew ? null : category);
  if (help) help.innerHTML = logicHelpHtml(page, isNew ? null : category);
}
function addCustomPromo(page, root) {
  const panel = root.querySelector(`[data-custom-page="${page}"]`);
  if (!panel) return;
  const read = field => panel.querySelector(`[data-custom-field="${field}"]`)?.value || "";
  const name = read("name").trim();
  if (!name) { alert("Inserisci il nome della promo/offerta."); return; }
  const categoryMode = read("categoryMode");
  const category = categoryMode === "__new__" ? read("categoryNew").trim() : categoryMode;
  if (!category) { alert("Inserisci il nome della nuova categoria oppure selezionane una esistente."); return; }
  const promo = {
    id: `cp-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ota: page,
    name,
    category,
    active: read("active") || "NO",
    discount: parsePercentInput(read("discount"), 0),
    logic: read("logic") || "ota_cumulative",
    from: read("from"),
    to: read("to"),
    createdAt: new Date().toISOString(),
  };
  state.customPromos = [...(state.customPromos || []), promo];
  undoStack = [];
  redoStack = [];
  dirty = true;
  invalidate();
  log(`Aggiunta promo custom ${titleForPage(page)}: ${promo.name} (${logicPreset(promo.logic, page).label})`, { ota: page, action: "custom aggiunta", promo: promo.name });
  render();
  updateSaveState("Modifiche non salvate");
}
function deleteCustomPromo(id) {
  const promo = (state.customPromos || []).find(p => p.id === id);
  state.customPromos = (state.customPromos || []).filter(p => p.id !== id);
  dirty = true;
  invalidate();
  log(`Eliminata promo custom ${promo?.name || id}`, { ota: promo?.ota, action: "custom eliminata", promo: promo?.name || id });
  render();
  updateSaveState("Modifiche non salvate");
}
function bindPageEvents(root) {
  bindStableTabNavigation(root);
  bindTechnicalGuideEvents(root);
  root.querySelectorAll("[data-open-rates-lab]").forEach(button => button.onclick = () => {
    const groupId = button.dataset.openRatesLab;
    initRatesLab(groupId, !ratesLab || ratesLab.groupId !== groupId);
    navigate("rateslab", true, true);
  });
  root.querySelectorAll("[data-rates-markup]").forEach(input => {
    const syncMarkup = () => {
      if (!ratesLab) return;
      const markup = Math.max(0, (Number(parseMaybeNumber(input.value)) || 0) / 100);
      setRatesLabMarkup(input.dataset.ratesMarkup, markup);
      const plan = STRATEGY_RATE_PLANS.find(item => item.groupId === ratesLab.groupId && ratesLabPlanKey(item) === input.dataset.ratesMarkup);
      if (plan?.ota === "airbnb") {
        root.querySelectorAll(".rates-control-card.ota-airbnb [data-rates-markup]").forEach(field => {
          if (field !== input) field.value = (markup * 100).toFixed(2);
        });
      }
      persistRatesLabDraft();
    };
    input.oninput = syncMarkup;
    input.onchange = () => {
      syncMarkup();
      render();
    };
  });
  root.querySelectorAll("[data-rates-airbnb-mobile]").forEach(button => button.onclick = () => {
    if (!ratesLab) return;
    ratesLab.showAirbnbMobile = ratesLab.showAirbnbMobile === false;
    persistRatesLabDraft();
    render();
  });
  root.querySelectorAll("[data-rates-ota-visible]").forEach(input => input.onchange = () => {
    if (!ratesLab) return;
    ratesLab.visibleOtas ||= {};
    ratesLab.visibleOtas[input.dataset.ratesOtaVisible] = input.checked;
    persistRatesLabDraft();
    render();
  });
  root.querySelectorAll("[data-rates-season]").forEach(input => {
    const commit = () => {
      if (!ratesLab) return;
      ratesLab.seasonality = Math.max(0, (Number(parseMaybeNumber(input.value)) || 0) / 100);
      persistRatesLabDraft();
    };
    input.oninput = commit;
    input.onchange = () => { commit(); render(); };
  });
  root.querySelectorAll("[data-rates-objective]").forEach(input => {
    const commit = () => {
      if (!ratesLab) return;
      ratesLab.objective = Math.max(-.20, Math.min(1, (Number(parseMaybeNumber(input.value)) || 0) / 100));
      persistRatesLabDraft();
    };
    input.oninput = commit;
    input.onchange = () => { commit(); render(); };
  });
  root.querySelectorAll("[data-rates-tolerance]").forEach(input => {
    const commit = () => {
      if (!ratesLab) return;
      ratesLab.tolerance = Math.max(0, Math.min(.30, (Number(parseMaybeNumber(input.value)) || 0) / 100));
      persistRatesLabDraft();
    };
    input.oninput = commit;
    input.onchange = () => { commit(); render(); };
  });
  root.querySelectorAll("[data-rates-scenario-name]").forEach(input => {
    input.oninput = () => {
      if (!ratesLab) return;
      ratesLab.scenarioName = input.value;
      persistRatesLabDraft();
    };
  });
  root.querySelectorAll("[data-rates-optimize]").forEach(button => button.onclick = () => {
    if (!ratesLab) return;
    optimizeRatesLabMarkupsToObjective();
    persistRatesLabDraft();
    render();
    showSaveConfirmation(`Markup calcolati per obiettivo ${formatValue(ratesLab.objective, "0.00%")}`);
  });
  root.querySelectorAll("[data-rates-reset]").forEach(button => button.onclick = () => {
    initRatesLab(ratesLab?.groupId || parameterStrategy || STRATEGY_GROUPS[0].id, true);
    persistRatesLabDraft();
    render();
    showSaveConfirmation("Grafico ripristinato dai parametri");
  });
  root.querySelectorAll("[data-rates-save]").forEach(button => button.onclick = () => {
    if (!ratesLab) return;
    const snapshot = JSON.parse(JSON.stringify({ ...ratesLab, savedAt: new Date().toISOString() }));
    localStorage.setItem(`gestione-channel-rates-lab-${ratesLab.groupId}`, JSON.stringify(snapshot));
    localStorage.setItem(`gestione-channel-rates-lab-draft-${ratesLab.groupId}`, JSON.stringify(snapshot));
    ratesLab = snapshot;
    const linked = saveRatesLabScenarioToHistory();
    button.textContent = "Scenario salvato";
    showSaveConfirmation(linked ? `Salvataggio effettuato: scenario "${linked.scenario.name}" collegato alla simulazione` : "Salvataggio effettuato: scenario grafico salvato");
    setTimeout(() => { if (button.isConnected) button.textContent = "Salva scenario"; }, 1600);
  });
  root.querySelectorAll("[data-rates-apply]").forEach(button => button.onclick = () => {
    const changed = applyRatesLabToParameters();
    persistRatesLabDraft();
    button.textContent = changed ? "Applicato ai parametri" : "Parametri gia allineati";
    showSaveConfirmation(changed ? "Markup applicati e salvati nei parametri" : "Parametri gia allineati");
    setTimeout(() => {
      if (button.isConnected) button.textContent = "Applica ai parametri";
    }, 1800);
  });
  root.querySelectorAll("[data-rates-load]").forEach(button => button.onclick = () => {
    const groupId = ratesLab?.groupId || parameterStrategy || STRATEGY_GROUPS[0].id;
    try {
      const saved = JSON.parse(localStorage.getItem(`gestione-channel-rates-lab-${groupId}`) || "null");
      if (!saved) { button.textContent = "Nessuno scenario"; setTimeout(() => { if (button.isConnected) button.textContent = "Carica salvato"; }, 1600); return; }
      ratesLab = loadSavedRatesLab(groupId);
      render();
    } catch (_) {
      button.textContent = "Scenario non valido";
    }
  });
  root.querySelectorAll("[data-rates-export]").forEach(button => button.onclick = () => {
    const rows = ratesLabRows();
    const csv = [
      ["OTA", "Piano tariffario", "Markup stagionalita", "Markup piano", "Prezzo da pubblicare", "Prezzo finale cliente", "Provvigione", "Netto OTA", "NR sito diretto finale", "Delta netto euro", "Delta netto percentuale"],
      ...rows.map(row => [row.ota.label, row.plan.name, ratesLab.seasonality * 100, row.markup * 100, row.pubblicare, row.finale, row.commission * 100, row.netto, row.reference, row.netto - row.reference, row.nettoRatio * 100])
    ].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `grafico-ota-rates-vs2-${ratesLab?.groupId || "scenario"}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  root.querySelectorAll("[data-rates-print]").forEach(button => button.onclick = () => window.print());
  root.querySelectorAll("[data-tax-filter]").forEach(control => {
    const apply = () => { touristTaxFilters[control.dataset.taxFilter] = control.value; touristTaxPage = 1; render(); };
    if (control.dataset.taxFilter === "search") {
      control.oninput = () => {
        touristTaxFilters.search = control.value;
        touristTaxPage = 1;
        clearTimeout(touristTaxSearchTimer);
        touristTaxSearchTimer = setTimeout(() => {
          render();
          const next = document.querySelector('[data-tax-filter="search"]');
          if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
        }, 250);
      };
    } else control.onchange = apply;
  });
  root.querySelectorAll("[data-tax-initial]").forEach(button => button.onclick = () => { touristTaxFilters.initial = button.dataset.taxInitial || ""; touristTaxPage = 1; render(); });
  root.querySelectorAll("[data-tax-page]").forEach(button => button.onclick = () => { const next = Number(button.dataset.taxPage); if (next > 0) { touristTaxPage = next; render(); } });
  root.querySelectorAll("[data-tax-edit]").forEach(button => button.onclick = () => { touristTaxEditingIndex = Number(button.dataset.taxEdit); render(); requestAnimationFrame(() => document.querySelector(".tourist-tax-editor")?.scrollIntoView({ behavior: "smooth", block: "start" })); });
  root.querySelectorAll("[data-tax-edit-cancel]").forEach(button => button.onclick = () => { touristTaxEditingIndex = null; render(); });
  root.querySelectorAll("[data-tax-reset-filters]").forEach(button => button.onclick = () => { touristTaxFilters = { search: "", initial: "", comune: "", provincia: "", immobile: "", ota: "", month: "", status: "", sort: "date-desc" }; touristTaxPage = 1; render(); });
  root.querySelectorAll("[data-tax-edit-save]").forEach(button => button.onclick = () => saveTouristTaxEdit(Number(button.dataset.taxEditSave), root));
  root.querySelectorAll("[data-tax-edit-restore]").forEach(button => button.onclick = () => restoreTouristTaxRow(Number(button.dataset.taxEditRestore)));
  root.querySelectorAll("[data-tax-rule-save]").forEach(button => button.onclick = () => saveTouristTaxRule(button.dataset.taxRuleSave, button.closest("[data-tax-rule-row]")));
  root.querySelectorAll("[data-input-details]").forEach(details => {
    details.addEventListener("toggle", () => {
      inputDetailsOpen[details.dataset.inputDetails] = details.open;
    });
  });
  root.querySelectorAll("[data-category-ota-details]").forEach(details => {
    details.addEventListener("toggle", () => {
      categoryOtaOpen[details.dataset.categoryOtaDetails] = details.open;
      if (details.open && details.dataset.categoryOtaLoaded !== "1") {
        clearPageDomCache(currentPage);
        render(true);
      }
    });
  });
  root.querySelectorAll("[data-forecast-mode]").forEach(b => b.onclick = () => {
    state.forecast.mode = b.dataset.forecastMode === "multi" ? "multi" : "mono";
    dirty = true;
    render();
    updateSaveState("Modifiche non salvate");
  });
  root.querySelectorAll("[data-forecast-field]").forEach(el => {
    const commit = (nextFocus = null) => {
      const cfg = forecastConfig();
      const field = el.dataset.forecastField;
      const numeric = Number(parseMaybeNumber(el.value)) || 0;
      if (field === "revenue") cfg.revenues[Number(el.dataset.forecastMonth)] = Math.max(0, numeric);
      else if (field === "nights") cfg.nights[Number(el.dataset.forecastMonth)] = Math.max(0, numeric);
      else if (["opening", "closing"].includes(field)) cfg[field] = el.value;
      else if (field === "curveWeight") cfg[field] = Math.max(0, Math.min(1, numeric / 100));
      else if (field === "curveLevel") cfg[field] = Math.max(1, Math.min(9, Math.round(numeric)));
      else cfg[field] = Math.max(0, numeric);
      cfg.scenario = "Personalizzato";
      dirty = true;
      render();
      updateSaveState("Modifiche non salvate");
      if (nextFocus) requestAnimationFrame(() => {
        const next = root.querySelector(`[data-forecast-field="${nextFocus.field}"][data-forecast-month="${nextFocus.month}"]`);
        next?.focus();
        next?.select();
      });
    };
    el.addEventListener("change", commit);
    el.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); commit(); return; }
      if (e.key !== "Tab" || el.dataset.forecastMonth === undefined) return;
      e.preventDefault();
      const monthly = [...root.querySelectorAll(".forecast-monthly [data-forecast-field][data-forecast-month]")];
      const current = monthly.indexOf(el);
      const offset = e.shiftKey ? -1 : 1;
      const target = monthly[(current + offset + monthly.length) % monthly.length];
      commit({ field: target.dataset.forecastField, month: target.dataset.forecastMonth });
    });
  });
  root.querySelectorAll("[data-forecast-scenario]").forEach(b => b.onclick = () => {
    const cfg = forecastConfig();
    cfg.scenario = b.dataset.forecastScenario;
    cfg.curveWeight = Number(b.dataset.forecastWeight) || 0;
    cfg.curveLevel = Number(b.dataset.forecastLevel) || 1;
    dirty = true;
    render();
    updateSaveState("Modifiche non salvate");
  });
  root.querySelectorAll("[data-forecast-unit-field]").forEach(el => el.onchange = () => {
    const cfg = forecastConfig();
    const row = cfg.unitTypes[Number(el.dataset.forecastUnitIndex)];
    if (!row) return;
    const field = el.dataset.forecastUnitField;
    row[field] = field === "name" ? el.value : Math.max(0, Number(parseMaybeNumber(el.value)) || 0);
    dirty = true;
    render();
    updateSaveState("Modifiche non salvate");
  });
  root.querySelectorAll("[data-forecast-unit-add]").forEach(b => b.onclick = () => {
    forecastConfig().unitTypes.push({ name: `Tipologia ${forecastConfig().unitTypes.length + 1}`, units: 1, multiplier: 1 });
    dirty = true;
    render();
    updateSaveState("Modifiche non salvate");
  });
  root.querySelectorAll("[data-forecast-unit-delete]").forEach(b => b.onclick = () => {
    const cfg = forecastConfig();
    if (cfg.unitTypes.length > 1) cfg.unitTypes.splice(Number(b.dataset.forecastUnitDelete), 1);
    dirty = true;
    render();
    updateSaveState("Modifiche non salvate");
  });
  root.querySelectorAll("[data-sheet-tab]").forEach(b => b.onclick = () => { currentSheet = b.dataset.sheetTab; render(true); });
  root.querySelectorAll("[data-page-target]").forEach(b => b.onclick = () => navigate(b.dataset.pageTarget));
  root.querySelectorAll("[data-toggle-ota-history]").forEach(b => b.onclick = () => { otaHistoryOpen[b.dataset.toggleOtaHistory] = !otaHistoryOpen[b.dataset.toggleOtaHistory]; render(); });
  root.querySelectorAll("[data-seasonality-select]").forEach(sel => sel.onchange = () => setSeasonality(sel.value));
  root.querySelectorAll("[data-category-select]").forEach(sel => sel.onchange = () => syncCustomCategoryForm(sel.closest("[data-custom-page]")));
  root.querySelectorAll("[data-add-custom]").forEach(b => b.onclick = () => addCustomPromo(b.dataset.addCustom, root));
  root.querySelectorAll("[data-delete-custom]").forEach(b => b.onclick = () => deleteCustomPromo(b.dataset.deleteCustom));
  root.querySelectorAll("[data-strategy-open]").forEach(b => b.onclick = () => { strategyPage = b.dataset.strategyOpen; render(true); });
  root.querySelectorAll("[data-strategy-back]").forEach(b => b.onclick = () => { strategyPage = ""; render(true); });
  root.querySelectorAll("[data-percent-preset]").forEach(sel => sel.onchange = () => {
    if (!sel.value) return;
    const wrap = sel.closest(".percent-combo-wrap");
    const input = wrap?.querySelector("input.percent-combo");
    if (!input) return;
    input.value = input.dataset.percentMode === "coefficient" ? coefficientInputValue(sel.value) : percentInputValue(sel.value);
    input.dispatchEvent(new Event("change", { bubbles: true }));
    sel.value = "";
  });
  root.querySelectorAll("[data-condition-amount-preset]").forEach(sel => sel.onchange = () => {
    if (!sel.value) return;
    const wrap = sel.closest(".condition-amount-wrap");
    const input = wrap?.querySelector("input[data-condition-field='amount']");
    if (!input) return;
    input.value = Number(sel.value).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    sel.value = "";
  });
  root.querySelectorAll("[data-condition-field]").forEach(el => {
    const commit = () => setConditionField(el.dataset.conditionGroup, el.dataset.conditionId, el.dataset.conditionField, el.value, el.dataset.conditionOta || "");
    el.addEventListener("change", commit);
    el.addEventListener("blur", commit);
    el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
  });
  root.querySelectorAll("[data-strategy-field]").forEach(el => {
    const commit = () => setStrategyField(el.dataset.strategyGroup, el.dataset.strategyRow, el.dataset.strategyField, el.value, el.dataset.strategyOta || "");
    el.addEventListener("change", commit);
    el.addEventListener("blur", commit);
    el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
    if (el.classList.contains("percent-combo")) {
      let timer = null;
      el.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(commit, 450);
      });
    }
  });
  root.querySelectorAll("[data-rate-plan-field]").forEach(el => {
    const commit = () => {
      const value = el.hasAttribute("data-rate-plan-flag") ? (el.checked ? el.dataset.ratePlanFlagValue : "0") : el.value;
      setRatePlanField(el.dataset.ratePlanGroup, el.dataset.ratePlanId, el.dataset.ratePlanField, value);
    };
    el.addEventListener("change", commit);
    el.addEventListener("blur", commit);
    el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
    if (el.classList.contains("percent-combo")) {
      let timer = null;
      el.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(commit, 450);
      });
    }
  });
  root.querySelectorAll("[data-extra-field]").forEach(el => {
    const commit = () => setExtraPercentField(el.dataset.extraField, el.value);
    el.addEventListener("change", commit);
    el.addEventListener("blur", commit);
    el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
    let timer = null;
    el.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(commit, 450);
    });
  });
  root.querySelectorAll("[data-extra-money]").forEach(el => {
    const commit = () => setExtraMoneyField(el.dataset.extraMoney, el.value);
    el.addEventListener("change", commit);
    el.addEventListener("blur", commit);
    el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
  });
  root.querySelectorAll("[data-param-category]").forEach(b => b.onclick = () => {
    parameterStrategy = b.dataset.paramCategory || "";
    if (parameterStrategy) syncNetCanoneFromCategoryCosts(parameterStrategy, true);
    render(true);
  });
  root.querySelectorAll("[data-dashboard-category]").forEach(b => b.onclick = () => { dashboardStrategy = b.dataset.dashboardCategory || ""; render(true); });
  root.querySelectorAll("[data-param-category-nav]").forEach(b => b.onclick = () => {
    parameterStrategy = b.dataset.paramCategoryNav || "";
    if (parameterStrategy) syncNetCanoneFromCategoryCosts(parameterStrategy, true);
    navigate("inputs", true, false);
  });
  root.querySelectorAll("[data-open-category-conditions]").forEach(b => b.onclick = () => {
    strategyPage = b.dataset.openCategoryConditions;
    strategySectionOpen[`${strategyPage}:conditions`] = true;
    navigate("strategies", true, true);
    requestAnimationFrame(() => document.getElementById("strategy-conditions")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  });
  root.querySelectorAll("[data-strategy-section]").forEach(section => section.addEventListener("toggle", () => {
    strategySectionOpen[section.dataset.strategySection] = section.open;
  }));
  root.querySelectorAll("[data-manual-condition-total]").forEach(input => {
    const commit = () => setManualConditionTotal(input.dataset.manualConditionTotal, input.value);
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
  });
  root.querySelectorAll("[data-manual-ota-cost-total]").forEach(input => {
    const commit = () => setManualOtaCostTotal(input.dataset.manualOtaCostTotal, input.dataset.manualOtaId || "booking", input.value);
    input.addEventListener("change", commit);
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
  });
  root.querySelectorAll("[data-strategy-sim]").forEach(el => el.onchange = () => setStrategySimulation(el.dataset.strategySim, el.value));
  root.querySelectorAll("[data-simulation-context]").forEach(el => {
    const commit = () => setSimulationContext(el.dataset.simulationGroup, el.dataset.simulationContext, el.value);
    el.addEventListener("change", commit);
    el.addEventListener("blur", commit);
    el.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); commit(); } });
  });
  root.querySelectorAll("[data-save-simulation]").forEach(button => button.onclick = () => saveCurrentSimulation(button.dataset.saveSimulation));
  root.querySelectorAll("[data-restore-simulation]").forEach(button => button.onclick = () => restoreSavedSimulation(button.dataset.restoreSimulation));
  root.querySelectorAll("[data-history-scenario]").forEach(input => input.onchange = () => {
    const entryId = input.dataset.historyEntry;
    const entry = (state.simulationHistory || []).find(item => item.id === entryId);
    if (!entry) return;
    const selection = simulationSelection(entry);
    if (input.checked) selection.add(input.dataset.historyScenario);
    else selection.delete(input.dataset.historyScenario);
    render();
  });
  root.querySelectorAll("[data-history-ota]").forEach(input => input.onchange = () => {
    const entry = (state.simulationHistory || []).find(item => item.id === input.dataset.historyEntry);
    if (!entry) return;
    const selection = simulationOtaSelection(entry);
    if (input.checked) selection.add(input.dataset.historyOta);
    else selection.delete(input.dataset.historyOta);
    render();
  });
  root.querySelectorAll("[data-compare-simulation]").forEach(button => button.onclick = () => {
    const entry = (state.simulationHistory || []).find(item => item.id === button.dataset.compareSimulation);
    if (!entry || !simulationSelection(entry).size) {
      showSaveConfirmation("Seleziona almeno uno scenario");
      return;
    }
    if (!simulationOtaSelection(entry).size) {
      showSaveConfirmation("Seleziona almeno una OTA");
      return;
    }
    simulationHistoryReportOpen[entry.id] = true;
    render();
    requestAnimationFrame(() => document.querySelector(`[data-comparison-report="${entry.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  });
  root.querySelectorAll("[data-close-comparison]").forEach(button => button.onclick = () => {
    simulationHistoryReportOpen[button.dataset.closeComparison] = false;
    render();
  });
  root.querySelectorAll("[data-export-comparison]").forEach(button => button.onclick = () => exportSimulationComparison(button.dataset.exportComparison));
  root.querySelectorAll("[data-print-comparison]").forEach(button => button.onclick = () => {
    const report = button.closest("[data-comparison-report]");
    if (!report) return;
    report.classList.add("comparison-print-target");
    document.body.classList.add("print-simulation-comparison");
    const cleanup = () => {
      report.classList.remove("comparison-print-target");
      document.body.classList.remove("print-simulation-comparison");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 1500);
  });
  root.querySelectorAll("[data-delete-simulation]").forEach(button => button.onclick = () => {
    if (confirm("Eliminare definitivamente questa simulazione salvata?")) deleteSavedSimulation(button.dataset.deleteSimulation);
  });
  root.querySelectorAll("[data-peak-season]").forEach(el => el.onchange = () => setPeakSeasonDate(el.dataset.peakGroup, el.dataset.peakSeason, el.value));
  root.querySelectorAll("[data-season-base-weight]").forEach(el => el.onchange = () => setSeasonalityBaseWeight(el.dataset.seasonBaseGroup, el.dataset.seasonBaseWeight, el.value));
  root.querySelectorAll("[data-season-weekend-markup]").forEach(el => el.onchange = () => setSeasonalityWeekendMarkup(el.dataset.seasonWeekendGroup, el.value));
  root.querySelectorAll("[data-strategy-reset-dates]").forEach(b => b.onclick = () => resetStrategySimulationDates());
  root.querySelectorAll("[data-calculator-close]").forEach(b => b.onclick = () => { calculatorOpen = false; render(); });
  root.querySelectorAll("[data-calc-action]").forEach(b => {
    b.onpointerdown = () => {
      const input = root.querySelector("[data-calculator-expression]");
      if (!input || document.activeElement !== input) return;
      calculatorCursorPosition = input.selectionStart ?? input.value.length;
      calculatorSelectionEnd = input.selectionEnd ?? calculatorCursorPosition;
    };
    b.onclick = () => handleCalculatorAction(b.dataset.calcAction, b.dataset.calcValue || "");
  });
  root.querySelectorAll("[data-calculator-expression]").forEach(input => {
    const captureSelection = () => {
      calculatorCursorPosition = input.selectionStart ?? input.value.length;
      calculatorSelectionEnd = input.selectionEnd ?? calculatorCursorPosition;
    };
    input.oninput = () => {
      calculatorExpression = input.value;
      calculatorJustEvaluated = false;
      captureSelection();
    };
    input.onselect = captureSelection;
    input.onclick = captureSelection;
    input.onkeyup = captureSelection;
    input.onkeydown = e => {
      if (e.key === "Enter") {
        e.preventDefault();
        captureSelection();
        updateCalculatorExpression(input.value, true);
      }
    };
    input.onblur = () => { calculatorExpression = input.value; captureSelection(); };
  });
  bindCalculatorDrag(root);
  const search = root.querySelector("#sheetSearch");
  if (search) search.oninput = () => { sheetSearch = search.value; render(); };
  if (currentPage === "roomnight") bindRoomNightNative(root, render);
}
function bindCalculatorDrag(root) {
  const popup = root.querySelector("[data-calculator-popup]");
  const handle = root.querySelector("[data-calculator-drag]");
  if (!popup || !handle) return;
  let startX = 0, startY = 0, originX = 0, originY = 0, dragging = false;
  handle.onpointerdown = e => {
    if (e.target.closest("button")) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    originX = calculatorPosition.x;
    originY = calculatorPosition.y;
    handle.setPointerCapture(e.pointerId);
  };
  handle.onpointermove = e => {
    if (!dragging) return;
    calculatorPosition = {
      x: Math.max(12, Math.min(originX + e.clientX - startX, window.innerWidth - 360)),
      y: Math.max(12, Math.min(originY + e.clientY - startY, window.innerHeight - 120)),
    };
    popup.style.left = `${calculatorPosition.x}px`;
    popup.style.top = `${calculatorPosition.y}px`;
  };
  handle.onpointerup = e => {
    dragging = false;
    try { handle.releasePointerCapture(e.pointerId); } catch {}
  };
}
function setStrategySimulation(field, value) {
  if (!state.strategySimulation) state.strategySimulation = { checkIn: "", checkOut: "", nights: 1 };
  if (field === "checkIn") state.strategySimulation.checkIn = value || "";
  if (field === "checkOut") state.strategySimulation.checkOut = value || "";
  const nights = simulatedNights();
  state.strategySimulation.nights = nights || 1;
  dirty = true;
  invalidate();
  syncRatesLabSeasonalityFromParameters(parameterStrategy);
  log(`Simulazione categoria aggiornata: ${field}`);
  render();
  updateSaveState("Modifiche non salvate");
}
function setSimulationContext(groupId, field, value) {
  if (!groupId || !["propertyName", "comune", "people"].includes(field)) return;
  const context = simulationContext(groupId);
  const next = field === "people" ? Math.max(1, Math.round(Number(value) || 1)) : String(value || "").trim();
  if (context[field] === next) return;
  context[field] = next;
  dirty = true;
  log(`Simulazione ${groupId}: aggiornato ${field === "propertyName" ? "nome struttura" : field === "comune" ? "Comune" : "numero persone"}`);
  if (field !== "propertyName") render();
  updateSaveState("Modifiche non salvate");
}
function resetStrategySimulationDates() {
  if (!state.strategySimulation) state.strategySimulation = { checkIn: "", checkOut: "", nights: 1 };
  state.strategySimulation.checkIn = "";
  state.strategySimulation.checkOut = "";
  state.strategySimulation.nights = 1;
  dirty = true;
  invalidate();
  log("Simulazione categoria: date azzerate");
  render();
  updateSaveState("Modifiche non salvate");
}
function setPeakSeasonDate(groupId, edge, value) {
  if (!state.strategies?.[groupId] || !["start", "end"].includes(edge)) return;
  const next = /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? value : "";
  const key = edge === "start" ? "peakSeasonStart" : "peakSeasonEnd";
  if (state.strategies[groupId][key] === next) return;
  state.strategies[groupId][key] = next;
  dirty = true;
  invalidate();
  syncRatesLabSeasonalityFromParameters(groupId);
  log(`Periodo Altissima ${groupId}: ${edge === "start" ? "dal" : "al"} ${next || "non impostato"}`, { action: "periodo altissima", gruppo: groupId });
  render();
  updateSaveState("Modifiche non salvate");
}
function setSeasonalityBaseWeight(groupId, ruleId, value) {
  const cfg = state.strategies?.[groupId];
  if (!cfg || !SEASONALITY_RULES.some(rule => rule.id === ruleId)) return;
  const parsed = Math.max(0.01, Math.min(2, (Number(String(value).replace(",", ".")) || 100) / 100));
  if (!cfg.seasonalityBaseWeights) cfg.seasonalityBaseWeights = defaultCategorySeasonalityBaseWeights(groupId);
  if (Math.abs((Number(cfg.seasonalityBaseWeights[ruleId]) || 0) - parsed) < 0.000001) return;
  cfg.seasonalityBaseWeights[ruleId] = parsed;
  dirty = true;
  invalidate();
  syncRatesLabSeasonalityFromParameters(groupId);
  render();
  updateSaveState("Modifiche non salvate");
}
function setSeasonalityWeekendMarkup(groupId, value) {
  const cfg = state.strategies?.[groupId];
  if (!cfg) return;
  const parsed = Math.max(0, Math.min(2, (Number(String(value).replace(",", ".")) || 0) / 100));
  if (Math.abs((Number(cfg.weekendBaseMarkup) || 0) - parsed) < 0.000001) return;
  cfg.weekendBaseMarkup = parsed;
  dirty = true;
  invalidate();
  syncRatesLabSeasonalityFromParameters(groupId);
  render();
  updateSaveState("Modifiche non salvate");
}
function setRatePlanField(groupId, planId, field, value) {
  const plan = STRATEGY_RATE_PLANS.find(p => p.groupId === groupId && p.id === planId);
  if (!plan) return;
  const cfg = strategyRatePlanConfig(groupId, planId);
  let changed = false;
  if (field === "active") {
    const next = value === "SI" ? "SI" : "NO";
    changed = cfg.active !== next;
    cfg.active = next;
  }
  if (["baseMarkup", "genius1", "genius2", "preferred"].includes(field)) {
    const next = parsePercentInput(value, 0);
    changed = Math.abs((Number(cfg[field]) || 0) - next) > 0.000001;
    cfg[field] = next;
    if (next > 0 && field === "genius1") cfg.genius2 = 0;
    if (next > 0 && field === "genius2") cfg.genius1 = 0;
  }
  if (!changed) return;
  syncRatesLabPlanFromParameters(groupId, planId);
  dirty = true;
  log(`Piano tariffario ${plan.name}: ${cfg.active}`, { action: "piano tariffario", gruppo: groupId, piano: plan.name });
  render();
  updateSaveState("Modifiche non salvate");
}
function setExtraPercentField(field, value) {
  if (field === "postPlMarkup") {
    const pricingCfg = pricingInputsConfig();
    const nextMarkup = parsePercentInput(value, 0);
    if (Math.abs((Number(pricingCfg.postPlMarkup) || 0) - nextMarkup) <= 0.000001) return;
    pricingCfg.postPlMarkup = Math.max(0, Math.min(.95, nextMarkup));
    dirty = true;
    invalidate();
    log(`Markup aggiuntivo dopo PL aggiornato: ${formatValue(pricingCfg.postPlMarkup, "0.00%")}`, { action: "markup post PL" });
    render();
    updateSaveState("Modifiche non salvate");
    return;
  }
  const cfg = bookingPreferredConfig();
  const map = {
    bookingPreferredTarget: "target",
    bookingPreferredCommissionBase: "commissionBase",
    bookingPreferredCommissionVat: "commissionVat",
  };
  const key = map[field];
  if (!key) return;
  const next = parsePercentInput(value, 0);
  if (Math.abs((Number(cfg[key]) || 0) - next) <= 0.000001) return;
  cfg[key] = next;
  dirty = true;
  invalidate();
  log(`Booking Preferiti aggiornato: ${field} ${formatValue(next, "0.00%")}`, { action: "booking preferiti" });
  render();
  updateSaveState("Modifiche non salvate");
}
function setExtraMoneyField(field, value) {
  if (!["netCanone", "plExtra", "nrPublished"].includes(field)) return;
  const cfg = pricingInputsConfig();
  const next = parseAmountInput(value, 0);
  if (Math.abs((Number(cfg[field]) || 0) - next) <= 0.000001) return;
  cfg[field] = next;
  if (field === "nrPublished" && parameterStrategy) syncNetCanoneFromCategoryCosts(parameterStrategy);
  dirty = true;
  invalidate();
  const label = field === "plExtra" ? "PL extra" : field === "nrPublished" ? "NR pubblicato sito diretto" : "Canone netto sito diretto";
  log(`${label} aggiornato: ${formatValue(next)}`, { action: field === "plExtra" ? "pl extra" : field === "nrPublished" ? "nr pubblicato" : "canone netto" });
  render();
  updateSaveState("Modifiche non salvate");
}
function setManualConditionTotal(groupId, value) {
  if (!state.strategies?.[groupId]) return;
  const raw = String(value ?? "").trim();
  const next = raw === "" ? null : Math.max(0, parseAmountInput(raw, 0));
  const current = manualConditionTotalValue(groupId);
  if ((current === null && next === null) || (current !== null && next !== null && Math.abs(current - next) <= 0.000001)) return;
  state.strategies[groupId].manualConditionTotal = next;
  syncNetCanoneFromCategoryCosts(groupId);
  dirty = true;
  log(`Totale costi manuale ${groupId}: ${next === null ? "mappatura attiva" : formatValue(next)}`, { action: "totale costi manuale", gruppo: groupId });
  render();
  updateSaveState("Modifiche non salvate");
}
function setManualOtaCostTotal(groupId, otaId, value) {
  if (!state.strategies?.[groupId]) return;
  const raw = String(value ?? "").trim();
  const next = raw === "" ? null : Math.max(0, parseAmountInput(raw, 0));
  const current = manualOtaCostTotalValue(groupId, otaId);
  if ((current === null && next === null) || (current !== null && next !== null && Math.abs(current - next) <= 0.000001)) return;
  if (!state.strategies[groupId].manualOtaCostTotals) state.strategies[groupId].manualOtaCostTotals = { booking: null, expedia: null, airbnb: null, vrbo: null };
  state.strategies[groupId].manualOtaCostTotals[otaId] = next;
  if (otaId === "booking") state.strategies[groupId].manualOtaCostTotal = next;
  dirty = true;
  log(`Totale costi ${otaId} ${groupId}: ${next === null ? "non impostato" : formatValue(next)}`, { action: "totale costi OTA", ota: otaId, gruppo: groupId });
  render();
  updateSaveState("Modifiche non salvate");
}
function setSeasonality(value) {
  const next = SEASONALITY_RULES.some(r => r.id === value) ? value : SEASONALITY_RULES[0].id;
  if (state.seasonality === next) return;
  const before = currentSeasonalityRule().label;
  state.seasonality = next;
  dirty = true;
  invalidate();
  syncRatesLabSeasonalityFromParameters(parameterStrategy);
  log(`Regola stagionalita: ${before} -> ${currentSeasonalityRule().label}`);
  render();
  updateSaveState("Modifiche non salvate");
}

document.getElementById("pageBack").onclick = () => { if (pageIndex > 0) { pageIndex--; navigate(pageHistory[pageIndex], false); } };
document.getElementById("pageForward").onclick = () => { if (pageIndex < pageHistory.length - 1) { pageIndex++; navigate(pageHistory[pageIndex], false); } };
document.getElementById("undoBtn").onclick = () => { const ch = undoStack.pop(); if (ch) { redoStack.push(ch); applyChange(ch, "undo"); } };
document.getElementById("redoBtn").onclick = () => { const ch = redoStack.pop(); if (ch) { undoStack.push(ch); applyChange(ch, "redo"); } };
document.getElementById("saveBtn").onclick = () => { saveState(); log("Stato salvato nel browser"); render(); showSaveConfirmation("Salvataggio effettuato: modifiche salvate"); };
document.getElementById("resetBtn").onclick = () => { if (!confirm("Ripristinare i dati originali del file Excel?")) return; localStorage.removeItem(STORE_KEY); state = makeInitialState(); undoStack = []; redoStack = []; dirty = false; invalidate(); log("Ripristinati i valori originali del workbook"); render(); updateSaveState("Ripristinato"); };
document.getElementById("exportBtn").onclick = () => { const blob = new Blob([JSON.stringify(serializeEditableState(), null, 2)], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `gestione-channel-stato-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href); log("Stato esportato in JSON"); render(); };
document.getElementById("importFile").onchange = async e => { const file = e.target.files[0]; if (!file) return; const data = JSON.parse(await file.text()); localStorage.setItem(STORE_KEY, JSON.stringify(data)); state = makeInitialState(); undoStack = []; redoStack = []; dirty = false; invalidate(); log(`Importato stato da ${file.name}`); render(); updateSaveState("Importato"); e.target.value = ""; };

render();
updateSaveState();








