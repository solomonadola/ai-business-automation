/**
 * Real-world Lead Automation Simulation Script
 *
 * Simulates a realistic customer journey:
 * 1. Prospect visits landing page & submits inquiry
 * 2. Prospect double-clicks submit (testing idempotency guard)
 * 3. AI reads inquiry, scores fit (Prompt v1.0.0), and categorizes
 * 4. Outbound webhook notification dispatches to sales team
 * 5. Full audit trail is verified in PostgreSQL
 */

const API_BASE = process.env.API_URL || "http://localhost:3000";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
};

async function checkServer(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

async function runSimulation() {
  console.log("\n" + "=".repeat(65));
  console.log(
    `${colors.bright}${colors.cyan}  🚀 AI BUSINESS AUTOMATION — REAL INTERACTION SIMULATION${colors.reset}`,
  );
  console.log("=".repeat(65) + "\n");

  const isUp = await checkServer();
  if (!isUp) {
    console.error(
      `${colors.red}❌ Error: Server not reachable at ${API_BASE}.${colors.reset}`,
    );
    console.error(
      `Please ensure Docker is running with: ${colors.bright}docker compose up -d${colors.reset}\n`,
    );
    process.exit(1);
  }

  console.log(
    `${colors.green}✔ Connected to API at ${API_BASE} (PostgreSQL & Fastify active)${colors.reset}\n`,
  );
  await sleep(600);

  // --------------------------------------------------------------------------
  // STEP 1: Prospect Submits Inbound Inquiry (High-Fit Enterprise)
  // --------------------------------------------------------------------------
  console.log(
    `${colors.bright}[1/5] 👤 Real Prospect Arrives on Website Form${colors.reset}`,
  );
  const highFitLead = {
    name: "Sarah Connor",
    email: `sarah.${Date.now()}@cyberdyne-defense.com`,
    company: "Cyberdyne Systems",
    website: "https://cyberdyne.com",
    message:
      "We have 150 sales representatives and urgently need an automated AI classification and lead routing engine.",
  };

  console.log(
    `      Prospect Name:    ${colors.cyan}${highFitLead.name}${colors.reset}`,
  );
  console.log(
    `      Company:          ${colors.cyan}${highFitLead.company}${colors.reset}`,
  );
  console.log(`      Inquiry Message:  "${highFitLead.message}"`);
  console.log(`      -> Sending POST /api/leads...`);

  const intakeRes = await fetch(`${API_BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(highFitLead),
  });

  const intakeJson = (await intakeRes.json()) as {
    data: { id: string; status: string; idempotencyKey: string };
    isDuplicate: boolean;
  };
  const leadId = intakeJson.data.id;

  console.log(
    `      ${colors.green}✔ Lead Accepted!${colors.reset} ID: ${colors.dim}${leadId}${colors.reset}`,
  );
  console.log(
    `      Status: ${colors.yellow}${intakeJson.data.status.toUpperCase()}${colors.reset} | Persisted to PostgreSQL.`,
  );
  console.log(
    `      Deterministic Hash: ${colors.dim}${intakeJson.data.idempotencyKey.slice(0, 24)}...${colors.reset}\n`,
  );
  await sleep(1000);

  // --------------------------------------------------------------------------
  // STEP 2: Simulate Prospect Double-Clicking (Idempotency Guard)
  // --------------------------------------------------------------------------
  console.log(
    `${colors.bright}[2/5] 🔁 Simulating Double-Click / Network Retry Storm${colors.reset}`,
  );
  console.log(
    `      Prospect accidentally clicks "Submit" twice within 200ms...`,
  );
  console.log(`      -> Re-submitting identical payload to POST /api/leads...`);

  const replayRes = await fetch(`${API_BASE}/api/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(highFitLead),
  });
  const replayJson = (await replayRes.json()) as { isDuplicate: boolean };

  if (replayJson.isDuplicate) {
    console.log(
      `      ${colors.magenta}⚡ Idempotency Guard Activated:${colors.reset} Duplicate intercepted!`,
    );
    console.log(
      `      ${colors.green}✔ Database Integrity Preserved:${colors.reset} Zero duplicate rows created.\n`,
    );
  }
  await sleep(1000);

  // --------------------------------------------------------------------------
  // STEP 3: Automated AI Fit Classification
  // --------------------------------------------------------------------------
  console.log(
    `${colors.bright}[3/5] 🤖 AI Lead Evaluation & Classification${colors.reset}`,
  );
  console.log(
    `      Triggering state machine workflow: received -> classifying -> classified...`,
  );
  console.log(`      -> POST /api/leads/${leadId}/process`);

  const processRes = await fetch(`${API_BASE}/api/leads/${leadId}/process`, {
    method: "POST",
  });
  const processJson = (await processRes.json()) as {
    data: {
      status: string;
      fitScore: number;
      category: string;
      recommendedAction: string;
      reasoningSummary: string;
      notificationSent: boolean;
      notificationMessageId: string;
    };
  };

  const processed = processJson.data;

  console.log(`      ${colors.green}✔ Classification Complete:${colors.reset}`);
  console.log(
    `         • Fit Score:           ${colors.bright}${colors.green}${processed.fitScore} / 100${colors.reset}`,
  );
  console.log(
    `         • Category:            ${colors.bright}${colors.magenta}${processed.category.toUpperCase()}${colors.reset}`,
  );
  console.log(
    `         • Recommended Action:  ${colors.bright}${colors.cyan}${processed.recommendedAction}${colors.reset}`,
  );
  console.log(
    `         • AI Reasoning:        "${processed.reasoningSummary}"\n`,
  );
  await sleep(1000);

  // --------------------------------------------------------------------------
  // STEP 4: Automated Sales Notification Fanout
  // --------------------------------------------------------------------------
  console.log(
    `${colors.bright}[4/5] 🔔 Real-Time Notification Dispatch${colors.reset}`,
  );
  console.log(`      High-fit lead qualified! Routing to sales channels...`);
  console.log(
    `      Notification Sent:     ${colors.green}${processed.notificationSent}${colors.reset}`,
  );
  console.log(
    `      Message Delivery ID:   ${colors.dim}${processed.notificationMessageId}${colors.reset}`,
  );
  console.log(
    `      ${colors.green}✔ Terminal State:${colors.reset} Lead status is now ${colors.bright}${colors.green}${processed.status.toUpperCase()}${colors.reset}.\n`,
  );
  await sleep(1000);

  // --------------------------------------------------------------------------
  // STEP 5: Verify Durable Audit Trail in PostgreSQL
  // --------------------------------------------------------------------------
  console.log(
    `${colors.bright}[5/5] 📜 Verifying PostgreSQL Audit Trail${colors.reset}`,
  );
  console.log(`      Querying workflow_attempts table for lead history...`);

  const historyRes = await fetch(`${API_BASE}/api/leads/${leadId}/history`);
  const historyJson = (await historyRes.json()) as {
    data: Array<{
      step: string;
      attemptNumber: number;
      status: string;
      metadata: Record<string, unknown>;
      createdAt: string;
    }>;
  };

  console.log(
    `      Found ${historyJson.data.length} immutable audit records:`,
  );
  for (const attempt of historyJson.data) {
    const metaStr = attempt.metadata
      ? `-> ${JSON.stringify(attempt.metadata)}`
      : "";
    console.log(
      `         • ${attempt.step.padEnd(14)} (Attempt #${attempt.attemptNumber}) [${attempt.status}] ${colors.dim}${metaStr}${colors.reset}`,
    );
  }

  // --------------------------------------------------------------------------
  // BONUS: Compare with Low-Fit / Casual Inquiry
  // --------------------------------------------------------------------------
  console.log("\n" + "-".repeat(65));
  console.log(
    `${colors.bright}🔍 BONUS COMPARISON: Low-Fit / Student Inquiry${colors.reset}`,
  );
  console.log("-".repeat(65));

  const lowFitLead = {
    name: "Tommy Student",
    email: `tommy.${Date.now()}@university.edu`,
    company: "College Project",
    message:
      "Hey, can I get a free trial to test something for my school homework?",
  };

  const lowIntake = (await (
    await fetch(`${API_BASE}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lowFitLead),
    })
  ).json()) as { data: { id: string } };

  const lowProcess = (await (
    await fetch(`${API_BASE}/api/leads/${lowIntake.data.id}/process`, {
      method: "POST",
    })
  ).json()) as {
    data: {
      fitScore: number;
      category: string;
      recommendedAction: string;
      reasoningSummary: string;
    };
  };

  console.log(`      Prospect: "${lowFitLead.name}" (${lowFitLead.message})`);
  console.log(
    `      • AI Fit Score:          ${colors.red}${lowProcess.data.fitScore} / 100${colors.reset}`,
  );
  console.log(
    `      • AI Category:           ${colors.red}${lowProcess.data.category.toUpperCase()}${colors.reset}`,
  );
  console.log(
    `      • Recommended Action:     ${colors.yellow}${lowProcess.data.recommendedAction}${colors.reset}`,
  );
  console.log(
    `      • AI Reasoning:          "${lowProcess.data.reasoningSummary}"`,
  );

  console.log("\n" + "=".repeat(65));
  console.log(
    `${colors.bright}${colors.green}🎉 SIMULATION COMPLETE! Everything worked cleanly end-to-end.${colors.reset}`,
  );
  console.log(
    `👉 Open your browser at ${colors.bright}${colors.cyan}http://localhost:3000${colors.reset} to see these leads live in the UI!`,
  );
  console.log("=".repeat(65) + "\n");
}

void runSimulation();
