import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storeAIConversationMock, getAIConversationsMock } = vi.hoisted(() => ({
  storeAIConversationMock: vi.fn().mockResolvedValue(undefined),
  getAIConversationsMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/security/EncryptedDatabase', () => ({
  encryptedDB: {
    storeAIConversation: storeAIConversationMock,
    getAIConversations: getAIConversationsMock,
  },
}));

import { dualAI } from '../src/engines/DualAIEngine';

describe('DualAIEngine Professor model routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses local Professor when provider is LOCAL', async () => {
    const response = await dualAI.queryProfessorWithModel(
      'Explain this concept',
      {
        readingContext: {
          documentTitle: 'Test Doc',
          currentPage: 3,
          totalPages: 10,
        },
      },
      { provider: 'LOCAL' }
    );

    expect(response.personality).toBe('PROFESSOR');
    expect(response.message.length).toBeGreaterThan(0);
    expect(storeAIConversationMock).toHaveBeenCalledTimes(1);
    expect(storeAIConversationMock).toHaveBeenCalledWith(
      'PROFESSOR',
      'Explain this concept',
      expect.any(String),
      expect.objectContaining({ processingTimeMs: expect.any(Number) })
    );
  });

  it('uses OpenAI provider when configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Cloud response for analysis.' } }],
        usage: { total_tokens: 123 },
      }),
    });

    vi.stubGlobal('fetch', fetchMock);

    const response = await dualAI.queryProfessorWithModel(
      'Summarize this page',
      {
        readingContext: {
          documentTitle: 'Cloud Doc',
          currentPage: 7,
          totalPages: 21,
        },
      },
      { provider: 'OPENAI', apiKey: 'sk-test-123', model: 'gpt-4.1-mini' }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.message).toContain('Cloud response');
    expect(storeAIConversationMock).toHaveBeenCalledTimes(1);
    expect(storeAIConversationMock).toHaveBeenCalledWith(
      'PROFESSOR',
      'Summarize this page',
      'Cloud response for analysis.',
      expect.objectContaining({
        modelVersion: 'openai:gpt-4.1-mini',
        tokensUsed: 123,
      })
    );
  });

  it('falls back to local Professor if OpenAI fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await dualAI.queryProfessorWithModel(
      'What is the main argument?',
      {
        readingContext: {
          documentTitle: 'Fallback Doc',
          currentPage: 2,
          totalPages: 8,
        },
      },
      { provider: 'OPENAI', apiKey: 'sk-test-123', model: 'gpt-4.1-mini' }
    );

    expect(response.message).toContain('Cloud model unavailable');
    expect(response.personality).toBe('PROFESSOR');
    expect(storeAIConversationMock).toHaveBeenCalledTimes(1);
  });
});
