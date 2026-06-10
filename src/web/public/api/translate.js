export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { texts, target = 'th' } = req.body ?? {};
  if (!Array.isArray(texts) || !texts.length) return res.status(400).json({ error: 'texts array required' });

  try {
    const results = await Promise.all(
      texts.map(async (text) => {
        if (!text?.trim()) return text;
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
        const r = await fetch(url);
        const data = await r.json();
        return data[0].map(s => s[0]).join('');
      })
    );
    return res.status(200).json({ results });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
