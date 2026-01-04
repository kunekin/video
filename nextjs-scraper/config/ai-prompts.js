module.exports = {
  contentGeneration: {
    template: `Generate SEO-optimized video content for keyword: "{keyword}"

Generate comprehensive, SEO-focused content that will rank well in search engines. All content must be highly relevant to the keyword and optimized for search visibility.

Requirements:
1. TITLE (60-70 characters, SEO-optimized):
   - Include the keyword naturally
   - Compelling and click-worthy
   - Focus on search intent

2. DESCRIPTION - META (155-160 characters, for search engine results):
   - Include keyword in first 120 characters
   - Compelling call-to-action
   - Keyword-optimized for SERP

3. DESCRIPTION - OG (200 characters, for social media):
   - Engaging and shareable
   - Include keyword naturally
   - Story-telling style for social engagement

4. DESCRIPTION - TWITTER (200 characters, for Twitter cards):
   - Attention-grabbing
   - Can use emoji if appropriate
   - Include keyword
   - Shareable format

5. DESCRIPTION - PARAGRAPH (250-350 characters, for visible content):
   - Natural, informative language
   - Include keyword multiple times naturally
   - Detailed and engaging
   - SEO-optimized with keyword density

6. KEYWORDS (comma-separated, 5-10 keywords):
   - Primary keyword first
   - Related LSI keywords
   - Long-tail variations
   - SEO-focused keyword selection

Return ONLY a valid JSON object:
{
  "title": "SEO-optimized title here",
  "description": {
    "meta": "Meta description (155-160 chars)",
    "og": "OG description (200 chars)",
    "twitter": "Twitter description (200 chars)",
    "paragraph": "Paragraph content (250-350 chars)"
  },
  "keywords": "keyword1, keyword2, keyword3, keyword4, keyword5"
}

Focus on SEO: keyword placement, search intent, and ranking potential.`,
    
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 1000
  }
};

