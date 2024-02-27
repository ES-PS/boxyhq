import { useState } from 'react';
import { useFormik } from 'formik';
import { Button } from 'react-daisyui';
import { useTranslation } from 'next-i18next';

import { Card } from '../shared';
import type { SetupLink } from '../types';
import { defaultHeaders } from '../utils';
import { SetupLinkInfo } from './SetupLinkInfo';

type CreateSetupLinkInput = {
  name: string;
  tenant: string;
  product: string;
  expiryDays: number;
  service: 'sso';
  regenerate: boolean;
  redirectUrl: string;
  defaultRedirectUrl: string;
};

// TODO:
// Combine with DSyncForm

export const SSOForm = ({
  urls,
  expiryDays,
  onCreate,
  onError,
  excludeFields,
}: {
  urls: { createLink: string };
  expiryDays: number;
  onCreate: (data: SetupLink) => void;
  onError: (error: Error) => void;
  excludeFields?: 'product'[];
}) => {
  const { t } = useTranslation('common');
  const [setupLink, setSetupLink] = useState<SetupLink | null>(null);

  const formik = useFormik<CreateSetupLinkInput>({
    initialValues: {
      name: '',
      tenant: '',
      product: '',
      expiryDays,
      service: 'sso',
      regenerate: false,
      redirectUrl: '',
      defaultRedirectUrl: '',
    },
    onSubmit: async (values) => {
      const rawResponse = await fetch(urls.createLink, {
        method: 'POST',
        body: JSON.stringify(values),
        headers: defaultHeaders,
      });

      const response = await rawResponse.json();

      if (rawResponse.ok) {
        onCreate(response.data);
        formik.resetForm();
        setSetupLink(response.data);
      } else {
        onError(response.error);
      }
    },
  });

  return (
    <>
      {setupLink && <SetupLinkInfo setupLink={setupLink} onClose={() => setSetupLink(null)} />}
      <form onSubmit={formik.handleSubmit} method='POST'>
        <Card>
          <Card.Body>
            <Card.Description>
              Create a unique Setup Link to share with your customers so they can set Enterprise SSO
              connection with your app.
            </Card.Description>
            <label className='form-control w-full'>
              <div className='label'>
                <span className='label-text'>{t('bui-sl-dsync-name')}</span>
              </div>
              <input
                type='text'
                placeholder='Connection for acme'
                className='input input-bordered w-full text-sm'
                name='name'
                onChange={formik.handleChange}
                value={formik.values.name}
              />
            </label>
            <label className='form-control w-full'>
              <div className='label'>
                <span className='label-text'>{t('bui-sl-tenant')}</span>
              </div>
              <input
                type='text'
                placeholder='acme'
                className='input input-bordered w-full text-sm'
                name='tenant'
                required
                onChange={formik.handleChange}
                value={formik.values.tenant}
              />
            </label>
            {!excludeFields?.includes('product') && (
              <label className='form-control w-full'>
                <div className='label'>
                  <span className='label-text'>{t('bui-sl-product')}</span>
                </div>
                <input
                  type='text'
                  placeholder='MyApp'
                  className='input input-bordered w-full text-sm'
                  name='product'
                  required
                  onChange={formik.handleChange}
                  value={formik.values.product}
                />
              </label>
            )}
            <label className='form-control w-full'>
              <div className='label'>
                <span className='label-text'>{t('bui-sl-allowed-redirect-urls')}</span>
              </div>
              <textarea
                name='redirectUrl'
                placeholder='http://localhost:3366'
                className='textarea-bordered textarea whitespace-pre rounded'
                required
                onChange={formik.handleChange}
                value={formik.values.redirectUrl}
              />
            </label>
            <label className='form-control w-full'>
              <div className='label'>
                <span className='label-text'>{t('bui-sl-default-redirect-url')}</span>
              </div>
              <input
                type='url'
                placeholder='http://localhost:3366/login/saml'
                className='input input-bordered w-full text-sm'
                name='defaultRedirectUrl'
                required
                onChange={formik.handleChange}
                value={formik.values.defaultRedirectUrl}
              />
            </label>
            <label className='form-control w-full'>
              <div className='label'>
                <span className='label-text'>{t('bui-sl-expiry-days')}</span>
              </div>
              <input
                type='number'
                placeholder='7'
                className='input input-bordered w-full text-sm'
                name='expiryDays'
                required
                onChange={formik.handleChange}
                value={formik.values.expiryDays}
              />
            </label>
          </Card.Body>
          <Card.Footer>
            <Button type='submit' className='btn btn-primary btn-md'>
              {t('bui-sl-create')}
            </Button>
          </Card.Footer>
        </Card>
      </form>
    </>
  );
};
