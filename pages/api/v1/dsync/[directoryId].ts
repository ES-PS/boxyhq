import type { NextApiRequest, NextApiResponse } from 'next';
import jackson from '@lib/jackson';
import { defaultHandler } from '@lib/api';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await defaultHandler(req, res, {
    GET: handleGET,
    PATCH: handlePATCH,
    DELETE: handleDELETE,
  });
}

// Get directory by id
const handleGET = async (req: NextApiRequest, res: NextApiResponse) => {
  const { directorySyncController } = await jackson();

  const { directoryId } = req.query as { directoryId: string };

  const { data, error } = await directorySyncController.directories.get(directoryId);

  if (error) {
    return res.status(error.code).json({ error });
  }

  return res.status(200).json({ data });
};

// Delete directory by id
const handleDELETE = async (req: NextApiRequest, res: NextApiResponse) => {
  const { directorySyncController } = await jackson();

  const { directoryId } = req.query as { directoryId: string };

  await directorySyncController.directories.delete(directoryId);

  return res.status(200).json({ data: {} });
};

// Update directory
const handlePATCH = async (req: NextApiRequest, res: NextApiResponse) => {
  const { directorySyncController } = await jackson();

  const { directoryId } = req.query as { directoryId: string };

  const { data, error } = await directorySyncController.directories.update(directoryId, req.body);

  if (error) {
    res.status(error.code).json({ error });
  }

  res.json({ data });
};
