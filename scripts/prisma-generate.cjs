const { spawnSync } = require("node:child_process");

const env = { ...process.env };
delete env.PRISMA_GENERATE_NO_ENGINE;

const result = spawnSync("npx prisma generate", {
  stdio: "inherit",
  env,
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
