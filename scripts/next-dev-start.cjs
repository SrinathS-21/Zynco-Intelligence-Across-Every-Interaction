const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = process.cwd();
const lockFile = path.join(root, ".next-dev.lock");

function isProcessRunning(pid) {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function writeLock() {
    const payload = {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        cwd: root,
    };
    fs.writeFileSync(lockFile, JSON.stringify(payload), "utf8");
}

function removeLock() {
    try {
        if (fs.existsSync(lockFile)) {
            const raw = fs.readFileSync(lockFile, "utf8");
            const lock = JSON.parse(raw);
            if (!lock || Number(lock.pid) === process.pid) {
                fs.rmSync(lockFile, { force: true });
            }
        }
    } catch {
        fs.rmSync(lockFile, { force: true });
    }
}

if (fs.existsSync(lockFile)) {
    try {
        const existing = JSON.parse(fs.readFileSync(lockFile, "utf8"));
        const existingPid = Number(existing && existing.pid);
        if (isProcessRunning(existingPid)) {
            console.error("Another dev server appears to be running.");
            console.error(`Active PID: ${existingPid}`);
            process.exit(1);
        }
    } catch {
        // Ignore malformed lock and overwrite.
    }
}

writeLock();

const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const args = [nextCli, "dev", "-p", "3000", ...process.argv.slice(2)];
const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
});

const cleanupAndExit = (code) => {
    removeLock();
    process.exit(code);
};

process.on("SIGINT", () => {
    if (!child.killed) child.kill("SIGINT");
});

process.on("SIGTERM", () => {
    if (!child.killed) child.kill("SIGTERM");
});

child.on("exit", (code) => {
    cleanupAndExit(code || 0);
});

child.on("error", (error) => {
    console.error("Failed to start next dev:", error && error.message ? error.message : error);
    cleanupAndExit(1);
});
