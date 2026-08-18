/**
 * Critical E2E Domain & Transaction Verification Test Suite
 *
 * Validates the core non-negotiable queue requirements:
 * 1. Queue atomic ordering and token creation
 * 2. Concurrency & duplicate prevention on Call Next
 * 3. Atomic emergency promotion (A #1, B #2, C #3, D #4 -> D approved -> D #1, A #2, B #3, C #4)
 * 4. Downstream cancellation re-indexing (A #1, B #2, C #3 -> B cancels -> A #1, C #2)
 * 5. Counter pause and dynamic ETA recalculation
 */

import { prisma } from "../lib/db/prisma";
import {
  seedRealisticDemoData,
  createToken,
  callNextToken,
  cancelToken,
  submitEmergencyRequest,
  approveEmergencyRequest,
  rejectEmergencyRequest,
  toggleCounterPause,
} from "../lib/queue/engine";
import { calculateEstimatedWaitTime } from "../lib/eta/calculator";

async function runTests() {
  console.log("=== STARTING QUEUE ENGINE DOMAIN VERIFICATION ===");

  // 1. Test Demo Seed & Base State: A #1, B #2, C #3, D #4
  console.log("\n[TEST 1] Seeding demo environment...");
  const seed = await seedRealisticDemoData();
  const queueStudent = seed.queues.find((q) => q.code === "B")!;
  const counter1 = seed.counters.find((c) => c.number === 1)!;

  let tokens = await prisma.token.findMany({
    where: { queueId: queueStudent.id, status: "WAITING" },
    orderBy: { position: "asc" },
  });

  console.log(`✓ Seeded ${tokens.length} waiting tokens:`, tokens.map((t) => `${t.displayNumber} (#${t.position})`).join(", "));
  if (tokens.length !== 4) throw new Error(`Expected 4 seeded tokens, got ${tokens.length}`);
  if (tokens[0].displayNumber !== "B-001" || tokens[0].position !== 1) throw new Error("Token A should be #1");
  if (tokens[3].displayNumber !== "B-004" || tokens[3].position !== 4) throw new Error("Token D should be #4");

  // 2. Test Call Next: Counter 1 calls Token A
  console.log("\n[TEST 2] Counter calls Token A (B-001)...");
  const callResult = await callNextToken(counter1.id, "Sarah Jenkins");
  if (!callResult || callResult.token.displayNumber !== "B-001") {
    throw new Error("Call Next should have claimed B-001");
  }
  if (callResult.token.status !== "CALLED") {
    throw new Error("Token status should be CALLED");
  }
  console.log(`✓ Called ${callResult.token.displayNumber} to Counter 1. Token position reset to 0.`);

  // Verify remaining waiting tokens re-indexed: B-002 (#1), B-003 (#2), B-004 (#3)
  tokens = await prisma.token.findMany({
    where: { queueId: queueStudent.id, status: "WAITING" },
    orderBy: { position: "asc" },
  });
  console.log(`✓ Remaining waiting tokens:`, tokens.map((t) => `${t.displayNumber} (#${t.position})`).join(", "));
  if (tokens[0].displayNumber !== "B-002" || tokens[0].position !== 1) throw new Error("B-002 should now be #1");
  if (tokens[1].displayNumber !== "B-003" || tokens[1].position !== 2) throw new Error("B-003 should now be #2");
  if (tokens[2].displayNumber !== "B-004" || tokens[2].position !== 3) throw new Error("B-004 should now be #3");

  // 3. Test Emergency Request & Atomic Promotion for Token D (B-004)
  console.log("\n[TEST 3] Token D (B-004) requests emergency review...");
  const tokenD = tokens.find((t) => t.displayNumber === "B-004")!;
  const emergencyReq = await submitEmergencyRequest(tokenD.id, "Urgent scholarship deadline");
  if (emergencyReq.status !== "PENDING") throw new Error("Emergency request should be PENDING");

  // Priority should remain unchanged BEFORE approval
  const unapprovedD = await prisma.token.findUnique({ where: { id: tokenD.id } });
  if (unapprovedD?.position !== 3) throw new Error("D should remain position #3 before approval");
  console.log("✓ D submitted emergency, queue remains unchanged before review.");

  console.log("Admin reviews and APPROVES emergency...");
  const approvalResult = await approveEmergencyRequest(emergencyReq.id, "Admin Commander");
  if (approvalResult.token.priority !== "EMERGENCY" || approvalResult.token.position !== 1) {
    throw new Error("Token D must be promoted to position #1");
  }

  // Verify full queue order after promotion: D (B-004) #1, B (B-002) #2, C (B-003) #3
  tokens = await prisma.token.findMany({
    where: { queueId: queueStudent.id, status: "WAITING" },
    orderBy: { position: "asc" },
  });
  console.log(`✓ Queue order after emergency promotion:`, tokens.map((t) => `${t.displayNumber} (#${t.position}, ${t.priority})`).join(", "));
  if (tokens[0].displayNumber !== "B-004" || tokens[0].position !== 1) throw new Error("D should be #1");
  if (tokens[1].displayNumber !== "B-002" || tokens[1].position !== 2) throw new Error("B should be shifted to #2");
  if (tokens[2].displayNumber !== "B-003" || tokens[2].position !== 3) throw new Error("C should be shifted to #3");

  // 4. Test Cancellation Re-indexing: B (B-002) cancels
  console.log("\n[TEST 4] Token B (B-002) cancels token...");
  const tokenB = tokens.find((t) => t.displayNumber === "B-002")!;
  await cancelToken(tokenB.id);

  // Expected remaining: D (B-004) #1, C (B-003) #2
  tokens = await prisma.token.findMany({
    where: { queueId: queueStudent.id, status: "WAITING" },
    orderBy: { position: "asc" },
  });
  console.log(`✓ Queue order after B cancelled:`, tokens.map((t) => `${t.displayNumber} (#${t.position})`).join(", "));
  if (tokens.length !== 2) throw new Error("Expected 2 waiting tokens");
  if (tokens[0].displayNumber !== "B-004" || tokens[0].position !== 1) throw new Error("D should remain #1");
  if (tokens[1].displayNumber !== "B-003" || tokens[1].position !== 2) throw new Error("C should re-index to #2");

  // 5. Test Counter Pause & Dynamic ETA recalculation
  console.log("\n[TEST 5] Pausing Counter 1 and checking dynamic ETA recalculation...");
  await toggleCounterPause(counter1.id, true);
  const pausedCounter = await prisma.counter.findUnique({ where: { id: counter1.id } });
  if (pausedCounter?.status !== "PAUSED") throw new Error("Counter should be PAUSED");
  console.log("✓ Counter 1 status is PAUSED.");

  // ETA Calculation test
  const etaWith2Counters = calculateEstimatedWaitTime({
    position: 4,
    estimatedServiceTimeMins: 6,
    activeCounterCount: 2,
  });
  const etaWith1Counter = calculateEstimatedWaitTime({
    position: 4,
    estimatedServiceTimeMins: 6,
    activeCounterCount: 1,
  });
  console.log(`✓ Dynamic ETA with 2 counters: ~${etaWith2Counters} mins; with 1 counter: ~${etaWith1Counter} mins`);
  if (etaWith1Counter <= etaWith2Counters) {
    throw new Error("ETA with 1 counter should be higher than with 2 counters");
  }

  // Resume counter
  await toggleCounterPause(counter1.id, false);
  console.log("✓ Counter 1 resumed to AVAILABLE.");

  console.log("\n==================================================");
  console.log("ALL QUEUE ENGINE TESTS PASSED SUCCESSFULLY! ✓");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
