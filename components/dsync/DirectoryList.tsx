import EmptyState from '@components/EmptyState';
import EyeIcon from '@heroicons/react/24/outline/EyeIcon';
import LinkIcon from '@heroicons/react/24/outline/LinkIcon';
import PencilIcon from '@heroicons/react/24/outline/PencilIcon';
import PlusIcon from '@heroicons/react/24/outline/PlusIcon';
import type { Directory } from '@boxyhq/saml-jackson';
import { useTranslation } from 'next-i18next';
import { LinkPrimary } from '@components/LinkPrimary';
import { IconButton } from '@components/IconButton';
import { useRouter } from 'next/router';
import { pageLimit, Pagination, NoMoreResults } from '@components/Pagination';
import useDirectoryProviders from '@lib/ui/hooks/useDirectoryProviders';
import useSWR from 'swr';
import type { ApiError, ApiSuccess } from 'types';
import usePaginate from '@lib/ui/hooks/usePaginate';
import { fetcher } from '@lib/ui/utils';
import Loading from '@components/Loading';
import { errorToast } from '@components/Toaster';

const DirectoryList = ({ setupLinkToken }: { setupLinkToken?: string }) => {
  const { t } = useTranslation('common');
  const { paginate, setPaginate } = usePaginate();
  const router = useRouter();

  const displayTenantProduct = setupLinkToken ? false : true;
  const getDirectoriesUrl = setupLinkToken
    ? `/api/setup/${setupLinkToken}/directory-sync`
    : '/api/admin/directory-sync';
  const createDirectoryUrl = setupLinkToken
    ? `/setup/${setupLinkToken}/directory-sync/new`
    : '/admin/directory-sync/new';

  const { providers, isLoading: isLoadingProviders } = useDirectoryProviders(setupLinkToken);

  const { data, error } = useSWR<ApiSuccess<Directory[]>, ApiError>(
    `${getDirectoriesUrl}?offset=${paginate.offset}&limit=${pageLimit}`,
    fetcher
  );

  if (!data || isLoadingProviders) {
    return <Loading />;
  }

  if (error) {
    errorToast(error.message);
    return null;
  }

  const directories = data.data || [];
  const noDirectories = directories.length === 0 && paginate.offset === 0;
  const noMoreResults = paginate.offset > 0 && directories.length === 0;

  return (
    <>
      <div className='mb-5 flex items-center justify-between'>
        <h2 className='font-bold text-gray-700 dark:text-white md:text-xl'>{t('directory_sync')}</h2>
        <div className='flex gap-2'>
          <LinkPrimary Icon={PlusIcon} href={createDirectoryUrl}>
            {t('new_directory')}
          </LinkPrimary>
          {!setupLinkToken && (
            <LinkPrimary Icon={LinkIcon} href='/admin/directory-sync/setup-link/new'>
              {t('new_setup_link')}
            </LinkPrimary>
          )}
        </div>
      </div>
      {noDirectories ? (
        <EmptyState title={t('no_directories_found')} href={createDirectoryUrl} />
      ) : (
        <>
          <div className='rounder border'>
            <table className='w-full text-left text-sm text-gray-500 dark:text-gray-400'>
              <thead className='bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-700 dark:text-gray-400'>
                <tr className='hover:bg-gray-50'>
                  <th scope='col' className='px-6 py-3'>
                    {t('name')}
                  </th>
                  {displayTenantProduct && (
                    <>
                      <th scope='col' className='px-6 py-3'>
                        {t('tenant')}
                      </th>
                      <th scope='col' className='px-6 py-3'>
                        {t('product')}
                      </th>
                    </>
                  )}
                  <th scope='col' className='px-6 py-3'>
                    {t('type')}
                  </th>
                  <th scope='col' className='px-6 py-3'>
                    {t('actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {directories &&
                  directories.map((directory) => {
                    return (
                      <tr
                        key={directory.id}
                        className='border-b bg-white last:border-b-0 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800'>
                        <td className='whitespace-nowrap px-6 py-3 text-sm text-gray-500 dark:text-gray-400'>
                          {directory.name}
                        </td>
                        {displayTenantProduct && (
                          <>
                            <td className='px-6'>{directory.tenant}</td>
                            <td className='px-6'>{directory.product}</td>
                          </>
                        )}
                        <td className='px-6'>{providers && providers[directory.type]}</td>
                        <td className='px-6'>
                          <span className='inline-flex items-baseline'>
                            <IconButton
                              tooltip={t('view')}
                              Icon={EyeIcon}
                              className='mr-3 hover:text-green-400'
                              onClick={() => {
                                router.push(
                                  setupLinkToken
                                    ? `/setup/${setupLinkToken}/directory-sync/${directory.id}`
                                    : `/admin/directory-sync/${directory.id}`
                                );
                              }}
                            />
                            <IconButton
                              tooltip={t('edit')}
                              Icon={PencilIcon}
                              className='hover:text-green-400'
                              onClick={() => {
                                router.push(
                                  setupLinkToken
                                    ? `/setup/${setupLinkToken}/directory-sync/${directory.id}/edit`
                                    : `/admin/directory-sync/${directory.id}/edit`
                                );
                              }}
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                {noMoreResults && <NoMoreResults colSpan={displayTenantProduct ? 5 : 3} />}
              </tbody>
            </table>
          </div>
          <Pagination
            itemsCount={directories.length}
            offset={paginate.offset}
            onPrevClick={() => {
              setPaginate({
                offset: paginate.offset - pageLimit,
              });
            }}
            onNextClick={() => {
              setPaginate({
                offset: paginate.offset + pageLimit,
              });
            }}
          />
        </>
      )}
    </>
  );
};

export default DirectoryList;
