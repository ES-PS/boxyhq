import useSWR from 'swr';
import { SAMLFederationApp } from '@boxyhq/saml-jackson';
import fetcher from '../utils/fetcher';
import { EditBranding } from './EditBranding';
import { Edit } from './Edit';
import { EditAttributesMapping } from './EditAttributesMapping';
import { DeleteCard, Loading, DeleteConfirmationModal } from '../shared';
import { useTranslation } from 'next-i18next';
import { useState } from 'react';
import { defaultHeaders } from '../utils/request';
import { PageHeader } from '../shared';

export const EditFederatedSAMLApp = ({
  urls,
  onError,
  onUpdate,
  onDelete,
  excludeFields,
}: {
  urls: { getApp: string; updateApp: string; deleteApp: string };
  onUpdate?: (data: SAMLFederationApp) => void;
  onError?: (error: Error) => void;
  onDelete?: () => void;
  excludeFields?: 'product'[];
}) => {
  const { t } = useTranslation('common');
  const [delModalVisible, setDelModalVisible] = useState(false);

  const { data, isLoading, error, mutate } = useSWR<{ data: SAMLFederationApp }>(urls.getApp, fetcher);

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    onError?.(error);
    return;
  }

  if (!data) {
    return null;
  }

  const app = data?.data;

  const deleteApp = async () => {
    try {
      await fetch(urls.deleteApp, { method: 'DELETE', headers: defaultHeaders });
      setDelModalVisible(false);
      onDelete?.();
    } catch (error: any) {
      onError?.(error);
    }
  };

  return (
    <>
      <PageHeader title={t('bui-fs-edit-app')} />
      <div className='flex flex-col gap-6'>
        <Edit
          app={app}
          urls={{ patch: urls.updateApp }}
          onError={onError}
          onUpdate={(data) => {
            mutate({ data });
            onUpdate?.(data);
          }}
          excludeFields={excludeFields}
        />
        <EditAttributesMapping
          app={app}
          urls={{ patch: urls.updateApp }}
          onError={onError}
          onUpdate={(data) => {
            mutate({ data });
            onUpdate?.(data);
          }}
        />
        <EditBranding
          app={app}
          urls={{ patch: urls.updateApp }}
          onError={onError}
          onUpdate={(data) => {
            mutate({ data });
            onUpdate?.(data);
          }}
        />
        <DeleteCard
          title={t('bui-fs-delete-app-title')}
          description={t('bui-fs-delete-app-desc')}
          buttonLabel={t('bui-shared-delete')}
          onClick={() => setDelModalVisible(true)}
        />
        <DeleteConfirmationModal
          title={t('bui-fs-delete-app-title')}
          description={t('bui-fs-delete-app-desc')}
          visible={delModalVisible}
          onConfirm={() => deleteApp()}
          onCancel={() => setDelModalVisible(false)}
        />
      </div>
    </>
  );
};
