import { prisma } from "../db/prisma";
import { realtimeBus } from "../realtime/events";
import { calculateEstimatedWaitTime } from "../eta/calculator";

/**
 * Re-indexes all active WAITING tokens for a given queue in atomic order.
 * Emergency tokens are placed first, followed by standard tokens by creation time.
 */
export async function reindexQueuePositions(db: any = prisma, queueId: string) {
  const client = db || prisma;
  const waitingTokens = await client.token.findMany({
    where: {
      queueId,
      status: "WAITING",
    },
    orderBy: [
      { createdAt: "asc" },
    ],
  });

  // Explicitly prioritize EMERGENCY priority over STANDARD, then by arrival time
  waitingTokens.sort((a: any, b: any) => {
    const aPri = a.priority === "EMERGENCY" ? 1 : 0;
    const bPri = b.priority === "EMERGENCY" ? 1 : 0;
    if (aPri !== bPri) return bPri - aPri; // 1 (EMERGENCY) comes first
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  for (let i = 0; i < waitingTokens.length; i++) {
    const token = waitingTokens[i];
    const newPosition = i + 1;
    if (token.position !== newPosition) {
      await client.token.update({
        where: { id: token.id },
        data: { position: newPosition },
      });
      token.position = newPosition;
    }
  }

  return waitingTokens.length;
}

/**
 * Get active counter count for a queue
 */
export async function getActiveCounterCount(queueId: string): Promise<number> {
  const count = await prisma.counter.count({
    where: {
      OR: [{ queueId }, { queueId: null }],
      status: { in: ["AVAILABLE", "BUSY"] },
    },
  });
  return Math.max(1, count);
}

/**
 * Create a new Token atomically
 */
export async function createToken(params: {
  queueId: string;
  visitorSessionId: string;
  visitorName: string;
  purpose: string;
}) {
  const { queueId, visitorSessionId, visitorName, purpose } = params;

  const queue = await prisma.queue.findUnique({
    where: { id: queueId },
  });

  if (!queue) {
    throw new Error("Queue not found");
  }

  if (queue.status !== "ACTIVE") {
    throw new Error("Queue is currently not accepting new tokens");
  }

  // Determine sequence number and waiting count
  const [tokenCount, waitingCount] = await Promise.all([
    prisma.token.count({ where: { queueId } }),
    prisma.token.count({ where: { queueId, status: "WAITING" } }),
  ]);

  const sequenceNumber = tokenCount + 1;
  const displayNumber = `${queue.code}-${String(sequenceNumber).padStart(3, "0")}`;
  const position = waitingCount + 1;

  const token = await prisma.token.create({
    data: {
      displayNumber,
      sequenceNumber,
      queueId,
      visitorSessionId,
      visitorName: visitorName || "Visitor",
      purpose: purpose || "General Service",
      status: "WAITING",
      position,
      priority: "STANDARD",
    },
    include: {
      queue: true,
    },
  });

  // Record audit event asynchronously
  await prisma.tokenEvent.create({
    data: {
      tokenId: token.id,
      queueId: token.queueId,
      eventType: "TOKEN_CREATED",
      actor: visitorName || "VISITOR",
      metadata: JSON.stringify({
        displayNumber,
        position,
        queueName: queue.name,
      }),
    },
  }).catch((err) => console.error("Event record non-fatal error:", err));

  // Publish Realtime Event
  const activeCounters = await getActiveCounterCount(token.queueId);
  const eta = calculateEstimatedWaitTime({
    position: token.position,
    estimatedServiceTimeMins: token.queue.estimatedServiceTime,
    activeCounterCount: activeCounters,
  });

  realtimeBus.publish("TOKEN_CREATED", {
    tokenId: token.id,
    queueId: token.queueId,
    data: {
      token: {
        id: token.id,
        displayNumber: token.displayNumber,
        position: token.position,
        status: token.status,
        priority: token.priority,
        visitorName: token.visitorName,
        purpose: token.purpose,
        queueName: token.queue.name,
        eta,
      },
    },
  });

  return token;
}

/**
 * Call Next Token for a Counter
 */
export async function callNextToken(
  counterId: string,
  operatorName?: string,
  targetQueueId?: string | null,
  specificTokenId?: string
) {
  const counter = await prisma.counter.findUnique({
    where: { id: counterId },
    include: { queue: true },
  });

  if (!counter) {
    throw new Error("Counter not found");
  }

  if (counter.status === "PAUSED") {
    throw new Error("Counter is currently paused. Resume counter to call next.");
  }

  let eligibleToken = null;

  if (specificTokenId) {
    eligibleToken = await prisma.token.findUnique({
      where: { id: specificTokenId },
      include: { queue: true },
    });
  } else {
    // Determine effective queue scope
    const effectiveQueueId = targetQueueId !== undefined ? targetQueueId : counter.queueId;

    eligibleToken = await prisma.token.findFirst({
      where: {
        status: "WAITING",
        ...(effectiveQueueId ? { queueId: effectiveQueueId } : {}),
      },
      orderBy: [
        { priority: "desc" },
        { position: "asc" },
        { createdAt: "asc" },
      ],
      include: {
        queue: true,
      },
    });
  }

  if (!eligibleToken) {
    return null;
  }

  // Complete previous token if still serving
  if (counter.currentServingTokenId) {
    await prisma.token.updateMany({
      where: {
        id: counter.currentServingTokenId,
        status: "CALLED",
      },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
  }

  // Claim next token
  const updatedToken = await prisma.token.update({
    where: { id: eligibleToken.id },
    data: {
      status: "CALLED",
      position: 0,
      counterId: counter.id,
      calledAt: new Date(),
    },
    include: {
      queue: true,
    },
  });

  // Update Counter state
  await prisma.counter.update({
    where: { id: counter.id },
    data: {
      status: "BUSY",
      currentServingTokenId: updatedToken.id,
      ...(operatorName ? { operatorName } : {}),
    },
  });

  // Re-index remaining waiting tokens in this queue
  await reindexQueuePositions(prisma, eligibleToken.queueId);

  // Record Event
  await prisma.tokenEvent.create({
    data: {
      tokenId: updatedToken.id,
      queueId: updatedToken.queueId,
      eventType: "TOKEN_CALLED",
      actor: operatorName || counter.operatorName || "OPERATOR",
      metadata: JSON.stringify({
        counterNumber: counter.number,
        counterName: counter.name,
        displayNumber: updatedToken.displayNumber,
        queueName: updatedToken.queue.name,
      }),
    },
  }).catch(() => {});

  // Publish Realtime Event
  realtimeBus.publish("TOKEN_CALLED", {
    tokenId: updatedToken.id,
    queueId: updatedToken.queueId,
    counterId: counter.id,
    data: {
      token: {
        id: updatedToken.id,
        displayNumber: updatedToken.displayNumber,
        visitorName: updatedToken.visitorName,
        status: updatedToken.status,
        queueName: updatedToken.queue.name,
      },
      counter: {
        id: counter.id,
        number: counter.number,
        name: counter.name,
      },
      announcement: `Token ${updatedToken.displayNumber}, please proceed to ${counter.name}.`,
    },
  });

  return { token: updatedToken, counter };
}

/**
 * Cancel a Token
 */
export async function cancelToken(tokenId: string, visitorSessionId?: string) {
  const token = await prisma.token.findUnique({
    where: { id: tokenId },
    include: { queue: true },
  });

  if (!token) {
    throw new Error("Token not found");
  }

  if (visitorSessionId && token.visitorSessionId !== visitorSessionId) {
    throw new Error("Unauthorized to cancel this token");
  }

  if (token.status !== "WAITING") {
    throw new Error(`Cannot cancel token in '${token.status}' state`);
  }

  const updatedToken = await prisma.token.update({
    where: { id: tokenId },
    data: {
      status: "CANCELLED",
      position: 0,
      cancelledAt: new Date(),
    },
    include: { queue: true },
  });

  // Re-index remaining queue
  await reindexQueuePositions(prisma, token.queueId);

  // Record Event
  await prisma.tokenEvent.create({
    data: {
      tokenId: token.id,
      queueId: token.queueId,
      eventType: "TOKEN_CANCELLED",
      actor: token.visitorName || "VISITOR",
      metadata: JSON.stringify({
        displayNumber: token.displayNumber,
        queueName: token.queue.name,
      }),
    },
  }).catch(() => {});

  realtimeBus.publish("TOKEN_CANCELLED", {
    tokenId: token.id,
    queueId: token.queueId,
    data: {
      token: {
        id: token.id,
        displayNumber: token.displayNumber,
        status: token.status,
      },
    },
  });

  return updatedToken;
}

/**
 * Submit an Emergency / Priority Review Request
 */
export async function submitEmergencyRequest(tokenId: string, reason: string) {
  const token = await prisma.token.findUnique({
    where: { id: tokenId },
    include: { emergencyRequest: true, queue: true },
  });

  if (!token) {
    throw new Error("Token not found");
  }

  if (token.status !== "WAITING") {
    throw new Error("Only waiting tokens can request emergency priority");
  }

  if (token.emergencyRequest) {
    throw new Error("An emergency request has already been submitted for this token");
  }

  const emergencyRequest = await prisma.emergencyRequest.create({
    data: {
      tokenId: token.id,
      reason,
      status: "PENDING",
    },
    include: {
      token: {
        include: { queue: true },
      },
    },
  });

  // Record Event
  await prisma.tokenEvent.create({
    data: {
      tokenId: token.id,
      queueId: token.queueId,
      eventType: "EMERGENCY_REQUESTED",
      actor: token.visitorName || "VISITOR",
      metadata: JSON.stringify({
        displayNumber: token.displayNumber,
        reason,
        currentPosition: token.position,
      }),
    },
  }).catch(() => {});

  realtimeBus.publish("EMERGENCY_REQUESTED", {
    tokenId: emergencyRequest.tokenId,
    queueId: emergencyRequest.token.queueId,
    data: {
      emergencyRequest: {
        id: emergencyRequest.id,
        tokenId: emergencyRequest.tokenId,
        displayNumber: emergencyRequest.token.displayNumber,
        reason: emergencyRequest.reason,
        status: emergencyRequest.status,
        currentPosition: emergencyRequest.token.position,
        requestedAt: emergencyRequest.requestedAt.toISOString(),
        queueName: emergencyRequest.token.queue.name,
      },
    },
  });

  return emergencyRequest;
}

/**
 * Approve Emergency Request - Atomic promotion to #1 and queue shift
 */
export async function approveEmergencyRequest(requestId: string, reviewer = "Admin", notes?: string) {
  const request = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
    include: {
      token: {
        include: { queue: true },
      },
    },
  });

  if (!request) {
    throw new Error("Emergency request not found");
  }

  if (request.status !== "PENDING") {
    throw new Error(`Emergency request is already ${request.status}`);
  }

  const token = request.token;
  if (token.status !== "WAITING") {
    throw new Error("Token is no longer in WAITING state");
  }

  // Update emergency request status
  const updatedRequest = await prisma.emergencyRequest.update({
    where: { id: requestId },
    data: {
      status: "APPROVED",
      reviewedAt: new Date(),
      reviewedBy: reviewer,
      notes: notes || "Approved by administration",
    },
  });

  // Promote token to EMERGENCY priority
  await prisma.token.update({
    where: { id: token.id },
    data: {
      priority: "EMERGENCY",
    },
  });

  // Re-index entire queue so emergency token becomes #1 and other waiting tokens shift
  await reindexQueuePositions(prisma, token.queueId);

  // Fetch freshly updated token position
  const promotedToken = await prisma.token.findUnique({
    where: { id: token.id },
    include: { queue: true },
  });

  // Record Event
  await prisma.tokenEvent.create({
    data: {
      tokenId: token.id,
      queueId: token.queueId,
      eventType: "EMERGENCY_PROMOTED",
      actor: reviewer,
      metadata: JSON.stringify({
        displayNumber: token.displayNumber,
        newPosition: promotedToken?.position,
        reason: request.reason,
      }),
    },
  }).catch(() => {});

  realtimeBus.publish("EMERGENCY_PROMOTED", {
    tokenId: promotedToken!.id,
    queueId: promotedToken!.queueId,
    data: {
      token: {
        id: promotedToken!.id,
        displayNumber: promotedToken!.displayNumber,
        position: promotedToken!.position,
        priority: promotedToken!.priority,
        status: promotedToken!.status,
      },
      request: {
        id: updatedRequest.id,
        status: updatedRequest.status,
      },
    },
  });

  return { request: updatedRequest, token: promotedToken! };
}

/**
 * Reject Emergency Request
 */
export async function rejectEmergencyRequest(requestId: string, reviewer = "Admin", notes?: string) {
  const request = await prisma.emergencyRequest.findUnique({
    where: { id: requestId },
    include: { token: { include: { queue: true } } },
  });

  if (!request) {
    throw new Error("Emergency request not found");
  }

  if (request.status !== "PENDING") {
    throw new Error(`Emergency request is already ${request.status}`);
  }

  const updatedRequest = await prisma.emergencyRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      reviewedAt: new Date(),
      reviewedBy: reviewer,
      notes: notes || "Rejected by administration",
    },
  });

  // Record Event
  await prisma.tokenEvent.create({
    data: {
      tokenId: request.tokenId,
      queueId: request.token.queueId,
      eventType: "EMERGENCY_REJECTED",
      actor: reviewer,
      metadata: JSON.stringify({
        displayNumber: request.token.displayNumber,
        reason: request.reason,
        notes,
      }),
    },
  }).catch(() => {});

  realtimeBus.publish("EMERGENCY_REJECTED", {
    tokenId: request.token.id,
    queueId: request.token.queueId,
    data: {
      token: {
        id: request.token.id,
        displayNumber: request.token.displayNumber,
        position: request.token.position,
      },
      request: {
        id: updatedRequest.id,
        status: updatedRequest.status,
      },
    },
  });

  return { request: updatedRequest, token: request.token };
}

/**
 * Direct Admin Priority Promotion / Demotion (without needing visitor request)
 */
export async function toggleDirectEmergency(
  tokenId: string,
  setEmergency: boolean,
  reviewer = "Admin",
  notes?: string
) {
  const token = await prisma.token.findUnique({
    where: { id: tokenId },
    include: { queue: true, emergencyRequest: true },
  });

  if (!token) {
    throw new Error("Token not found");
  }

  if (token.status !== "WAITING") {
    throw new Error("Only waiting tokens can have priority modified");
  }

  const newPriority = setEmergency ? "EMERGENCY" : "STANDARD";

  // Update token priority
  await prisma.token.update({
    where: { id: tokenId },
    data: { priority: newPriority },
  });

  // If there's an existing emergency request, update it as well
  if (token.emergencyRequest) {
    await prisma.emergencyRequest.update({
      where: { id: token.emergencyRequest.id },
      data: {
        status: setEmergency ? "APPROVED" : "REJECTED",
        reviewedAt: new Date(),
        reviewedBy: reviewer,
        notes: notes || (setEmergency ? "Direct priority grant by Admin" : "Demoted to standard priority"),
      },
    });
  }

  // Re-index entire queue so emergency token moves to #1
  await reindexQueuePositions(prisma, token.queueId);

  const updatedToken = await prisma.token.findUnique({
    where: { id: tokenId },
    include: { queue: true },
  });

  // Publish event
  realtimeBus.publish(setEmergency ? "EMERGENCY_PROMOTED" : "TOKEN_CREATED", {
    tokenId: updatedToken!.id,
    queueId: updatedToken!.queueId,
    data: {
      token: {
        id: updatedToken!.id,
        displayNumber: updatedToken!.displayNumber,
        position: updatedToken!.position,
        priority: updatedToken!.priority,
        status: updatedToken!.status,
      },
    },
  });

  return updatedToken;
}

/**
 * Recall Token
 */
export async function recallToken(counterId: string) {
  const counter = await prisma.counter.findUnique({
    where: { id: counterId },
    include: { queue: true },
  });

  if (!counter) {
    throw new Error("Counter not found");
  }

  if (!counter.currentServingTokenId) {
    return { success: true, empty: true, message: "Counter has no active token to recall" };
  }

  const token = await prisma.token.findUnique({
    where: { id: counter.currentServingTokenId },
    include: { queue: true },
  });

  if (!token) {
    return { success: true, empty: true, message: "Called token not found" };
  }

  // Record recall event
  await prisma.tokenEvent.create({
    data: {
      tokenId: token.id,
      queueId: token.queueId,
      eventType: "TOKEN_RECALLED",
      actor: counter.operatorName || "OPERATOR",
      metadata: JSON.stringify({
        counterNumber: counter.number,
        counterName: counter.name,
        displayNumber: token.displayNumber,
      }),
    },
  }).catch(() => {});

  // Publish event with audio announcement
  realtimeBus.publish("TOKEN_RECALLED", {
    tokenId: token.id,
    queueId: token.queueId,
    counterId: counter.id,
    data: {
      token: {
        id: token.id,
        displayNumber: token.displayNumber,
        visitorName: token.visitorName,
        status: token.status,
        queueName: token.queue.name,
      },
      counter: {
        id: counter.id,
        number: counter.number,
        name: counter.name,
      },
      announcement: `Recall: Token ${token.displayNumber}, please proceed to ${counter.name}.`,
    },
  });

  return { token, counter };
}

/**
 * Complete serving current token
 */
export async function completeServing(counterId: string, operatorName?: string) {
  const counter = await prisma.counter.findUnique({
    where: { id: counterId },
    include: { queue: true },
  });

  if (!counter) {
    throw new Error("Counter not found");
  }

  if (!counter.currentServingTokenId) {
    // If already clear, ensure counter is AVAILABLE
    if (counter.status !== "PAUSED" && counter.status !== "CLOSED") {
      await prisma.counter.update({
        where: { id: counter.id },
        data: { status: "AVAILABLE" },
      });
    }
    return { success: true, empty: true, message: "Counter was already clear" };
  }

  const token = await prisma.token.update({
    where: { id: counter.currentServingTokenId },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
    include: { queue: true },
  });

  // Set counter to AVAILABLE
  const updatedCounter = await prisma.counter.update({
    where: { id: counter.id },
    data: {
      status: counter.status === "PAUSED" ? "PAUSED" : "AVAILABLE",
      currentServingTokenId: null,
      ...(operatorName ? { operatorName } : {}),
    },
  });

  // Record audit event
  await prisma.tokenEvent.create({
    data: {
      tokenId: token.id,
      queueId: token.queueId,
      eventType: "TOKEN_COMPLETED",
      actor: operatorName || counter.operatorName || "OPERATOR",
      metadata: JSON.stringify({
        counterNumber: counter.number,
        counterName: counter.name,
        displayNumber: token.displayNumber,
        queueName: token.queue?.name,
      }),
    },
  }).catch(() => {});

  realtimeBus.publish("TOKEN_COMPLETED", {
    tokenId: token.id,
    queueId: token.queueId,
    counterId: counter.id,
    data: {
      token: {
        id: token.id,
        displayNumber: token.displayNumber,
        status: "COMPLETED",
      },
      counter: {
        id: counter.id,
        number: counter.number,
        name: counter.name,
        status: updatedCounter.status,
      },
    },
  });

  return { token, counter: updatedCounter };
}

/**
 * Mark Token as No-Show
 */
export async function markNoShow(counterId: string) {
  const counter = await prisma.counter.findUnique({
    where: { id: counterId },
  });

  if (!counter) {
    throw new Error("Counter not found");
  }

  if (!counter.currentServingTokenId) {
    return { success: true, empty: true, message: "No active token being served at this counter" };
  }

  const token = await prisma.token.update({
    where: { id: counter.currentServingTokenId },
    data: {
      status: "NO_SHOW",
      completedAt: new Date(),
    },
    include: { queue: true },
  });

  // Set counter to AVAILABLE
  const updatedCounter = await prisma.counter.update({
    where: { id: counter.id },
    data: {
      status: counter.status === "PAUSED" ? "PAUSED" : "AVAILABLE",
      currentServingTokenId: null,
    },
  });

  // Record event
  await prisma.tokenEvent.create({
    data: {
      tokenId: token.id,
      queueId: token.queueId,
      eventType: "TOKEN_NO_SHOW",
      actor: counter.operatorName || "OPERATOR",
      metadata: JSON.stringify({
        counterNumber: counter.number,
        counterName: counter.name,
        displayNumber: token.displayNumber,
      }),
    },
  }).catch(() => {});

  realtimeBus.publish("TOKEN_NO_SHOW", {
    tokenId: token.id,
    queueId: token.queueId,
    counterId: counter.id,
    data: {
      token: {
        id: token.id,
        displayNumber: token.displayNumber,
        status: "NO_SHOW",
      },
    },
  });

  return { token, counter: updatedCounter };
}

/**
 * Transfer Token to another Queue
 */
export async function transferToken(params: {
  tokenId: string;
  targetQueueId: string;
  actor?: string;
  notes?: string;
}) {
  const { tokenId, targetQueueId, actor = "Operator", notes } = params;

  const targetQueue = await prisma.queue.findUnique({
    where: { id: targetQueueId },
  });

  if (!targetQueue) {
    throw new Error("Target queue not found");
  }

  const token = await prisma.token.findUnique({
    where: { id: tokenId },
    include: { queue: true },
  });

  if (!token) {
    throw new Error("Token not found");
  }

  const oldQueueId = token.queueId;

  // Calculate new position in target queue
  const targetWaitingCount = await prisma.token.count({
    where: { queueId: targetQueueId, status: "WAITING" },
  });

  const updatedToken = await prisma.token.update({
    where: { id: tokenId },
    data: {
      queueId: targetQueueId,
      status: "WAITING",
      position: targetWaitingCount + 1,
      counterId: null,
    },
    include: { queue: true },
  });

  // Re-index remaining tokens in old queue
  await reindexQueuePositions(prisma, oldQueueId);

  // Record event
  await prisma.tokenEvent.create({
    data: {
      tokenId: token.id,
      queueId: targetQueueId,
      eventType: "TOKEN_TRANSFERRED",
      actor,
      metadata: JSON.stringify({
        fromQueue: token.queue.name,
        toQueue: targetQueue.name,
        displayNumber: token.displayNumber,
        notes,
      }),
    },
  }).catch(() => {});

  realtimeBus.publish("TOKEN_TRANSFERRED", {
    tokenId: token.id,
    queueId: targetQueueId,
    data: {
      token: {
        id: token.id,
        displayNumber: token.displayNumber,
        position: updatedToken.position,
        queueName: targetQueue.name,
      },
    },
  });

  return updatedToken;
}

/**
 * Toggle Counter Pause / Resume
 */
export async function toggleCounterPause(counterId: string, pause: boolean) {
  const currentCounter = await prisma.counter.findUnique({
    where: { id: counterId },
  });

  if (!currentCounter) {
    throw new Error("Counter not found");
  }

  const newStatus = pause ? "PAUSED" : "AVAILABLE";
  const updatedCounter = await prisma.counter.update({
    where: { id: counterId },
    data: { status: newStatus },
    include: { queue: true },
  });

  const eventType = pause ? "COUNTER_PAUSED" : "COUNTER_RESUMED";

  await prisma.tokenEvent.create({
    data: {
      queueId: updatedCounter.queueId,
      eventType,
      actor: updatedCounter.operatorName || "OPERATOR",
      metadata: JSON.stringify({
        counterNumber: updatedCounter.number,
        counterName: updatedCounter.name,
        newStatus,
      }),
    },
  }).catch(() => {});

  realtimeBus.publish(eventType as any, {
    queueId: updatedCounter.queueId || "ALL",
    counterId: updatedCounter.id,
    data: {
      counter: {
        id: updatedCounter.id,
        number: updatedCounter.number,
        name: updatedCounter.name,
        status: updatedCounter.status,
      },
    },
  });

  return updatedCounter;
}

/**
 * Realistic Demo Seeder:
 * Seeds standard queues, counters, and tokens (A #1, B #2, C #3, D #4)
 */
export async function seedRealisticDemoData() {
  // Clear existing data cleanly
  await prisma.emergencyRequest.deleteMany({});
  await prisma.tokenEvent.deleteMany({});
  await prisma.token.deleteMany({});
  await prisma.counter.deleteMany({});
  await prisma.queue.deleteMany({});

  // Create 3 Institutional Queues
  const queueGeneral = await prisma.queue.create({
    data: {
      name: "General Admissions & Records",
      code: "A",
      department: "Admissions",
      description: "Enrollment, verification, registration, transcripts",
      status: "ACTIVE",
      estimatedServiceTime: 4,
    },
  });

  const queueStudent = await prisma.queue.create({
    data: {
      name: "Student Services & Counseling",
      code: "B",
      department: "Student Affairs",
      description: "Academic advice, ID cards, grievance, housing",
      status: "ACTIVE",
      estimatedServiceTime: 6,
    },
  });

  const queueFinance = await prisma.queue.create({
    data: {
      name: "Financial Aid & Cashier",
      code: "C",
      department: "Finance",
      description: "Tuition fee payment, scholarship claims, refunds",
      status: "ACTIVE",
      estimatedServiceTime: 5,
    },
  });

  // Create 3 Workstation Counters
  const counter1 = await prisma.counter.create({
    data: {
      number: 1,
      name: "Counter 01",
      queueId: queueStudent.id,
      status: "AVAILABLE",
      operatorName: "Sarah Jenkins",
    },
  });

  const counter2 = await prisma.counter.create({
    data: {
      number: 2,
      name: "Counter 02",
      queueId: queueStudent.id,
      status: "AVAILABLE",
      operatorName: "Marcus Vance",
    },
  });

  const counter3 = await prisma.counter.create({
    data: {
      number: 3,
      name: "Counter 03",
      queueId: queueGeneral.id,
      status: "AVAILABLE",
      operatorName: "Elena Rostova",
    },
  });

  // Seed 4 Benchmark Waiting Tokens for Queue B (Student Services)
  const tokenA = await prisma.token.create({
    data: {
      displayNumber: "B-001",
      sequenceNumber: 1,
      queueId: queueStudent.id,
      visitorSessionId: "session_user_a",
      visitorName: "Alice Miller",
      purpose: "Transcript Attestation",
      status: "WAITING",
      position: 1,
      priority: "STANDARD",
    },
  });

  const tokenB = await prisma.token.create({
    data: {
      displayNumber: "B-002",
      sequenceNumber: 2,
      queueId: queueStudent.id,
      visitorSessionId: "session_user_b",
      visitorName: "Bob Smith",
      purpose: "Campus ID Replacement",
      status: "WAITING",
      position: 2,
      priority: "STANDARD",
    },
  });

  const tokenC = await prisma.token.create({
    data: {
      displayNumber: "B-003",
      sequenceNumber: 3,
      queueId: queueStudent.id,
      visitorSessionId: "session_user_c",
      visitorName: "Charlie Brown",
      purpose: "Student ID Card",
      status: "WAITING",
      position: 3,
      priority: "STANDARD",
    },
  });

  const tokenD = await prisma.token.create({
    data: {
      displayNumber: "B-004",
      sequenceNumber: 4,
      queueId: queueStudent.id,
      visitorSessionId: "session_user_d",
      visitorName: "David Vance",
      purpose: "Emergency Document Verification",
      status: "WAITING",
      position: 4,
      priority: "STANDARD",
    },
  });

  // Seed one completed token in Queue A and C for realistic analytics
  await prisma.token.create({
    data: {
      displayNumber: "A-001",
      sequenceNumber: 1,
      queueId: queueGeneral.id,
      visitorSessionId: "session_user_e",
      visitorName: "Grace Hopper",
      purpose: "Course Add/Drop Stamp",
      status: "COMPLETED",
      position: 0,
      priority: "STANDARD",
      calledAt: new Date(Date.now() - 15 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  });

  await prisma.token.create({
    data: {
      displayNumber: "C-001",
      sequenceNumber: 1,
      queueId: queueFinance.id,
      visitorSessionId: "session_user_f",
      visitorName: "Alan Turing",
      purpose: "Tuition Fee Clearance",
      status: "COMPLETED",
      position: 0,
      priority: "STANDARD",
      calledAt: new Date(Date.now() - 25 * 60 * 1000),
      completedAt: new Date(Date.now() - 12 * 60 * 1000),
    },
  });

  return {
    queues: [queueGeneral, queueStudent, queueFinance],
    counters: [counter1, counter2, counter3],
    tokens: [tokenA, tokenB, tokenC, tokenD],
  };
}
