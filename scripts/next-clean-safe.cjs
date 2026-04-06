const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const lockFile = path.join(root, ".next-dev.lock");
const force = process.argv.includes("--force");

function isProcessRunning(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function readLock() {
    if (!fs.existsSync(lockFile)) return null;
    try {
        const raw = fs.readFileSync(lockFile, "utf8");
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

const lock = readLock();
if (!force && lock && isProcessRunning(Number(lock.pid))) {
    console.error("Refusing to clean Next outputs while dev server appears active.");
    console.error(`Active PID: ${lock.pid}`);
    console.error("Stop the dev server first, then rerun clean.");
    process.exit(1);
}

if (lock && !isProcessRunning(Number(lock.pid))) {
    fs.rmSync(lockFile, { force: true });
}

for (const dir of [".next", ".next-dev", ".next-work"]) {
    fs.rmSync(path.join(root, dir), { recursive: true, force: true });
}

console.log("Cleaned .next, .next-dev, .next-work");
