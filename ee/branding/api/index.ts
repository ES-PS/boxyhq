import type { NextApiRequest, NextApiResponse } from 'next';
import jackson from '@lib/jackson';
import { branding as defaultBranding } from '@lib/settings';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return handleGET(req, res);
      default:
        res.setHeader('Allow', 'GET');
        res.status(405).json({ error: { message: `Method ${method} Not Allowed` } });
    }
  } catch (error: any) {
    const { message, statusCode = 500 } = error;

    return res.status(statusCode).json({ error: { message } });
  }
};

const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const { brandingController, checkLicense } = await jackson();

  // If the licence is not valid, return the default branding
  if (!(await checkLicense())) {
    return res.json({ data: defaultBranding });
  }

  const brandingSettings = await brandingController?.get();

  const branding = {
    logoUrl: brandingSettings?.logoUrl || defaultBranding.logoUrl,
    primaryColor: brandingSettings?.primaryColor || defaultBranding.primaryColor,
    faviconUrl: brandingSettings?.faviconUrl || defaultBranding.faviconUrl,
    companyName: brandingSettings?.companyName || defaultBranding.companyName,
  };

  return res.json({ data: branding });
};

export default handler;
