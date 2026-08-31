/**
 * Move node_modules out of iCloud's reach.
 *
 * The repository lives in iCloud Drive, which is right for the documents in it
 * and wrong for a 400-package dependency tree. When iCloud is mid-sync, reads
 * of node_modules block long enough that `next build` and `eslint` die with
 * ETIMEDOUT from readFileSync — not slowly, but as a hard failure that reads
 * like a broken toolchain rather than a busy disk. That cost hours once.
 *
 * macOS excludes anything whose name ends in `.nosync`, so the real directory
 * is parked under that name and node_modules becomes a symlink to it. Both are
 * gitignored; nothing about the project layout changes.
 *
 * This runs as postinstall because npm replaces the symlink with a real
 * directory on every install, silently undoing the fix. It never fails the
 * install: a dependency tree in the wrong place still works, just slowly, and
 * blocking `npm install` over a performance fix would be the worse trade.
 */
import { existsSync, lstatSync, renameSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const live = join(root, "node_modules");
const parked = join(root, "node_modules.nosync");

try {
  // Only relevant inside iCloud Drive. The project normally lives outside it
  // (~/Developer), where parking node_modules under another name would be
  // pointless indirection — so this is a no-op unless the path says otherwise.
  if (!root.includes("/Library/Mobile Documents/")) process.exit(0);

  if (!existsSync(live)) process.exit(0);

  // Already a symlink — npm left our arrangement alone this time.
  if (lstatSync(live).isSymbolicLink()) process.exit(0);

  // A real directory means npm has just rebuilt it. The parked copy is now
  // stale by definition, so it goes rather than being merged.
  if (existsSync(parked)) rmSync(parked, { recursive: true, force: true });

  renameSync(live, parked);
  symlinkSync("node_modules.nosync", live, "dir");
  console.log("node_modules parked outside iCloud sync (node_modules.nosync)");
} catch (err) {
  console.warn(
    `Could not move node_modules out of iCloud sync: ${err.message}\n` +
      "Builds will still work, but may be slow or hit ETIMEDOUT while iCloud syncs."
  );
}
