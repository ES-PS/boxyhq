import type { NextApiRequest, NextApiResponse } from 'next';

import jackson from '@lib/jackson';
import { strings } from '@lib/strings';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { checkLicense } = await jackson();

  if (!(await checkLicense())) {
    return res.status(404).json({
      error: {
        message: strings['enterprise_license_not_found'],
      },
    });
  }

  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return handlePOST(req, res);
      case 'GET':
        return handleGET(req, res);
      default:
        res.setHeader('Allow', 'POST, GET');
        res.status(405).json({ error: { message: `Method ${method} Not Allowed` } });
    }
  } catch (error: any) {
    const { message, statusCode = 500 } = error;

    return res.status(statusCode).json({ error: { message } });
  }
};

// Create new SAML Federation app
const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const { samlFederatedController } = await jackson();

  const { name, tenant, product, acsUrl, entityId } = req.body;

  const app = await samlFederatedController.app.create({
    name,
    tenant,
    product,
    acsUrl,
    entityId,
  });

  return res.status(201).json({ data: app });
};

// Get SAML Federation apps
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const { samlFederatedController } = await jackson();

  const { offset, limit } = req.query as { offset: string; limit: string };

  const pageOffset = parseInt(offset);
  const pageLimit = parseInt(limit);

  const apps = await samlFederatedController.app.getAll({ pageOffset, pageLimit });

  return res.json({ data: apps });
};

export default handler;
