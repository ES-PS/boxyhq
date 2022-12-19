import type { NextPage, GetServerSidePropsContext } from 'next';
import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

import jackson from '@lib/jackson';
import { inferSSRProps } from '@lib/inferSSRProps';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { errorToast, successToast } from '@components/Toast';
import { Button } from '@components/Button';
import { LinkOutline } from '@components/LinkOutline';

const Edit: NextPage<inferSSRProps<typeof getServerSideProps>> = ({
  directory: { id, name, log_webhook_events, webhook },
}) => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const [directory, setDirectory] = React.useState({
    name,
    log_webhook_events,
    webhook_url: webhook.endpoint,
    webhook_secret: webhook.secret,
  });

  const [loading, setLoading] = React.useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);

    const rawResponse = await fetch(`/api/admin/directory-sync/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(directory),
    });

    setLoading(false);

    const response = await rawResponse.json();

    if ('error' in response) {
      errorToast(response.error.message);
      return null;
    }

    if (rawResponse.ok) {
      successToast(t('directory_updated_successfully'));
      router.replace('/admin/directory-sync');
    }
  };

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const target = event.target as HTMLInputElement;
    const value = target.type === 'checkbox' ? target.checked : target.value;

    setDirectory({
      ...directory,
      [target.id]: value,
    });
  };

  return (
    <div>
      <LinkOutline href='/admin/directory-sync' Icon={ArrowLeftIcon}>
        {t('back')}
      </LinkOutline>
      <h2 className='mb-5 mt-5 font-bold text-gray-700 md:text-xl'>{t('update_directory')}</h2>
      <div className='min-w-[28rem] rounded border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800 md:w-3/4 md:max-w-lg'>
        <form onSubmit={onSubmit}>
          <div className='flex flex-col space-y-3'>
            <div className='form-control w-full'>
              <label className='label'>
                <span className='label-text'>{t('directory_name')}</span>
              </label>
              <input
                type='text'
                id='name'
                className='input-bordered input w-full'
                required
                onChange={onChange}
                value={directory.name}
              />
            </div>
            <div className='form-control w-full'>
              <label className='label'>
                <span className='label-text'>{t('webhook_url')}</span>
              </label>
              <input
                type='text'
                id='webhook_url'
                className='input-bordered input w-full'
                onChange={onChange}
                value={directory.webhook_url}
              />
            </div>
            <div className='form-control w-full'>
              <label className='label'>
                <span className='label-text'>{t('webhook_secret')}</span>
              </label>
              <input
                type='text'
                id='webhook_secret'
                className='input-bordered input w-full'
                onChange={onChange}
                value={directory.webhook_secret}
              />
            </div>
            <div className='form-control w-full py-2'>
              <div className='flex items-center'>
                <input
                  id='log_webhook_events'
                  type='checkbox'
                  checked={directory.log_webhook_events}
                  onChange={onChange}
                  className='h-4 w-4 rounded border-gray-300 bg-gray-100 text-blue-600 focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600'
                />
                <label className='ml-2 text-sm font-medium text-gray-900 dark:text-gray-300'>
                  {t('enable_webhook_events_logging')}
                </label>
              </div>
            </div>
            <div>
              <Button type='submit' color='primary' loading={loading}>
                {t('save_changes')}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { directoryId } = context.query;
  const { directorySyncController } = await jackson();
  const { locale }: GetServerSidePropsContext = context;

  const { data: directory } = await directorySyncController.directories.get(directoryId as string);

  if (!directory) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      directory,
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
};

export default Edit;
