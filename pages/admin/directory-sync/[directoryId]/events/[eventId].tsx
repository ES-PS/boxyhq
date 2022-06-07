import type { NextPage, GetServerSideProps } from 'next';
import type { Directory, WebhookEventLog } from '@lib/jackson';
import React from 'react';
import jackson from '@lib/jackson';
import DirectoryTab from '@components/dsync/DirectoryTab';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter/dist/cjs';
import { coy } from 'react-syntax-highlighter/dist/cjs/styles/prism';

const EventInfo: NextPage<{ directory: Directory, event: WebhookEventLog }> = ({ directory, event }) => {
  return (
    <div>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='font-bold text-primary dark:text-white md:text-2xl'>{directory.name}</h2>
      </div>
      <DirectoryTab directory={directory} activeTab="events" />
      <div className='text-sm border rounded'>
        <SyntaxHighlighter language="json" style={coy}>
          {JSON.stringify(event, null, 3)}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { directoryId, eventId } = context.query;
  const { directorySync } = await jackson();

  const directory = await directorySync.directories.get(directoryId as string);

  const event = await directorySync.events
    .with(directory.tenant, directory.product)
    .get(eventId as string);

  return {
    props: {
      directory,
      event,
    },
  }
}

export default EventInfo;