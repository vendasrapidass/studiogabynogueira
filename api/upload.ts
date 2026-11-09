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

    const customUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    let errTmp = '';
    let errCatbox = '';
    let errLitter = '';
    let errImgur = '';

    // Provedor 1: Tmpfiles.org (Instantâneo com link direto /dl/)
    try {
      const formTmp = new FormData();
      const blobTmp = new Blob([buffer], { type: 'image/jpeg' });
      formTmp.append('file', blobTmp, safeFilename);

      const tmpRes = await fetch('https://tmpfiles.org/api/v1/upload', {
        method: 'POST',
        headers: { 'User-Agent': customUA },
        body: formTmp,
      });

      if (tmpRes.ok) {
        const tmpJson = await tmpRes.json();
        if (tmpJson?.data?.url) {
          const directUrl = tmpJson.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
          return res.status(200).json({ success: true, url: directUrl });
        } else {
          errTmp = `No url in json: ${JSON.stringify(tmpJson).slice(0, 100)}`;
        }
      } else {
        errTmp = `HTTP ${tmpRes.status}: ${(await tmpRes.text()).slice(0, 100)}`;
      }
    } catch (eTmp: any) {
      errTmp = eTmp?.message || String(eTmp);
      console.warn('Tmpfiles provider failed, attempting fallback...', eTmp);
    }

    // Provedor 2: Catbox.moe (Hospedagem Permanente Gratuita e Ultrarrápida)
    try {
      const formData = new FormData();
      formData.append('reqtype', 'fileupload');
      const blob = new Blob([buffer], { type: 'image/jpeg' });
      formData.append('fileToUpload', blob, safeFilename);

      const catboxRes = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        headers: { 'User-Agent': customUA },
        body: formData,
      });

      if (catboxRes.ok) {
        const url = (await catboxRes.text()).trim();
        if (url && url.startsWith('http')) {
          return res.status(200).json({ success: true, url });
        } else {
          errCatbox = `Status 200 but body: ${url.slice(0, 100)}`;
        }
      } else {
        errCatbox = `HTTP ${catboxRes.status}: ${(await catboxRes.text()).slice(0, 100)}`;
      }
    } catch (e1: any) {
      errCatbox = e1?.message || String(e1);
      console.warn('Catbox provider failed, attempting fallback...', e1);
    }

    // Provedor 3: Litterbox (Fallback 72h)
    try {
      const formData2 = new FormData();
      formData2.append('reqtype', 'fileupload');
      formData2.append('time', '72h');
      const blob2 = new Blob([buffer], { type: 'image/jpeg' });
      formData2.append('fileToUpload', blob2, safeFilename);

      const litterRes = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
        method: 'POST',
        headers: { 'User-Agent': customUA },
        body: formData2,
      });

      if (litterRes.ok) {
        const url = (await litterRes.text()).trim();
        if (url && url.startsWith('http')) {
          return res.status(200).json({ success: true, url });
        } else {
          errLitter = `Body: ${url.slice(0, 100)}`;
        }
      } else {
        errLitter = `HTTP ${litterRes.status}: ${(await litterRes.text()).slice(0, 100)}`;
      }
    } catch (e2: any) {
      errLitter = e2?.message || String(e2);
      console.warn('Litterbox provider failed, attempting fallback...', e2);
    }

    // Provedor 4: Imgur como último recurso
    try {
      const imgurForm = new FormData();
      imgurForm.append('image', cleanBase64);
      imgurForm.append('type', 'base64');

      const imgurRes = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: { Authorization: 'Client-ID 546c25a59c58ad7' },
        body: imgurForm,
      });

      const imgurData = await imgurRes.json().catch(() => ({}));
      if (imgurData.success && imgurData.data?.link) {
        return res.status(200).json({ success: true, url: imgurData.data.link });
      } else {
        errImgur = `HTTP ${imgurRes.status}: ${JSON.stringify(imgurData).slice(0, 100)}`;
      }
    } catch (e3: any) {
      errImgur = e3?.message || String(e3);
      console.warn('Imgur provider fallback failed...', e3);
    }

    return res.status(500).json({
      error: 'Não foi possível hospedar a imagem em nenhum provedor.',
      details: { errTmp, errCatbox, errLitter, errImgur }
    });
  } catch (error: any) {
    console.error('Fatal Upload Error:', error);
    return res.status(500).json({ error: error?.message || 'Internal Server Error' });
  }
}
