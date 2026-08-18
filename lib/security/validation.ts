import { z } from "zod";

export const CreateTokenSchema = z.object({
  queueId: z.string().min(1, "Queue ID is required"),
  visitorName: z.string().trim().max(100).default("Visitor"),
  purpose: z.string().trim().max(200).default("General Service"),
  turnstileToken: z.string().optional(),
  honeypot: z.string().max(0, "Bot detected").optional(),
});

export const EmergencyRequestSchema = z.object({
  tokenId: z.string().min(1, "Token ID is required"),
  reason: z.string().trim().min(3, "Reason must be at least 3 characters").max(500, "Reason too long"),
});

export const EmergencyReviewSchema = z.object({
  requestId: z.string().min(1, "Request ID is required"),
  action: z.enum(["APPROVE", "REJECT"]),
  reviewer: z.string().trim().max(100).default("Admin"),
  notes: z.string().trim().max(500).optional(),
});

export const CounterActionSchema = z.object({
  counterId: z.string().min(1, "Counter ID is required"),
  action: z.enum(["CALL_NEXT", "RECALL", "NO_SHOW", "TRANSFER", "PAUSE", "RESUME", "COMPLETE", "COMPLETE_SERVING", "START_SERVING", "ASSIGN_QUEUE"]),
  operatorName: z.string().trim().max(100).optional(),
  targetQueueId: z.string().nullable().optional(), // For TRANSFER or ASSIGN_QUEUE action
  specificTokenId: z.string().optional(), // For calling a specific token
});
