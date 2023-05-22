import type { Credentials, OAuth2Client } from 'google-auth-library';

import { JacksonError, apiError } from '../../../controller/error';
import type { IDirectoryConfig, Directory, Response } from '../../types';

const scope = [
  'https://www.googleapis.com/auth/admin.directory.user.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.readonly',
  'https://www.googleapis.com/auth/admin.directory.group.member.readonly',
];

interface GoogleAuthParams {
  authClient: OAuth2Client;
  directories: IDirectoryConfig;
}

export class GoogleAuth {
  private authClient: OAuth2Client;
  private directories: IDirectoryConfig;

  constructor({ authClient, directories }: GoogleAuthParams) {
    this.directories = directories;
    this.authClient = authClient;
  }

  // Generate the Google API authorization URL
  async generateAuthorizationUrl(params: {
    directoryId: string;
  }): Promise<Response<{ authorizationUrl: string }>> {
    const { directoryId } = params;

    try {
      const { data: directory } = await this.directories.get(directoryId);

      // if (!directory) {
      //   throw new JacksonError('Directory not found', 400);
      // }

      // if (directory.type !== 'google-api') {
      //   throw new JacksonError('Directory is not a Google Directory', 400);
      // }

      const response = this.authClient.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope,
        state: JSON.stringify({ directoryId }),
      });

      const data = {
        authorizationUrl: response,
      };

      return { data, error: null };
    } catch (error: any) {
      return apiError(error);
    }
  }

  // Get the Google API access token from the authorization code
  async getAccessToken(params: { directoryId: string; code: string }): Promise<Response<Credentials>> {
    const { directoryId, code } = params;

    try {
      const { data: directory } = await this.directories.get(directoryId);

      // if (!directory) {
      //   throw new JacksonError('Directory not found', 400);
      // }

      const { tokens } = await this.authClient.getToken(code);

      return { data: tokens, error: null };
    } catch (error: any) {
      return apiError(error);
    }
  }

  // Set the Google API access token and refresh token for the directory
  async setToken(params: {
    directoryId: string;
    accessToken: Credentials['access_token'];
    refreshToken: Credentials['refresh_token'];
  }): Promise<Response<Directory>> {
    const { directoryId, accessToken, refreshToken } = params;

    try {
      if (!accessToken || !refreshToken) {
        throw new JacksonError('Missing required parameters', 400);
      }

      const { data: directory } = await this.directories.get(directoryId);

      if (!directory) {
        throw new JacksonError('Directory not found', 400);
      }

      const { data } = await this.directories.update(directoryId, {
        googleAuth: {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      });

      if (!data) {
        throw new JacksonError('Failed to update directory', 400);
      }

      return { data, error: null };
    } catch (error: any) {
      return apiError(error);
    }
  }
}
