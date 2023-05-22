import { SyncGroup } from './groupSync';
import { getGogleProvider } from './google';
import type { EventCallback, IDirectoryConfig, IGroups, JacksonOption } from '../../typings';

interface SyncParams {
  groups: IGroups;
  opts: JacksonOption;
  directories: IDirectoryConfig;
  callback?: EventCallback | undefined;
}

export const sync = async (params: SyncParams) => {
  const { groups, opts, directories, callback } = params;

  const googleProvider = getGogleProvider({ directories, opts });

  // Add new providers here
  const providers = [googleProvider.provider];

  for (const provider of providers) {
    console.info(`Running the sync for ${provider.name}`);
    await new SyncGroup({ groups, directories, callback, provider }).sync();
  }
};
