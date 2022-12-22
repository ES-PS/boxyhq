import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

import type { Project } from 'types/retraced';
import { getToken } from '@lib/retraced';
import { jacksonOptions } from '@lib/env';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  switch (method) {
    case 'GET':
      return getProject(req, res);
    default:
      res.setHeader('Allow', ['GET']);
      res.status(405).json({
        data: null,
        error: { message: `Method ${method} Not Allowed` },
      });
  }
}

const getProject = async (req: NextApiRequest, res: NextApiResponse) => {
  const token = await getToken();

  const { id } = req.query;

  const { data } = await axios.get<{ project: Project }>(
    `${jacksonOptions.retraced?.host}/admin/v1/project/${id}`,
    {
      headers: {
        Authorization: `id=${token.id} token=${token.token}`,
      },
    }
  );

  return res.status(201).json({
    data,
    error: null,
  });
};
