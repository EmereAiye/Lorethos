import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const rawMessage = err instanceof Error ? err.message : String(err);
  if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
    return {
      status: 500,
      message: 'AI service key is not configured yet. Please check Settings > Secrets.',
    };
  }
  if (rawMessage.includes('403') || rawMessage.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'Gemini API permission denied. Please verify your API key in Settings > Secrets.',
    };
  }
  if (rawMessage.includes('400') || rawMessage.includes('API_KEY_INVALID')) {
    return {
      status: 400,
      message: 'Invalid Gemini API request or key. Please check Settings > Secrets.',
    };
  }
  if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'AI rate limit reached. Please wait a moment and try again.',
    };
  }
  return {
    status: 500,
    message: rawMessage || 'Failed to generate AI response.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // 1. Reader Lore & Chapter Companion
  app.post('/api/ai/companion', async (req, res) => {
    try {
      const {
        mode,
        question,
        storyTitle,
        author,
        genre,
        synopsis,
        prologueLore,
        chapterNumber,
        chapterTitle,
        chapterContent,
      } = req.body as {
        mode: 'recap' | 'ask';
        question?: string;
        storyTitle: string;
        author: string;
        genre: string;
        synopsis: string;
        prologueLore: string;
        chapterNumber: number;
        chapterTitle: string;
        chapterContent: string[];
      };

      if (!storyTitle || !chapterTitle) {
        res.status(400).json({ error: 'Story and chapter context are required.' });
        return;
      }

      const ai = getGeminiClient();
      const chapterText = Array.isArray(chapterContent)
        ? chapterContent.join('\n\n')
        : String(chapterContent || '');

      const contextBlock = [
        `Title: ${storyTitle} by ${author} (${genre})`,
        `Synopsis: ${synopsis}`,
        `World Lore: ${prologueLore}`,
        `Current Chapter ${chapterNumber}: "${chapterTitle}"`,
        `Chapter Prose:\n${chapterText}`,
      ].join('\n\n');

      const prompt =
        mode === 'recap'
          ? `Provide a spoiler-free literary recap of Chapter ${chapterNumber} ("${chapterTitle}") and the story context so far. Keep it concise (3 short bullet points highlighting key events, character stakes, and atmosphere). Do not invent events outside the provided text.`
          : `Answer the reader's question clearly and concisely (2-4 sentences) using only the provided story lore and chapter prose. Question: "${question}"`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `${contextBlock}\n\nTask: ${prompt}`,
        config: {
          systemInstruction:
            'You are the Lorethos Lorekeeper—an insightful, literary reading companion for an African & global serialized storytelling platform. Be eloquent, concise, accurate to the text, and strictly spoiler-free beyond the current chapter.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      res.json({ reply: (response.text ?? '').trim() });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 2. Library Mood & Story Matchmaker
  app.post('/api/ai/recommend', async (req, res) => {
    try {
      const { moodPrompt, catalog } = req.body as {
        moodPrompt: string;
        catalog: Array<{
          slug: string;
          title: string;
          genre: string;
          author: string;
          tags: string[];
          synopsis: string;
        }>;
      };

      if (!moodPrompt || !Array.isArray(catalog) || catalog.length === 0) {
        res.status(400).json({ error: 'Please describe what kind of story you want to read.' });
        return;
      }

      const ai = getGeminiClient();

      const catalogSummary = catalog
        .map(
          (s) =>
            `- slug: "${s.slug}" | title: "${s.title}" | genre: "${s.genre}" | author: "${s.author}" | tags: [${s.tags.join(', ')}] | synopsis: ${s.synopsis}`
        )
        .join('\n');

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Reader preference: "${moodPrompt}"\n\nAvailable Catalog:\n${catalogSummary}\n\nSelect up to 3 best-matching stories from the catalog above (ordered best match first). Only use slugs that exist in the catalog.`,
        config: {
          systemInstruction:
            'You are the Chief Literary Curator at Lorethos. Match readers to stories strictly from the provided catalog with warm, vivid, specific explanations.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              curatorNote: {
                type: Type.STRING,
                description: 'A brief 1-sentence editorial greeting tailored to the reader mood.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    slug: { type: Type.STRING },
                    vibeTag: { type: Type.STRING },
                    reason: { type: Type.STRING },
                  },
                  required: ['slug', 'vibeTag', 'reason'],
                },
              },
            },
            required: ['curatorNote', 'recommendations'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  // 3. Author Publishing Desk — Scriptorium AI Copilot
  app.post('/api/ai/scriptorium', async (req, res) => {
    try {
      const { task, storyTitle, genre, chapterTitle, outline, existingSynopsis } = req.body as {
        task: 'draft_chapter' | 'craft_synopsis';
        storyTitle: string;
        genre: string;
        chapterTitle?: string;
        outline?: string;
        existingSynopsis?: string;
      };

      const ai = getGeminiClient();

      if (task === 'craft_synopsis') {
        const response = await ai.models.generateContent({
          model: MODEL_NAME,
          contents: `Story Title: "${storyTitle || 'Untitled Chronicle'}"\nGenre: ${genre}\nAuthor notes / existing draft: "${existingSynopsis || outline || 'Original mythic narrative'}"\n\nWrite an evocative, publication-ready literary synopsis in 2-3 sentences that hooks readers without giving away the ending.`,
          config: {
            systemInstruction:
              'You are a senior literary editor at Lorethos Publishing. Craft atmospheric, compelling book synopses with rich sensory imagery.',
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        res.json({ synopsis: (response.text ?? '').trim() });
        return;
      }

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Story: "${storyTitle}" (${genre})\nChapter Title: "${chapterTitle || 'New Chapter'}"\nScene Outline / Prompt: "${outline || 'Continue the narrative tension with rich atmosphere and character dialogue.'}"\n\nWrite an immersive 3-4 paragraph opening chapter draft and a gripping 1-sentence teaser excerpt.`,
        config: {
          systemInstruction:
            'You are a co-author and literary stylist at Lorethos. Produce evocative, richly textured serialized fiction prose with vivid world-building and strong pacing.',
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              excerpt: {
                type: Type.STRING,
                description: 'A compelling one-sentence teaser hook for chapter previews.',
              },
              paragraphs: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 4 literary prose paragraphs forming the chapter draft.',
              },
            },
            required: ['excerpt', 'paragraphs'],
          },
        },
      });

      const raw = (response.text ?? '{}').trim();
      const parsed = JSON.parse(raw);
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lorethos server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
