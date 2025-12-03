import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import db from './database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increase limit for large documents

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

// ============================================
// DOCUMENT ENDPOINTS
// ============================================

// Get all documents (metadata only for list view)
app.get('/api/documents', (req, res) => {
  try {
    const documents = db.prepare(`
      SELECT id, title, word_count, created_at, last_modified 
      FROM documents 
      ORDER BY last_modified DESC
    `).all();
    
    // Convert snake_case to camelCase for frontend
    const formatted = documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      wordCount: doc.word_count,
      createdAt: doc.created_at,
      lastModified: doc.last_modified,
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get single document with content
app.get('/api/documents/:id', (req, res) => {
  try {
    const document = db.prepare(`
      SELECT * FROM documents WHERE id = ?
    `).get(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      wordCount: document.word_count,
      createdAt: document.created_at,
      lastModified: document.last_modified,
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Create new document
app.post('/api/documents', (req, res) => {
  try {
    const { id, title, content, wordCount } = req.body;
    const now = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO documents (id, title, content, word_count, created_at, last_modified)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, title || 'Untitled', content || '', wordCount || 0, now, now);
    
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
    
    res.status(201).json({
      id: document.id,
      title: document.title,
      content: document.content,
      wordCount: document.word_count,
      createdAt: document.created_at,
      lastModified: document.last_modified,
    });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

// Update document
app.put('/api/documents/:id', (req, res) => {
  try {
    const { title, content, wordCount } = req.body;
    const now = new Date().toISOString();
    
    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    db.prepare(`
      UPDATE documents 
      SET title = ?, content = ?, word_count = ?, last_modified = ?
      WHERE id = ?
    `).run(title, content, wordCount, now, req.params.id);
    
    const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
    
    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      wordCount: document.word_count,
      createdAt: document.created_at,
      lastModified: document.last_modified,
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Delete document
app.delete('/api/documents/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT id FROM documents WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ============================================
// AI ENDPOINTS (existing)
// ============================================

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