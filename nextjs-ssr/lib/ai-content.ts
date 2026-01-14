/**
 * AI Content Generation Utility
 * Generates SEO-optimized content using OpenAI API
 */

interface AIContent {
  title: string;
  description: {
    meta: string;
    paragraph: string;
    og?: string;
    twitter?: string;
  };
  keywords: string;
}

interface AIContentConfig {
  openaiApiKey: string;
  aiEnabled?: boolean;
  timeout?: number;
}

/**
 * Generate AI content from keyword
 */
export async function generateAIContent(
  keyword: string,
  config: AIContentConfig
): Promise<AIContent | null> {
  const { openaiApiKey, aiEnabled = true, timeout = 25000 } = config;

  if (!aiEnabled) {
    console.error('❌ AI is disabled in config');
    return null;
  }

  if (!openaiApiKey || openaiApiKey.trim() === '') {
    console.error('❌ OpenAI API key is missing or empty!');
    console.error('   Check environment variable: OPENAI_API_KEY');
    return null;
  }

  try {
    const prompt = `Generate SEO-optimized video content for keyword: "${keyword}"

Generate comprehensive, SEO-focused content that will rank well in search engines.

Requirements:
1. TITLE (60-70 characters, SEO-optimized)
2. DESCRIPTION - META (155-160 characters)
3. DESCRIPTION - PARAGRAPH (250-350 characters)
4. KEYWORDS (comma-separated, 5-10 keywords)

Return ONLY a valid JSON object:
{
  "title": "SEO-optimized title here",
  "description": {
    "meta": "Meta description (155-160 chars)",
    "paragraph": "Paragraph content (250-350 chars)"
  },
  "keywords": "keyword1, keyword2, keyword3"
}`;

    console.log(`📤 Calling OpenAI API for keyword: ${keyword}`);
    const apiKeyPreview = openaiApiKey.substring(0, 10) + '...';
    console.log(`🔑 API Key preview: ${apiKeyPreview}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are an SEO expert. Generate natural, valuable, SEO-optimized content in JSON format.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.7,
          max_tokens: 1000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log(`📥 OpenAI API response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ OpenAI API error: ${response.status}`);
        console.error(`   Response: ${errorText.substring(0, 200)}`);
        throw new Error(
          `OpenAI API error: ${response.status} - ${errorText.substring(0, 100)}`
        );
      }

      const data = await response.json();
      console.log(`✅ OpenAI API response received`);

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('❌ Invalid OpenAI API response structure');
        console.error(`   Response: ${JSON.stringify(data).substring(0, 200)}`);
        throw new Error('Invalid OpenAI API response structure');
      }

      const contentText = data.choices[0].message.content;
      console.log(`📝 Parsing AI content: ${contentText.substring(0, 100)}...`);

      const content = JSON.parse(contentText) as AIContent;
      console.log(`✅ AI content generated successfully`);

      // Ensure description.og and description.twitter exist
      if (content.description && !content.description.og) {
        content.description.og = content.description.meta;
      }
      if (content.description && !content.description.twitter) {
        content.description.twitter = content.description.meta;
      }

      return content;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error(`❌ OpenAI API request timed out after ${timeout}ms`);
        throw new Error(`OpenAI API request timed out`);
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error('❌ Error generating AI content:', error.message);
    console.error('   Stack:', error.stack);
    return null;
  }
}

export type { AIContent, AIContentConfig };

