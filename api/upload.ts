export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, filename } = req.body || {};

    if (!image) {
      return res.status(400).json({ error: 'Nenhuma imagem enviada.' });
    }

    // Limpa prefixo data:image/...;base64, se presente
    const cleanBase64 = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const safeFilename = filename || `comprovante-${Date.now()}.jpg`;

    // -------------------------------------------------------------------------
    // 1. PROVEDOR PRINCIPAL: IMGUR (Links curtos oficiais https://i.imgur.com/...)
    // -------------------------------------------------------------------------
    const imgurClientIds = [
      '546c25a59c58ad7',
      'c8c692df5e0cba0',
      'e9df0fb99f6dcf7'
    ];

    for (const clientId of imgurClientIds) {
      try {
        const imgurForm = new FormData();
        imgurForm.append('image', cleanBase64);
        imgurForm.append('type', 'base64');

        const imgurRes = await fetch('https://api.imgur.com/3/image', {
          method: 'POST',
          headers: { Authorization: `Client-ID ${clientId}` },
          body: imgurForm,
        });

        if (imgurRes.ok) {
          const imgurData = await imgurRes.json().catch(() => ({}));
          if (imgurData.success && imgurData.data?.link) {
            let link = imgurData.data.link;
            if (link.startsWith('http://')) {
              link = link.replace('http://', 'https://');
            }
            console.log(`[Upload] Sucesso no Imgur (${clientId}):`, link);
            return res.status(200).json({ success: true, url: link });
          }
        }
      } catch (eImgur: any) {
        console.warn(`[Upload] Falha no Client-ID ${clientId}:`, eImgur?.message || eImgur);
      }
    }

    // -------------------------------------------------------------------------
    // 2. PROVEDOR FALLBACK: Catbox.moe (Link permanente direto sem expiração)
    // -------------------------------------------------------------------------
    try {
      const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const catboxForm = new FormData();
      catboxForm.append('reqtype', 'fileupload');
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      catboxForm.append('fileToUpload', blob, safeFilename);

      const catboxRes = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        headers: { 'User-Agent': customUA },
        body: catboxForm,
      });

      if (catboxRes.ok) {
        const url = (await catboxRes.text()).trim();
        if (url && url.startsWith('http')) {
          console.log('[Upload] Sucesso no Catbox (fallback permanente):', url);
          return res.status(200).json({ success: true, url });
        }
      }
    } catch (eCatbox: any) {
      console.warn('[Upload] Falha no Catbox fallback:', eCatbox?.message || eCatbox);
    }

    // -------------------------------------------------------------------------
    // 3. PROVEDOR FALLBACK 2: Litterbox (Permanência de 72h)
    // -------------------------------------------------------------------------
    try {
      const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const litterForm = new FormData();
      litterForm.append('reqtype', 'fileupload');
      litterForm.append('time', '72h');
      const blob2 = new Blob([buffer], { type: 'image/jpeg' });
      litterForm.append('fileToUpload', blob2, safeFilename);

      const litterRes = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        headers: { 'User-Agent': customUA },
        body: litterForm,
      });

      if (litterRes.ok) {
        const url = (await litterRes.text()).trim();
        if (url && url.startsWith('http')) {
          console.log('[Upload] Sucesso no Litterbox (fallback):', url);
          return res.status(200).json({ success: true, url });
        }
      }
    } catch (eLitter: any) {
      console.warn('[Upload] Falha no Litterbox fallback:', eLitter?.message || eLitter);
    }

    return res.status(500).json({
      error: 'Não foi possível hospedar a imagem em nenhum provedor no momento.',
    });
  } catch (error: any) {
    console.error('[Upload] Erro fatal:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}
