import { NextPage } from 'next';
import useSWR from 'swr';
import { fetcher } from '@lib/utils';
import Link from 'next/link';
import { DotsHorizontalIcon } from '@heroicons/react/outline';

const OAuthClient: NextPage = () => {
  const { data, error } = useSWR('/api/admin/providers', fetcher, { revalidateOnFocus: false });

  if (error) {
    return (
      <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded'>
        {error.info ? JSON.stringify(error.info) : error.status}
      </div>
    );
  }

  if (!data) {
    return <div>Loading...</div>;
  }

  if (!Array.isArray(data)) {
    return (
      <div>
        <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded'>Nothing to show</div>
      </div>
    );
  }

  return (
    <div>
      <div className='flex items-center justify-between'>
        <h2 className='md:text-2xl text-slate-900 dark:text-white font-bold'>SAML Configurations</h2>
        <Link href={'/admin/saml/new'}>
          <a className='bg-indigo-500 hover:bg-indigo-700 text-white font-medium py-2 px-2 md:px-4 rounded text-xs md:text-sm md:leading-6'>
            <span className='inline-block mr-1 md:mr-2' aria-hidden>
              +
            </span>
            Add Configuration
          </a>
        </Link>
      </div>
      <div className='overflow-auto shadow-md rounded-lg mt-6'>
        <table className='min-w-full'>
          <thead className='bg-gray-50 dark:bg-gray-700 shadow-md sm:rounded-lg'>
            <tr>
              <th
                scope='col'
                className='py-3 px-6 text-xs font-medium tracking-wider text-left text-gray-700 uppercase dark:text-gray-400'>
                Tenant
              </th>
              <th
                scope='col'
                className='py-3 px-6 text-xs font-medium tracking-wider text-left text-gray-700 uppercase dark:text-gray-400'>
                Product
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.map((provider) => (
              <tr key={provider.clientID} className='bg-white border-b dark:bg-gray-800 dark:border-gray-700'>
                <td className='py-4 px-6 text-sm font-medium text-gray-900 whitespace-nowrap dark:text-white'>
                  {provider.tenant}
                </td>
                <td className='py-4 px-6 text-sm text-gray-500 whitespace-nowrap dark:text-gray-400'>
                  {provider.product}
                </td>
                <td>
                  <Link href={`/admin/saml/edit/${provider.clientID}`}>
                    <a className='inline-flex items-center justify-center dark:text-white font-medium py-2 px-4 rounded leading-6'>
                      <DotsHorizontalIcon className='h-6 w-6' />
                    </a>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OAuthClient;
