import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { NextPage } from 'next';
import { useRouter } from 'next/router';
import type { SAMLTrace } from '@boxyhq/saml-jackson';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { materialOceanic } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import useSWR from 'swr';
import { ApiSuccess, ApiError } from 'types';
import { fetcher } from '@lib/ui/utils';
import { errorToast } from '@components/Toaster';
import Loading from '@components/Loading';
import { useTranslation } from 'react-i18next';
import { LinkBack } from '@components/LinkBack';
import { Badge } from 'react-daisyui';

const DescriptionListItem = ({ term, value }: { term: string; value: string | JSX.Element }) => (
  <div className='px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6'>
    <dt className='text-sm font-medium text-gray-500'>{term}</dt>
    <dd className='mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0'>{value}</dd>
  </div>
);

const SAMLTraceInspector: NextPage = () => {
  const { t } = useTranslation('common');

  const router = useRouter();

  const { traceId } = router.query as { traceId: string };

  const { data, error, isLoading } = useSWR<ApiSuccess<SAMLTrace>, ApiError>(
    `/api/admin/saml-tracer/${traceId}`,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  if (error) {
    errorToast(error.message);
    return null;
  }

  if (isLoading) {
    return <Loading />;
  }

  if (!data) return null;

  const trace = data.data;
  const assertionType = trace.context.samlResponse ? 'Response' : 'Request';

  return (
    <>
      <LinkBack onClick={() => router.back()} />
      <div className='mt-5 overflow-hidden bg-white shadow sm:rounded-lg'>
        <div className='px-4 py-5 sm:px-6'>
          <h3 className='text-base font-semibold leading-6 text-gray-900'>Trace details</h3>
          <p className='mt-1 flex max-w-2xl gap-6 text-sm text-gray-500'>
            <span className='whitespace-nowrap'>
              <span className='font-medium text-gray-500'>TraceID:</span>
              <span className='ml-2 font-bold text-gray-700'> {traceId}</span>
            </span>
            <span className='whitespace-nowrap'>
              <span className='font-medium text-gray-500'>{t('assertion_type')}:</span>
              <span className='ml-2 font-bold text-gray-700'>{assertionType}</span>
            </span>
            <span className='whitespace-nowrap'>
              <span className='font-medium text-gray-500'>{t('sp_protocol')}:</span>
              <Badge
                color='primary'
                size='md'
                className='ml-2 font-mono uppercase text-white'
                aria-label='SP Protocol'>
                {trace.context.requestedOIDCFlow
                  ? 'OIDC'
                  : trace.context.isSAMLFederated
                  ? t('saml_federation')
                  : 'OAuth 2.0'}
              </Badge>
            </span>
          </p>
        </div>
        <div className='border-t border-gray-200'>
          <dl>
            {typeof trace.timestamp === 'number' && (
              <DescriptionListItem term='Timestamp' value={new Date(trace.timestamp).toLocaleString()} />
            )}
            <DescriptionListItem term='Error' value={trace.error} />
            {trace.context.tenant && <DescriptionListItem term='Tenant' value={trace.context.tenant} />}
            {trace.context.product && <DescriptionListItem term='Product' value={trace.context.product} />}
            {trace.context.clientID && (
              <DescriptionListItem term='SSO Connection Client ID' value={trace.context.clientID} />
            )}
            {trace.context.issuer && <DescriptionListItem term='Issuer' value={trace.context.issuer} />}
            {trace.context.acsUrl && <DescriptionListItem term='ACS URL' value={trace.context.acsUrl} />}
            {trace.context.entityId && (
              <DescriptionListItem term='Entity ID' value={trace.context.entityId} />
            )}
            {trace.context.providerName && (
              <DescriptionListItem term='Entity ID' value={trace.context.providerName} />
            )}
            {assertionType === 'Response' && (
              <DescriptionListItem
                term='SAML Response'
                value={
                  <SyntaxHighlighter language='xml' style={materialOceanic}>
                    {trace.context.samlResponse}
                  </SyntaxHighlighter>
                }
              />
            )}
            {assertionType === 'Request' && trace.context.samlRequest && (
              <DescriptionListItem
                term='SAML Request'
                value={
                  <SyntaxHighlighter language='xml' style={materialOceanic}>
                    {trace.context.samlRequest}
                  </SyntaxHighlighter>
                }
              />
            )}

            {typeof trace.context.profile === 'object' && trace.context.profile && (
              <DescriptionListItem
                term='Profile'
                value={
                  <SyntaxHighlighter language='json' style={materialOceanic}>
                    {JSON.stringify(trace.context.profile)}
                  </SyntaxHighlighter>
                }
              />
            )}
          </dl>
        </div>
      </div>
    </>
  );
};

export default SAMLTraceInspector;

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ['common'])),
    },
  };
}
