import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowLeftIcon,
  ClipboardCopyIcon,
  CheckIcon
} from '@heroicons/react/outline';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import {
    NewProject
} from '../../interfaces/project';

const ViewToken = (props: NewProject) => {
    console.log(props.project.tokens)
  const showAPIKeys = props.project.tokens.length > 0;
  const [copied, setCopied] = useState<boolean>(false);
  const apiKeys = props.project.tokens;
  const showCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Link href='/admin/retraced'>
        <a className='link-primary'>
          <ArrowLeftIcon aria-hidden className='h-4 w-4' />
          <span className='ml-2'>Back</span>
        </a>
      </Link>
      {showAPIKeys && (
        <div className='mt-6 overflow-auto rounded-lg shadow-md'>
          <table className='min-w-full'>
            <thead className='bg-gray-50 shadow-md dark:bg-gray-700 sm:rounded-lg'>
              <tr>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-400'>
                  Product
                </th>
                <th
                  scope='col'
                  className='px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700 dark:text-gray-400'>
                  Environment
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((token) => (
                <tr
                  key={token.environment_id}
                  className='border-b bg-white dark:border-gray-700 dark:bg-gray-800'>
                  <td className='whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900 dark:text-white'>
                    {token.name}
                  </td>
                  <td className='whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-gray-400'>
                    {token.token}
                  </td>
                  <td>
                    <a className='link-primary cursor-pointer'>
                      <CopyToClipboard text={token.token} onCopy={showCopied}>
                        <span>
                          <ClipboardCopyIcon className='h-5 w-5 text-secondary' />
                        </span>
                      </CopyToClipboard>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="inline-flex items-center place-content-center">
          {copied && <CheckIcon className='h-5 w-5 text-secondary'>Copied</CheckIcon>}
          </div>
        </div>
      )}
    </>
  );
};

export default ViewToken;
