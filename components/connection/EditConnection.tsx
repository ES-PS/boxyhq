import { useRouter } from 'next/router';
import { errorToast, successToast } from '@components/Toaster';
import { useTranslation } from 'next-i18next';
import { LinkBack } from '@components/LinkBack';
import type { OIDCSSORecord, SAMLSSORecord } from '@boxyhq/saml-jackson';
import { EditSAMLConnection, EditOIDCConnection } from '@boxyhq/react-ui/sso';
import { BOXYHQ_UI_CSS } from '@components/styles';

type EditProps = {
  connection: SAMLSSORecord | OIDCSSORecord;
  setupLinkToken?: string;
  isSettingsView?: boolean;
};

const EditConnection = ({ connection, setupLinkToken, isSettingsView = false }: EditProps) => {
  const router = useRouter();
  const { t } = useTranslation('common');

  const { id: connectionClientId } = router.query;

  const connectionIsSAML = 'idpMetadata' in connection && typeof connection.idpMetadata === 'object';
  const connectionIsOIDC = 'oidcProvider' in connection && typeof connection.oidcProvider === 'object';

  const backUrl = setupLinkToken
    ? `/setup/${setupLinkToken}`
    : isSettingsView
      ? '/admin/settings/sso-connection'
      : '/admin/sso-connection';

  const apiUrl = setupLinkToken ? `/api/setup/${setupLinkToken}/sso-connection` : `/api/admin/connections`;
  const connectionFetchUrl = setupLinkToken
    ? `/api/setup/${setupLinkToken}/sso-connection/${connectionClientId}`
    : `/api/admin/connections/${connectionClientId}`;

  return (
    <>
      <LinkBack href={backUrl} />
      <div>
        <div className='flex items-center justify-between'>
          <h2 className='mb-5 mt-5 font-bold text-gray-700 dark:text-white md:text-xl'>
            {t('edit_sso_connection')}
          </h2>
        </div>

        {connectionIsSAML && (
          <EditSAMLConnection
            displayHeader={false}
            excludeFields={['label']}
            classNames={BOXYHQ_UI_CSS}
            variant='advanced'
            urls={{
              delete: apiUrl,
              patch: apiUrl,
              get: connectionFetchUrl,
            }}
            successCallback={({ operation }) =>
              operation === 'UPDATE'
                ? successToast(t('saved'))
                : operation === 'DELETE'
                  ? successToast(t('sso_connection_deleted_successfully'))
                  : successToast(t('copied'))
            }
            errorCallback={(errMessage) => errorToast(errMessage)}
          />
        )}
        {connectionIsOIDC && (
          <EditOIDCConnection
            variant='advanced'
            urls={{
              delete: apiUrl,
              patch: apiUrl,
              get: connectionFetchUrl,
            }}
            successCallback={({ operation }) =>
              operation === 'UPDATE'
                ? successToast(t('saved'))
                : operation === 'DELETE'
                  ? successToast(t('sso_connection_deleted_successfully'))
                  : successToast(t('copied'))
            }
            errorCallback={(errMessage) => errorToast(errMessage)}
          />
        )}
      </div>
    </>
  );
};

export default EditConnection;
