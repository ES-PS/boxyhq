import type { NextPage, GetServerSideProps } from 'next';
import type { Directory, Group } from '@lib/jackson';
import React from 'react';
import jackson from '@lib/jackson';
import DirectoryTab from '@components/dsync/DirectoryTab';
import EmptyState from '@components/EmptyState';
import Link from 'next/link';
import { EyeIcon } from '@heroicons/react/outline';

const GroupsList: NextPage<{ directory: Directory, groups: Group[] }> = ({ directory, groups }) => {
  if(groups.length === 0) {
    return (
      <>
        <Header title={directory.name} />
        <DirectoryTab directory={directory} activeTab="groups" />
        <EmptyState title="No groups found" />
      </>
    )
  }

  return (
    <>
      <Header title={directory.name} />
      <DirectoryTab directory={directory} activeTab="groups" />
      <div className='rounded border w-3/4'>
        <table className="table-fixed w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
            <tr>
              <th scope="col" className="px-6 py-3 w-5/6">
                Name
              </th>
              <th scope="col" className="px-6 py-3 w-1/6">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              return (
                <tr key={group.id} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <td className="px-6 py-3">{group.name}</td>
                  <td className="px-6 py-3">
                    <Link href={`/admin/directory-sync/${directory.id}/groups/${group.id}`}>
                      <a>
                        <EyeIcon className='h-5 w-5' />
                      </a>
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

const Header = ({title}) => {
  return (
    <div className='flex items-center justify-between mb-4'>
      <h2 className='font-bold text-primary dark:text-white md:text-2xl'>{title}</h2>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { directoryId } = context.query;
  const { directorySync } = await jackson();

  return {
    props: {
      directory: await directorySync.directories.get(directoryId as string),
      groups: await directorySync.directories.listGroups({ directory: directoryId as string }),
    },
  }
}

export default GroupsList;