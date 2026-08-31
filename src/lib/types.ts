// Core domain types for Phase 1: Recipe Book, Stock & Production Log,
// Checklists, Production Planner, Notice Board.

export type Role = "owner" | "manager" | "chef" | "bartender";

export type Bi = { en: string; vi: string };

// ---------- Recipe Book ----------

export type RecipeCategory = "starter" | "main" | "side" | "dessert" | "cocktail" | "roast_sunday" | "beverage";

export type Ingredient = {
  id: string;
  name: Bi;
  /** quantity for the recipe's base portion count */
  qty: number;
  unit: string;
};

export type MethodStep = {
  id: string;
  text: Bi;
};

export type Recipe = {
  id: string;
  name: Bi;
  category: RecipeCategory;
  basePortions: number;
  ingredients: Ingredient[];
  steps: MethodStep[];
  costPerPortionVnd?: number;
  notes?: Bi;
  updatedAt: string;
};

export type RecipeFlag = {
  id: string;
  recipeId: string;
  raisedBy: string;
  role: Role;
  note: string;
  createdAt: string;
  resolved: boolean;
};

// ---------- Stock & Production Log ----------

export type StockSection = "kitchen" | "bar";

export type PrepCategory = "main" | "side" | "dessert";

export type StockItem = {
  id: string;
  name: Bi;
  section: StockSection;
  unit: string;
  /** par level only meaningful for bar items, but kept generic */
  par?: number;
  costPerUnitVnd?: number;
  /** grouping for the Kitchen Prep & Production view */
  prepCategory?: PrepCategory;
  /** links a kitchen prep item to its Recipe Book entry so ingredient needs can be scaled from planned portions. */
  recipeId?: string;
};

export type StockDayEntry = {
  id: string;
  itemId: string;
  /** ISO date, e.g. 2026-08-18 */
  date: string;
  opening: number;
  /** true when yesterday's closing count was never recorded, so `opening` is an assumption rather than a real count. */
  openingUncounted?: boolean;
  produced: number;
  closing: number | null;
  enteredBy: string;
  updatedAt: string;
};

/**
 * Explicit "this got thrown away" record — distinct from the leftover-streak
 * flag (which infers overproduction from unused Closing stock). Captures
 * the qty, why, and cost in VND so waste is visible in money, not just
 * portions, per the spec's "cost tracker to show waste in VND" requirement.
 */
export type WasteReason = "spoiled" | "over_prepped" | "prep_error" | "other";

export type WasteLogEntry = {
  id: string;
  itemId: string;
  date: string;
  qty: number;
  reason: WasteReason;
  note?: string;
  /** null when the item has no cost data on file yet — never guessed. */
  costVnd: number | null;
  loggedBy: string;
  loggedAt: string;
};

// ---------- Checklists ----------

export type ChecklistArea = "foh" | "kitchen";
export type ChecklistShift = "opening" | "closing";

export type ChecklistItem = {
  id: string;
  area: ChecklistArea;
  shift: ChecklistShift;
  text: Bi;
  order: number;
  active: boolean;
  /** deep-links this item into a Food Safety log (e.g. Kitchen Opening "check fridge temps" → the Temperature log) instead of being just a standalone checkbox. */
  linkHref?: string;
};

export type ChecklistTick = {
  id: string;
  itemId: string;
  date: string;
  checked: boolean;
  checkedBy: string;
  checkedAt: string | null;
};

// ---------- Production Planner ----------

export type PlannerDecision = {
  id: string;
  itemId: string;
  date: string;
  suggestedQty: number;
  confirmedQty: number | null;
  confirmedBy: string | null;
  confirmedAt: string | null;
};

// ---------- Notice Board ----------

export type NoticePriority = "normal" | "urgent";

export type Notice = {
  id: string;
  title: Bi;
  body: Bi;
  postedBy: string;
  role: Role;
  priority: NoticePriority;
  createdAt: string;
};

export type NoticeAck = {
  noticeId: string;
  staffName: string;
  ackedAt: string;
};

// ---------- Food Safety Compliance Suite ----------
// Tamper-evident: entries are never edited in place. A correction creates a
// new row with `correctionOfId` pointing at the row it supersedes — the
// original stays in storage so nothing is silently overwritten.

export type FoodSafetyLogType =
  | "temperature"
  | "cooking"
  | "deliveries"
  | "cleaning"
  | "inspections"
  | "samples"
  | "pest"
  | "complaints";

export type FridgeUnit = {
  id: string;
  name: Bi;
  kind: "fridge" | "freezer";
  targetMinC: number;
  targetMaxC: number;
  active: boolean;
};

export type TempReading = {
  id: string;
  unitId: string;
  date: string;
  timeSlot: "am" | "pm";
  tempC: number;
  inRange: boolean;
  correctiveAction?: string;
  loggedBy: string;
  loggedAt: string;
  correctionOfId?: string;
};

export type CookTempLog = {
  id: string;
  dish: string;
  batchLabel: string;
  probeTempC: number;
  /** target: >=75C for 30 sec */
  targetMet: boolean;
  /** required in the UI when probeTempC < 75 */
  correctiveAction?: string;
  loggedBy: string;
  loggedAt: string;
  correctionOfId?: string;
};

export type DeliveryLogItem = {
  supplyItemId?: string;
  name: string;
  qty: number;
  unit: string;
};

/**
 * A photo attached to a legal record.
 *
 * The small preview lives in the record itself, so it syncs to every device
 * and is visible offline. The full-resolution image goes to Supabase Storage
 * — a phone camera shot is 150-400KB as base64, and keeping months of them
 * inline would exhaust the browser's storage quota and make every sync
 * re-download them.
 *
 * Full bytes stay on the device that took the photo until `path` is set,
 * i.e. until the upload is confirmed. Evidence is never dropped on the
 * assumption that an upload worked.
 */
export type PhotoRef = {
  id: string;
  /** ~320px JPEG data URL — small enough to live in the record and sync. */
  thumb: string;
  /** Object path in the delivery-photos bucket, once the full image is uploaded. */
  path?: string;
};

export type DeliveryLog = {
  id: string;
  supplierId: string;
  date: string;
  /** Dropdown-selected items (current form). */
  items?: DeliveryLogItem[];
  /** Legacy free-text fields — kept so older logged records still render. */
  itemsDescription?: string;
  qty?: string;
  invoiceNumber?: string;
  tempC?: number;
  tempOk: boolean;
  packagingOk: boolean;
  useByOk: boolean;
  /** Photo of the invoice / delivery note. */
  invoicePhotoRef?: PhotoRef;
  /** Photos of the delivered products (proof-of-delivery style). */
  productPhotoRefs?: PhotoRef[];
  /** Legacy inline base64, from before photos moved to Storage — migrated on load, kept so old records still render. */
  invoicePhoto?: string;
  productPhotos?: string[];
  invoiceNote?: string;
  photoNote?: string;
  /** Drawn signature (PNG data URL) confirming whoever checked the delivery actually signed off on it. */
  signature?: string;
  accepted: boolean;
  rejectionReason?: string;
  supplierNotified?: boolean;
  loggedBy: string;
  loggedAt: string;
};

export type CleaningFrequency = "after_use" | "daily" | "weekly" | "monthly";

export type CleaningTask = {
  id: string;
  area: Bi;
  frequency: CleaningFrequency;
  active: boolean;
};

export type CleaningSignoff = {
  id: string;
  taskId: string;
  date: string;
  signedBy: string;
  signedAt: string;
  /**
   * A sign-off is never deleted — legally-required records are tamper-evident
   * (edits logged, not silently overwritten). Withdrawing one stamps these
   * instead, so the export still shows it happened and who reversed it.
   */
  revokedBy?: string;
  revokedAt?: string;
  revokedReason?: string;
};

export type InspectionStage = "before" | "during" | "before_serving";
export type ServicePeriod = "lunch" | "dinner";

/**
 * Three legally-distinct sub-forms (QĐ 1246/QĐ-BYT), not one uniform
 * pass/fail — each stage checks different things, so most fields are only
 * meaningful for their own stage:
 *  - before: ingredient, supplierSource, qty, sensoryOk
 *  - during: areaHygieneOk, staffHygieneOk, startTime, endTime
 *  - before_serving: dish, sensoryOk, timeServed
 */
export type ThreeStepInspection = {
  id: string;
  date: string;
  service: ServicePeriod;
  stage: InspectionStage;
  meal: string;
  ingredient?: string;
  supplierSource?: string;
  qty?: string;
  sensoryOk?: boolean;
  areaHygieneOk?: boolean;
  staffHygieneOk?: boolean;
  startTime?: string;
  endTime?: string;
  dish?: string;
  timeServed?: string;
  notes?: string;
  checkedBy: string;
  checkedAt: string;
};

export type FoodSample = {
  id: string;
  dish: string;
  qty: string;
  servedAt: string;
  storageLocation: string;
  discardBy: string;
  discarded: boolean;
  discardedAt: string | null;
  loggedBy: string;
};

/** Weekly check confirming every sample past its 24h minimum has actually been discarded. */
export type SampleDestructionCheck = {
  id: string;
  weekOf: string;
  allDiscarded: boolean;
  storageCleaned: boolean;
  issuesFound?: string;
  checkedBy: string;
  checkedAt: string;
};

export type PestStatus = "open" | "resolved";

export type PestSighting = {
  id: string;
  date: string;
  location: string;
  action: string;
  reportedTo: string;
  status: PestStatus;
  loggedBy: string;
  loggedAt: string;
};

export type ComplaintCategory = "allergy" | "quality" | "service" | "other";
export type ComplaintSeverity = "low" | "medium" | "high";

/** One superseded version of a complaint's investigation/outcome, kept so the record is tamper-evident rather than overwritten in place. */
export type ComplaintRevision = {
  investigation?: string;
  outcome?: string;
  replacedBy: string;
  replacedAt: string;
};

export type ComplaintLog = {
  id: string;
  date: string;
  guestName: string;
  guestContact?: string;
  category: ComplaintCategory;
  description: string;
  investigation?: string;
  outcome?: string;
  /** Previous investigation/outcome versions, oldest first. Never edited, only appended. */
  revisions?: ComplaintRevision[];
  severity: ComplaintSeverity;
  reportedToAuthority?: boolean;
  loggedBy: string;
  loggedAt: string;
};

// ---------- Supplier Management ----------

export type SupplierCategory = "grocery" | "beer" | "liquor" | "produce_market" | "ice" | "other";
export type SupplierStatus = "approved" | "review" | "replace";

/** Free-form per-supplier paperwork checklist, e.g. "business reg on file", "HACCP cert" — items and count vary by supplier. */
export type SupplierDocItem = {
  label: Bi;
  checked: boolean;
};

export type Supplier = {
  id: string;
  name: string;
  category: SupplierCategory;
  contactId?: string;
  /** business registration number, plus issue date/authority as free text, e.g. "0315000500 — issued 19 Apr 2018, Dept. of Planning & Investment, HCMC" */
  businessRegNo?: string;
  regOnFile?: boolean;
  foodSafetyCertExpiry?: string;
  otherCerts?: string;
  documentChecklist?: SupplierDocItem[];
  lastReviewed?: string;
  status: SupplierStatus;
};

/** A price quote from a supplier for one item — lets Chef/Manager/Owner compare the same item across suppliers before ordering. */
export type SupplierQuote = {
  id: string;
  supplierId: string;
  itemName: string;
  packSize: string;
  unit: string;
  packCostVnd: number;
  quotedAt: string;
  loggedBy: string;
};

export type RejectionRecord = {
  id: string;
  supplierId: string;
  deliveryLogId?: string;
  date: string;
  reason: string;
  photoNote?: string;
  actionTaken: string;
  supplierNotified: boolean;
  loggedBy: string;
};

export type EvaluationDecision = "continue" | "review" | "replace";

export type SupplierEvaluation = {
  id: string;
  supplierId: string;
  period: string;
  qualityScore: number;
  onTimeScore: number;
  /** matches the Food Safety Book's Log 5.13 "Docs OK?" column — a pass/fail, not a 1-5 score. */
  docsOk: boolean;
  decision: EvaluationDecision;
  notes?: string;
  evaluatedBy: string;
  evaluatedAt: string;
};

// ---------- Contacts Directory ----------

export type ContactCategory = "supplier" | "staff" | "emergency" | "building" | "other";

export type Contact = {
  id: string;
  category: ContactCategory;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  website?: string;
  notes?: string;
  linkedSupplierId?: string;
};

// ---------- Licensing & Compliance Calendar ----------

export type License = {
  id: string;
  name: Bi;
  issuedDate?: string;
  /** null until Owner/Manager enters the real certificate date — never seeded with a guessed date. */
  expiryDate: string | null;
  renewalLeadDays: number;
  notes?: Bi;
};

// ---------- App Settings ----------

export type AppSettings = {
  /** Manager cost/margin visibility — spec asks for this to be a toggle, default off. */
  managerSeesCostMargin: boolean;
};

// ---------- Daily Sales Entry ----------

export type SalesChannel = "eat_in" | "takeaway" | "shopee" | "grab";

export type DailySales = {
  id: string;
  date: string;
  channelAmountsVnd: Record<SalesChannel, number>;
  cashSalesVnd: number;
  posZReportTotalVnd: number | null;
  floatVnd: number;
  cashCountedVnd: number | null;
  bankDropVnd: number;
  bankDropNote?: string;
  enteredBy: string;
  updatedAt: string;
};

// ---------- Staff: directory, rota, wages ----------

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type StaffMember = {
  id: string;
  name: string;
  role: string;
  phone?: string;
  /** Used to address the emailed rota — optional, not every staff member has one. */
  email?: string;
  startDate?: string;
  dayOff?: Weekday;
  /** VND per hour — Owner-only visibility, enforced in the UI, not just hidden. */
  hourlyRateVnd?: number;
  /**
   * 4 digits, for the few actions that are personally theirs. Not a security
   * boundary — the device is — but it stops one person acknowledging a policy
   * or opening a disciplinary record on someone else's behalf.
   */
  pin?: string;
  active: boolean;
};

export type ShiftEntry = {
  id: string;
  staffId: string;
  date: string;
  startTime: string;
  endTime: string;
};

// ---------- Staff: induction, conduct, training, health, discipline ----------

export type InductionStep = "contract" | "uniform" | "food_safety_training" | "health_cert" | "pos_access";

export const INDUCTION_STEPS: InductionStep[] = ["contract", "uniform", "food_safety_training", "health_cert", "pos_access"];

export type InductionRecord = {
  staffId: string;
  step: InductionStep;
  doneAt: string | null;
  doneBy: string | null;
};

export type ConductAck = {
  staffId: string;
  ackedAt: string;
};

export type DisciplinaryLevel = "verbal" | "written" | "final";

export type DisciplinaryEntry = {
  id: string;
  staffId: string;
  level: DisciplinaryLevel;
  date: string;
  detail: string;
  loggedBy: string;
};

export type TrainingRecord = {
  id: string;
  staffId: string;
  topic: string;
  date: string;
  /** ISO date this training needs refreshing by, per the Staff Training Record log. */
  refresherDue?: string;
  trainer?: string;
  loggedBy: string;
};

export type HealthCert = {
  staffId: string;
  issueDate?: string;
  expiryDate: string | null;
  renewedOn?: string;
  notes?: string;
};

// ---------- Staff: hiring & recruitment ----------

export type CandidateStatus = "applied" | "interviewing" | "offered" | "hired" | "rejected";

export type Candidate = {
  id: string;
  name: string;
  roleApplied: string;
  status: CandidateStatus;
  phone?: string;
  cvNote?: string;
  createdAt: string;
};

export type QuestionBankItem = {
  id: string;
  role: string;
  question: Bi;
};

export type ScorecardEntry = {
  questionId: string;
  score: number;
  note?: string;
};

export type InterviewScorecard = {
  id: string;
  candidateId: string;
  interviewer: string;
  date: string;
  scores: ScorecardEntry[];
  overallNote?: string;
};

// ---------- Menu & Pricing ----------

export type MenuChannel = "dine_in" | "delivery" | "lunch_box";

export type MenuItem = {
  id: string;
  name: Bi;
  category: RecipeCategory;
  pricesVnd: Record<MenuChannel, number | null>;
  recipeId?: string;
  active: boolean;
  updatedAt: string;
  /** visible caveat on the price itself, e.g. "unconfirmed — flag for Owner to confirm" — shown, never silently dropped. */
  priceNote?: Bi;
};

export type PrintedMaterial = {
  id: string;
  name: Bi;
  par: number;
  onHand: number;
  reorderPoint: number;
  toReprint: boolean;
  source?: string;
  leadTimeDays?: number;
};

// ---------- Marketing & Content Calendar ----------

export type ContentPillar = "process_sensory" | "interior_vibe" | "roast_sunday" | "lunch_box";
export type ContentStatus = "planned" | "posted";

export type ContentPost = {
  id: string;
  date: string;
  pillar: ContentPillar;
  title: string;
  status: ContentStatus;
  saves?: number;
  shares?: number;
};

export type KocPlatform = "instagram" | "tiktok" | "facebook" | "other";
export type KocTier = "nano" | "micro" | "mid";
export type KocContactStatus = "identified" | "contacted" | "confirmed" | "posted" | "declined";

export type KocOutreach = {
  id: string;
  handle: string;
  platform: KocPlatform;
  tier: KocTier;
  status: KocContactStatus;
  compedMealCostVnd?: number;
  wentLive: boolean;
  notes?: string;
};

export type CampaignPlatform = "grab" | "shopeefood" | "other";
export type CampaignStatus = "upcoming" | "entered" | "missed" | "completed";

export type PlatformCampaign = {
  id: string;
  platform: CampaignPlatform;
  name: string;
  entryWindowStart?: string;
  entryWindowEnd?: string;
  status: CampaignStatus;
  notes?: string;
};

// ---------- Weekly Shopping List / Ordering ----------

/** Overlays supplier/pack/order metadata onto an existing (bar) StockItem — never duplicates its par/on-hand tracking. */
export type OrderingMeta = {
  stockItemId: string;
  supplierId?: string;
  packSize?: string;
  /** null = unconfirmed placeholder pricing, chased to a real invoice price over time. */
  packCostVnd: number | null;
  lastOrderedAt: string | null;
};

/** Kitchen supplies (raw ingredients, packaging, cleaning chemicals) — not sellable stock, so tracked separately from StockItem. */
export type SupplyItem = {
  id: string;
  name: Bi;
  supplierId?: string;
  packSize: string;
  packCostVnd: number | null;
  unit: string;
  par: number;
  onHand: number;
  /**
   * When someone last actually counted this. Null means `onHand` is a
   * placeholder, not a measurement — an item nobody has counted isn't known
   * to be low, and flagging it as "below par" buries the genuine shortages.
   */
  lastCountedAt?: string | null;
  lastOrderedAt: string | null;
};

// ---------- Delivery Platform Performance ----------

export type DeliveryPlatformId = "grab" | "shopeefood" | "other";

export type PlatformStats = {
  platform: DeliveryPlatformId;
  rating: number | null;
  cancellationRatePct: number | null;
  avgConfirmationTimeSec: number | null;
  photoCoveragePct: number | null;
  commissionPct: number | null;
  updatedAt: string;
};

export type BadgeRequirement = {
  id: string;
  platform: DeliveryPlatformId;
  requirement: Bi;
  met: boolean;
};

// ---------- Theoretical vs Actual Usage Reporting ----------

/** Units sold of a kitchen StockItem on a given day — the "theoretical" side of the variance report. */
export type DishSalesCount = {
  id: string;
  stockItemId: string;
  date: string;
  qtySold: number;
  enteredBy: string;
  updatedAt: string;
};

// ---------- Session ----------

/**
 * Where the app is being used, not who is using it.
 *
 * The kitchen tablet lives on the pass and four chefs share it through a
 * service — logging in and out per person would be unusable mid-shift. So the
 * device signs in once as a station and stays there; who *did* a given thing
 * is recorded separately by picking a name, and only genuinely personal
 * actions (acknowledging the Code of Conduct, opening your own record) ask
 * for a PIN.
 */
export type Station = "kitchen" | "foh" | "manager";

export type Session = {
  station: Station;
  /** Permissions role the station carries. Derived — never chosen by the user. */
  role: Role;
  /** Who is currently working at this station. This is what gets logged. */
  name: string;
  /** Their staff record, so attribution survives a name being edited later. */
  activeStaffId: string | null;
};

// ---------- Ordering ----------

/**
 * How an order reached us. Kept separate from MenuChannel, which is about
 * pricing: a waiter-entered order and a QR order are both dine-in priced, but
 * they behave differently and the difference is worth reporting on.
 */
export type OrderSource = "qr" | "waiter" | "counter" | "delivery";

/**
 * Order lifecycle.
 *
 * `placed` is the kitchen's inbox; `served` means the food is on the table;
 * `closed` means it is paid and done. Payment is deliberately NOT a status —
 * an order can be served and unpaid, or paid before it is served, and folding
 * the two into one axis makes both wrong.
 */
export type OrderStatus = "placed" | "preparing" | "ready" | "served" | "closed" | "cancelled";

/** Per-line, because a kitchen marks the chicken ready before the sides. */
export type OrderLineStatus = "placed" | "preparing" | "ready" | "served" | "cancelled";

export type OrderLine = {
  id: string;
  menuItemId: string;
  /** Copied at the time of ordering. A later price change must not rewrite history. */
  unitPriceVnd: number;
  qty: number;
  status: OrderLineStatus;
  /** "no scotch bonnet", "extra rice" — free text from a guest, treat as untrusted. */
  note?: string;
};

export type Order = {
  id: string;
  /** Null for a counter or delivery order that isn't sitting at a table. */
  tableId: string | null;
  source: OrderSource;
  /** Which price list applied. Copied so a channel change can't rewrite an old bill. */
  channel: MenuChannel;
  status: OrderStatus;
  lines: OrderLine[];
  placedAt: string;
  /** Staff name for waiter/counter orders; null when a guest ordered by QR. */
  placedBy: string | null;
  guestNote?: string;
  updatedAt: string;
};

// ---------- Payments ----------

/**
 * Three rails, one shape.
 *
 * VietQR settles bank-to-bank and is confirmed by a webhook watching the
 * account; cards go through a gateway; cash is settled in the room. They differ
 * in how confirmation arrives, not in what a payment is — so they share a
 * record and differ only in adapter.
 */
export type PaymentMethod = "cash" | "vietqr" | "card";

/**
 * `pending` means we are waiting to hear. Cash never sits here — it is
 * confirmed the moment it is in the drawer — but both electronic rails do, and
 * an order must never read as paid on the strength of a QR having been shown.
 */
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";

export type Payment = {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amountVnd: number;
  status: PaymentStatus;
  /** Our reference, embedded in the VietQR string so the webhook can match it back. */
  reference: string;
  /** The provider's own id, once they give us one. */
  providerRef?: string;
  /** Which service confirmed it — 'sepay', 'casso', '9pay'. Null for cash. */
  provider?: string;
  takenBy: string | null;
  createdAt: string;
  confirmedAt?: string;
  /** Kept verbatim when a provider rejects, so a failure can be explained later. */
  failureDetail?: string;
};
