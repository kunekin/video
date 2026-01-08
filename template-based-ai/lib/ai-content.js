/**
 * AI Content Generation using OpenAI
 */

import OpenAI from 'openai';

export async function generateAIContent(keyword, apiKey) {
  console.log(`🤖 Generating AI content for: "${keyword}"`);

  if (!apiKey) {
    throw new Error('OpenAI API key is required');
  }

  try {
    const openai = new OpenAI({ apiKey });

    const prompt = `Analyze keyword: "${keyword}"

You are an expert SEO content strategist with deep knowledge of Google's ranking algorithms, SERP features, search intent analysis, and semantic SEO optimization.

STEP 1: Search Intent Classification
- Determine if this is: Informational, Transactional, Navigational, or Commercial Investigation
- Identify the primary user goal and pain points
- Consider voice search vs text search patterns

STEP 2: Generate Google-Optimized Content

Requirements:

1. TITLE (60-70 characters)
   - Include primary keyword naturally
   - Use power words (Ultimate, Complete, Essential, Proven, Expert)
   - Include year "2026" for freshness signal
   - Create curiosity without being clickbait
   - Examples: "Ultimate Guide: {keyword} 2026" or "Proven {keyword} Strategies 2026"

2. EXTENDED_TITLE (80-120 characters)
   - Question format optimized for "People Also Ask"
   - Include semantic keyword variations
   - Address specific user pain point or benefit
   - Examples: "How to {action} {keyword}: Expert Tips for {audience}"

3. META_DESCRIPTION (155-160 characters)
   - Start with action verb or clear benefit
   - Include primary keyword + 1-2 semantic variations
   - Add compelling call-to-action
   - Communicate unique value proposition

4. FEATURED_SNIPPET (35-50 words)
   - Provide definitive answer suitable for Google featured snippets
   - Use numbered list or step-by-step format when appropriate
   - Include specific statistics or numbers if relevant
   - Direct answer to the implied question in the keyword

5. PARAGRAPH_DESCRIPTION (250-350 characters)
   - Rich with semantic keyword variations
   - Include benefits and outcomes
   - Natural keyword placement (not stuffed)
   - Engaging and informative for video/content description

6. KEYWORDS (Generate 15-20 total keywords):
   a) PRIMARY: The exact main keyword
   b) LSI (5-7 keywords): Latent Semantic Indexing - semantic variations
      Examples for "sustainable packaging": eco-friendly packaging, green packaging solutions, biodegradable materials
   c) LONG_TAIL (3-5 keywords): 3-5 word phrases with lower competition
      Examples: "sustainable packaging for small business", "how to choose sustainable packaging"
   d) QUESTIONS (2-3 keywords): Question-based keywords for PAA optimization
      Examples: "what is sustainable packaging", "how to make packaging sustainable"

7. SEARCH_INTENT: Classify as one of: informational, transactional, navigational, commercial

8. RELATED_VIDEOS (Generate 6 unique related videos)
   For the "More Videos" section, create 6 semantically related video titles and descriptions that expand on different aspects of the main keyword.
   
   Requirements for EACH video (must be DIFFERENT from each other):
   - Title: 45-75 characters, SEO-optimized, question or how-to format
   - Description: 120-160 characters, engaging and informative
   - Duration: Random between 04:30 and 08:30 (format: MM:SS)
   - Use LSI keywords and long-tail variations
   - Each must cover a DIFFERENT subtopic or angle
   - Format variations: Question, How-to, Guide, Explained, Tips, Trends
   
   Example angles for "sustainable packaging":
   1. Material selection guide
   2. Cost vs benefits analysis  
   3. Industry trends and consumer preferences
   4. Implementation strategies
   5. Comparison (recyclable vs biodegradable)
   6. Case studies or ROI

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "searchIntent": "informational|transactional|navigational|commercial",
  "title": "...",
  "extendedTitle": "...",
  "description": {
    "meta": "...",
    "snippet": "...",
    "paragraph": "..."
  },
  "keywords": {
    "primary": "...",
    "lsi": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
    "longTail": ["long phrase 1", "long phrase 2", "long phrase 3"],
    "questions": ["question 1", "question 2"]
  },
  "relatedVideos": [
    {
      "title": "Video title 1 (45-75 chars)",
      "description": "Video description 1 (120-160 chars)",
      "duration": "05:30"
    },
    {
      "title": "Video title 2 (45-75 chars)",
      "description": "Video description 2 (120-160 chars)",
      "duration": "06:15"
    },
    {
      "title": "Video title 3 (45-75 chars)",
      "description": "Video description 3 (120-160 chars)",
      "duration": "04:45"
    },
    {
      "title": "Video title 4 (45-75 chars)",
      "description": "Video description 4 (120-160 chars)",
      "duration": "07:20"
    },
    {
      "title": "Video title 5 (45-75 chars)",
      "description": "Video description 5 (120-160 chars)",
      "duration": "05:50"
    },
    {
      "title": "Video title 6 (45-75 chars)",
      "description": "Video description 6 (120-160 chars)",
      "duration": "06:40"
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO content strategist with deep knowledge of Google\'s ranking algorithms, SERP features, search intent analysis, semantic SEO, E-E-A-T principles, and featured snippet optimization. Generate content optimized for top 3 Google rankings, featured snippets (position zero), and People Also Ask boxes. Use semantic keyword variations naturally and include 2026 freshness signals. Return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1500
    });

    const content = JSON.parse(response.choices[0].message.content);
    console.log('✅ AI content generated');
    
    return content;
  } catch (error) {
    console.error('❌ Error generating AI content:', error.message);
    throw error;
  }
}
