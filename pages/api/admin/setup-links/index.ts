import type { NextApiRequest, NextApiResponse } from 'next';
import jackson from '@lib/jackson';
import { checkSession } from '@lib/middleware';

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await handlePOST(req, res);
      case 'GET':
        return await handleGET(req, res);
      case 'DELETE':
        return await handleDELETE(req, res);
      default:
        res.setHeader('Allow', 'POST, GET, DELETE');
        res.status(405).json({ error: { message: `Method ${method} Not Allowed` } });
    }
  } catch (error: any) {
    const { message, statusCode = 500 } = error;

    return res.status(statusCode).json({ error: { message } });
  }
};

// Create a new setup link
const handlePOST = async (req: NextApiRequest, res: NextApiResponse) => {
  const { setupLinkController } = await jackson();

  const { tenant, product, service, regenerate } = req.body;

  const setupLink = await setupLinkController.create({
    tenant,
    product,
    service,
    regenerate,
  });

  return res.status(201).json({ data: setupLink });
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const { setupLinkController } = await jackson();

  const { setupID } = req.query as { setupID: string };

  await setupLinkController.remove(setupID);

  return res.json({ data: {} });
};

const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const { setupLinkController } = await jackson();

  const { offset, limit, token, service } = req.query as {
    offset: string;
    limit: string;
    token: string;
    service: string;
  };

  if (!token && !service) {
    return res.status(404).json({
      error: {
        message: 'Setup link is invalid',
        code: 404,
      },
    });
  }

  // Get a setup link by token
  if (token) {
    const setupLink = await setupLinkController.getByToken(token);

    return res.json({ data: setupLink });
  }

  // Get a setup link by service
  if (service) {
    const setupLinks = await setupLinkController.getByService(service, +(offset || 0), +(limit || 0));

    return res.json({ data: setupLinks });
  }
};

export default checkSession(handler);
