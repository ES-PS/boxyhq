import type { GetServerSidePropsContext, NextPage } from 'next';
import useSWR from 'swr';
import { useRouter } from 'next/router';

import { fetcher } from '@lib/ui/utils';
import Edit from '@components/connection/Edit';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

const EditConnection: NextPage = () => {
  const router = useRouter();

  const { id } = router.query;

  const { data: connection, error } = useSWR(id ? `/api/admin/connections/${id}` : null, fetcher, {
    revalidateOnFocus: false,
  });

  if (error) {
    return (
      <div className='rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700'>
        {error.info ? JSON.stringify(error.info) : error.status}
      </div>
    );
  }

  if (!connection) {
    return null;
  }

  return <Edit connection={connection} />;
};

export async function getServerSideProps({ locale }: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default EditConnection;
