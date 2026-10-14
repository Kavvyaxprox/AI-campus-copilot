import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler, badRequest, serviceUnavailable } from '../lib/http';
import { requireClaims, requireRole } from '../middleware/auth';
import { createChatCompletion } from '../lib/openai';
import {
  buildContextBlock,
  collectCitations,
  retrieveKnowledge,
  RetrievedChunk,
} from '../services/rag';

export const chatRouter = Router();

const MAX_QUESTION_LENGTH = 1200;
const MAX_HISTORY_TURNS = 6;

const SYSTEM_PROMPT = `You are AI Campus Copilot, the official question answering assistant of the campus.

Follow these rules without exception:
1. Answer ONLY from the CONTEXT block supplied with the question. Do not use outside knowledge, memory or assumptions.
2. Every factual claim must be supported by the context and must carry a citation marker in square brackets, for example [1] or [2]. The marker number refers to the matching numbered source in the CONTEXT block.
3. If the context does not contain the information needed, reply exactly: "I could not find an answer to that in the approved campus documents." Do not guess, do not approximate, do not fill gaps.
4. Never invent dates, deadlines, page numbers, rules, room numbers or contact details.
5. If two sources disagree, say so and cite both.
6. Keep answers concise and use plain sentences. Maximum 200 words unless the question asks for a list or detail.`;

function buildUserPrompt(question: string, context: string): string {
  return `CONTEXT\n${context}\n\nQUESTION\n${question}`;
}

chatRouter.post(
  '/api/chat',
  requireRole('STUDENT'),
  asyncHandler(async (req, res) => {
    const claims = requireClaims(req);

    const question =
      typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!question) throw badRequest('A message is required.');
    if (question.length > MAX_QUESTION_LENGTH) {
      throw badRequest(`Messages are limited to ${MAX_QUESTION_LENGTH} characters.`);
    }

    if (!claims.departmentId) {
      throw serviceUnavailable(
        'This student profile has no department assigned, so scoped retrieval is unavailable.',
      );
    }

    const historyRaw: unknown[] = Array.isArray(req.body?.history) ? req.body.history : [];
    const history = historyRaw
      .slice(-MAX_HISTORY_TURNS)
      .map((entry: unknown) => {
        const item = entry as { role?: unknown; content?: unknown };
        return {
          role: item?.role === 'assistant' ? ('assistant' as const) : ('user' as const),
          content: typeof item?.content === 'string' ? item.content.slice(0, 800) : '',
        };
      })
      .filter((entry) => entry.content.length > 0);

    const retrieved = await retrieveKnowledge(question, {
      departmentId: claims.departmentId,
    });

    const usable = retrieved.filter((chunk: RetrievedChunk) => chunk.text.length > 0);

    if (usable.length === 0) {
      res.json({
        answer:
          'I could not find an answer to that in the approved campus documents.',
        sources: [],
        retrievedChunks: 0,
        grounded: true,
      });
      return;
    }

    const context = buildContextBlock(usable);
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history,
      { role: 'user' as const, content: buildUserPrompt(question, context) },
    ];

    const rawAnswer = await createChatCompletion(messages);
    const answer =
      rawAnswer ||
      'I could not find an answer to that in the approved campus documents.';

    res.json({
      answer,
      sources: collectCitations(answer, usable),
      retrievedChunks: usable.length,
      grounded: true,
    });
  }),
);
