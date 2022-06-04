import type { NextApiRequest, NextApiResponse } from 'next';
import jackson from '@lib/jackson';
import { extractAuthToken, bodyParser } from '@lib/utils';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { directorySync } = await jackson();
  const { method } = req;
  const { id } = req.query;

  if (!(await directorySync.directory.validateAPISecret(id as string, extractAuthToken(req)))) {
    return res.status(401).json({ data: null, error: { message: 'Unauthorized' } });
  }

  const request = {
    method: method as string,
    directory_id: id as string,
    body: bodyParser(req),
    query_params: {
      count: parseInt(req.query.count as string),
      startIndex: parseInt(req.query.startIndex as string),
    },
  };

  const { status, data } = await directorySync.groupsRequest.handle(request);

  return res.status(status).json(data);
}
