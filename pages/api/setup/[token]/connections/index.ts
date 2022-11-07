import type { NextApiRequest, NextApiResponse } from 'next';
import jackson, { GetConnectionsQuery } from '@lib/jackson';
import { strategyChecker } from '@lib/utils';

export const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const { method } = req;
  const { setupLinkController } = await jackson();
  const token = req.query.token;
  let data, error;
  if (!token) {
    data = undefined;
    error = {
      code: 404,
      message: 'Invalid setup token!',
    };
    res.status(error ? error.code : 201).json({ data, error });
  } else {
    const { data: setup, error: err } = await setupLinkController.getByToken(token);
    if (err) {
      res.status(err ? err.code : 201).json({ err });
    } else if (!setup) {
      data = undefined;
      error = {
        code: 404,
        message: 'Invalid setup token!',
      };
      res.status(error ? error.code : 201).json({ data, error });
    } else if (setup?.validTill < +new Date()) {
      data = undefined;
      error = {
        code: 400,
        message: 'Setup Link expired!',
      };
      return res.status(error ? error.code : 201).json({ data, error });
    } else {
      switch (method) {
        case 'GET':
          return handleGET(res, setup);
        case 'POST':
          return handlePOST(req, res, setup);
        case 'PATCH':
          return handlePATCH(req, res, setup);
        case 'DELETE':
          return handleDELETE(req, res, setup);
        default:
          res.setHeader('Allow', ['GET', 'POST', 'PATCH', 'DELETE']);
          res.status(405).json({ data: null, error: { message: `Method ${method} Not Allowed` } });
      }
    }
  }
};

const handleGET = async (res: NextApiResponse, setup: any) => {
  const { connectionAPIController } = await jackson();
  return res.json(
    await connectionAPIController.getConnections({
      tenant: setup.tenant,
      product: setup.product,
    } as GetConnectionsQuery)
  );
};

const handlePOST = async (req: NextApiRequest, res: NextApiResponse, setup: any) => {
  const { connectionAPIController } = await jackson();
  const body = {
    ...req.body,
    tenant: setup?.tenant,
    product: setup?.product,
  };
  const { isSAML, isOIDC } = strategyChecker(req);
  if (isSAML) {
    return res.json(await connectionAPIController.createSAMLConnection(body));
  } else if (isOIDC) {
    return res.json(await connectionAPIController.createOIDCConnection(body));
  } else {
    throw { message: 'Missing SSO connection params', statusCode: 400 };
  }
};

const handleDELETE = async (req: NextApiRequest, res: NextApiResponse, setup: any) => {
  const { connectionAPIController } = await jackson();
  const body = {
    ...req.body,
    tenant: setup?.tenant,
    product: setup?.product,
  };
  res.status(204).end(await connectionAPIController.deleteConnections(body));
};

const handlePATCH = async (req: NextApiRequest, res: NextApiResponse, setup: any) => {
  const { connectionAPIController } = await jackson();
  const body = {
    ...req.body,
    tenant: setup?.tenant,
    product: setup?.product,
  };
  const { isSAML, isOIDC } = strategyChecker(req);
  if (isSAML) {
    res.status(204).end(await connectionAPIController.updateSAMLConnection(body));
  } else if (isOIDC) {
    res.status(204).end(await connectionAPIController.updateOIDCConnection(body));
  } else {
    throw { message: 'Missing SSO connection params', statusCode: 400 };
  }
};

export default handler;
