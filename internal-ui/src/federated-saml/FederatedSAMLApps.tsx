import useSWR from 'swr';
import fetcher from '../utils/fetcher';
import { Loading, Table, EmptyState, Error, Pagination } from '../shared';
import { useTranslation } from 'next-i18next';
import { SAMLFederationApp } from '@boxyhq/saml-jackson';
import { PencilIcon } from '@heroicons/react/24/outline';
import { TableBodyType } from '../shared/Table';
import { pageLimit } from '../shared/Pagination';
import { usePaginate } from '../hooks';

type ExcludeFields = keyof Pick<SAMLFederationApp, 'product'>;

export const FederatedSAMLApps = ({
  urls,
  excludeFields,
  onEdit,
}: {
  urls: { get: string };
  excludeFields?: ExcludeFields[];
  onEdit?: (app: SAMLFederationApp) => void;
}) => {
  const { t } = useTranslation('common');
  const { paginate, setPaginate, pageTokenMap, setPageTokenMap } = usePaginate();

  let getAppsUrl = `${urls.get}?offset=${paginate.offset}&limit=${pageLimit}`;

  // For DynamoDB
  if (paginate.offset > 0 && pageTokenMap[paginate.offset - pageLimit]) {
    getAppsUrl += `&pageToken=${pageTokenMap[paginate.offset - pageLimit]}`;
  }

  const { data, isLoading, error } = useSWR<{ data: SAMLFederationApp[] }>(getAppsUrl, fetcher);

  if (isLoading) {
    return <Loading />;
  }

  if (error) {
    return <Error message={error.message} />;
  }

  if (!data) {
    return null;
  }

  const apps = data?.data || [];
  const noApps = apps.length === 0 && paginate.offset === 0;
  const noMoreResults = apps.length === 0 && paginate.offset > 0;

  if (noApps) {
    return <EmptyState title={t('bui-fs-no-apps')} description={t('bui-fs-no-apps-desc')} />;
  }

  let columns = [
    {
      key: 'name',
      label: t('bui-shared-name'),
      wrap: true,
      dataIndex: 'name',
    },
    {
      key: 'tenant',
      label: t('bui-shared-tenant'),
      wrap: true,
      dataIndex: 'tenant',
    },
    {
      key: 'product',
      label: t('bui-shared-product'),
      wrap: true,
      dataIndex: 'product',
    },
  ];

  if (excludeFields) {
    columns = columns.filter((column) => !excludeFields.includes(column.key as ExcludeFields));
  }

  const cols = columns.map(({ label }) => label);

  const body: TableBodyType[] = apps.map((app) => {
    return {
      id: app.id,
      cells: columns.map((column) => {
        const dataIndex = column.dataIndex as keyof typeof app;
        return {
          wrap: column.wrap,
          text: app[dataIndex] as string,
        };
      }),
    };
  });

  // Action column & buttons
  cols.push(t('bui-shared-actions'));

  body.forEach((row) => {
    row.cells.push({
      actions: [
        {
          text: t('bui-shared-edit'),
          onClick: () => onEdit?.(apps.find((app) => app.id === row.id)!),
          icon: <PencilIcon className='w-5' />,
        },
      ],
    });
  });

  return (
    <>
      <Table noMoreResults={noMoreResults} cols={cols} body={body} />
      <Pagination
        itemsCount={apps.length}
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
  );
};
