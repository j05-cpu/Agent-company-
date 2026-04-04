export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, system } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    // ── STEP 1: Tavily Real-Time Search ──
    let freshContext = '';
    try {
      if (process.env.TAVILY_API_KEY) {
        // Extract search query from prompt (first 120 chars as query)
        const searchQuery = prompt.substring(0, 120).replace(/\n/g, ' ').trim();

        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: process.env.TAVILY_API_KEY,
            query: searchQuery,
            search_depth: 'basic',
            max_results: 3,
            include_answer: true,
            include_raw_content: false
          })
        });

        if (tavilyRes.ok) {
          const tavilyData = await tavilyRes.json();

          // Build fresh context from search results
          if (tavilyData.answer) {
            freshContext += `REAL-TIME WEB DATA (2026):\n${tavilyData.answer}\n\n`;
          }
          if (tavilyData.results?.length > 0) {
            freshContext += 'LATEST SOURCES:\n';
            tavilyData.results.slice(0, 3).forEach((r, i) => {
              freshContext += `${i + 1}. ${r.title}: ${r.content?.substring(0, 300)}\n`;
            });
            freshContext += '\n';
          }
        }
      }
    } catch (searchErr) {
      // Search failed — continue without fresh data
      console.log('Tavily search failed:', searchErr.message);
    }

    // ── STEP 2: Build Enhanced System Prompt ──
    const baseSystem = system || 'You are a senior startup consultant. Write reports DIRECTLY in English. ### for headers, ** for bold, - for bullets. No preamble. India market focus.';

    const enhancedSystem = freshContext
      ? `${baseSystem}\n\nUSE THIS REAL-TIME 2026 DATA IN YOUR RESPONSE:\n${freshContext}\nAlways cite real current market data when available.`
      : baseSystem;

    // ── STEP 3: Groq Generation ──
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: enhancedSystem },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json({ error: error.error?.message || 'Groq API error' });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    if (!text || text.length < 50) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    // Return text + flag if fresh data was used
    return res.status(200).json({
      text,
      freshData: !!freshContext
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || 'Server error' });
  }
}
