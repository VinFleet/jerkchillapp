/**
 * What the opening and closing portion counts actually tell a chef.
 *
 * The stock log already stores opening, produced and closing per item per day.
 * What it does not do is answer the question those three numbers exist to
 * answer: how many went out today, and how many should be made for tomorrow.
 *
 * Pure on purpose — this is the arithmetic worth being sure about, and it
 * should be provable without a browser or a seeded database.
 */

export type PortionPhase = "opening" | "closing" | "idle";

/**
 * Which count the kitchen is being asked for right now.
 *
 * Asking for both all day is how a chef ends up typing a closing figure into
 * the opening box at 9am. The window is generous at both ends — prep starts
 * before service and closedown runs late — but they never overlap.
 */
export function currentPhase(hour: number): PortionPhase {
  if (hour < 11) return "opening";
  if (hour >= 20) return "closing";
  return "idle";
}

export type PortionRow = {
  itemId: string;
  opening: number;
  produced: number;
  closing: number | null;
  /** Recent average production, from the planner. Null when there's no history. */
  suggested: number | null;
};

export type PortionInsight = {
  itemId: string;
  /** opening + produced − closing. Null until a closing count exists. */
  usedToday: number | null;
  /** What to make for tomorrow. Null when there is nothing to base it on. */
  toPrep: number | null;
  /** Closed with stock left over — worth seeing, it is where waste starts. */
  leftOver: number | null;
  /** A closing count higher than what was available: someone has mistyped. */
  impossible: boolean;
};

export function analysePortions(row: PortionRow): PortionInsight {
  const available = row.opening + row.produced;

  if (row.closing === null) {
    return {
      itemId: row.itemId,
      usedToday: null,
      // Before a closing count exists there is nothing measured to reason
      // from, so fall back to the planner's own suggestion rather than
      // inventing a number.
      toPrep: row.suggested,
      leftOver: null,
      impossible: false,
    };
  }

  // A closing count above what was ever available is a typo, not a discovery.
  // Reporting "used −4 portions" as though it were real is worse than saying
  // the number cannot be right.
  if (row.closing > available) {
    return {
      itemId: row.itemId,
      usedToday: null,
      toPrep: row.suggested,
      leftOver: null,
      impossible: true,
    };
  }

  const usedToday = available - row.closing;

  // Tomorrow needs what went out today, less whatever is already sitting in
  // the fridge. Never negative: "make -3" is not an instruction.
  const toPrep = Math.max(0, usedToday - row.closing);

  return {
    itemId: row.itemId,
    usedToday,
    toPrep,
    leftOver: row.closing,
    impossible: false,
  };
}

/** How many items still need a count in the current phase. */
export function countOutstanding(rows: PortionRow[], phase: PortionPhase): number {
  if (phase === "closing") return rows.filter((r) => r.closing === null).length;
  if (phase === "opening") {
    // Opening is auto-carried from yesterday's closing, so what matters is
    // whether anyone has confirmed it rather than whether it is non-zero — a
    // genuine zero is a real answer.
    return rows.filter((r) => r.opening === 0 && r.produced === 0).length;
  }
  return 0;
}
