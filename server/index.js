import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// System prompts
const SYSTEM_PROMPTS = {
  refine: `You are a skilled literary editor and prose stylist helping an author refine their novel. Your role is to:

- Maintain the author's unique voice and style
- Preserve narrative flow and pacing
- Keep character consistency
- Honor the existing tone (whether dark, light, literary, commercial, etc.)

When given text to refine with a specific instruction, return ONLY the refined text without any explanation, preamble, or commentary. Do not include phrases like "Here's the refined version" or any meta-commentary. Just output the improved prose directly.

Match the approximate length of the original unless specifically asked to expand or condense.`,

  ideation: `You are a creative writing collaborator with deep knowledge of storytelling, narrative structure, and literary craft. You're helping an author develop their novel.

Your role is to:
- Generate creative ideas while respecting the author's vision
- Offer suggestions for plot development, character arcs, themes, and world-building
- Provide thoughtful analysis when asked
- Be encouraging but honest
- Ask clarifying questions when helpful

You have a warm, collegial tone - like a well-read friend who happens to be excellent at brainstorming. You're enthusiastic about good ideas and gentle with critiques.

When the author shares context about their story, remember it and build upon it in future responses.`
};

// Refine endpoint - for inline text refinement
app.post('/api/refine', async (req, res) => {
  try {
    const { selectedText, instruction, precedingContext } = req.body;

    if (!selectedText || !instruction) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const userMessage = `PRECEDING CONTEXT (for narrative flow understanding):
"""
${precedingContext || '[Beginning of document]'}
"""

TEXT TO REFINE:
"""
${selectedText}
"""

INSTRUCTION: ${instruction}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPTS.refine,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
    });

    const refinedText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    res.json({ refinedText });
  } catch (error) {
    console.error('Refine error:', error);
    res.status(500).json({ error: 'Failed to refine text' });
  }
});

// Chat endpoint - for ideation sidebar
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, documentContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    // Build system prompt with optional document context
    let systemPrompt = SYSTEM_PROMPTS.ideation;
    if (documentContext) {
      systemPrompt += `\n\nCURRENT DOCUMENT CONTEXT:\n"""${documentContext}"""`;
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    res.json({ message: assistantMessage });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to generate response' });
  }
});

// Streaming endpoint for chat (optional enhancement)
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { messages, documentContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array required' });
    }

    let systemPrompt = SYSTEM_PROMPTS.ideation;
    if (documentContext) {
      systemPrompt += `\n\nCURRENT DOCUMENT CONTEXT:\n"""${documentContext}"""`;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).json({ error: 'Failed to stream response' });
  }
});

app.listen(PORT, () => {
  console.log(`Ex Libris API server running on port ${PORT}`);
});