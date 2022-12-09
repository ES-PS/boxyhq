import type { NextApiRequest, NextApiResponse } from 'next';

import jackson from '@lib/jackson';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { checkLicense } = await jackson();

  if (!(await checkLicense())) {
    return res.status(404).json({
      error: { message: 'License not found. Please add a valid license to use this feature.' },
    });
  }

  const { method } = req;

  switch (method) {
    case 'GET':
      return handleGET(req, res);
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).json({ error: { message: `Method ${method} Not Allowed` } });
  }
}

// Display the metadata for the SAML federation
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const { samlFederatedController } = await jackson();

  const { appId } = req.query as { appId: string };

  try {
    const metadata = await samlFederatedController.app.getMetadata(appId);

    res.setHeader('Content-type', 'text/xml');
    res.status(200).send(metadata.xml);
  } catch (error: any) {
    const { message, statusCode = 500 } = error;

    return res.status(statusCode).json({
      error: { message },
    });
  }
};
