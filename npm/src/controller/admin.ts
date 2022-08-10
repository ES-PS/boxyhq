import { IAdminController, Storable } from '../typings';

export class AdminController implements IAdminController {
  configStore: Storable;

  constructor({ configStore }) {
    this.configStore = configStore;
  }

  public async getAllConfig(pageOffset?: number, pageLimit?: number): Promise<Partial<any>[]> {
    const configList = (await this.configStore.getAll(pageOffset, pageLimit)) as Partial<any>[];
    if (!configList || !configList.length) {
      return [];
    }
    return configList;
  }
}
