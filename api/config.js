export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({
    apiKey: process.env.GEMINI_API_KEY || '',
    imageModel: process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image',
    llmModel: process.env.GEMINI_LLM_MODEL || 'gemini-3.8-flash',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY)
  });
}
