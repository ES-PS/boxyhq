import { useState, type ReactElement } from 'react';
import type { GetServerSidePropsContext, InferGetServerSidePropsType } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';
import { useSession, getCsrfToken, signIn, SessionProvider } from 'next-auth/react';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { errorToast, successToast } from '@components/Toaster';
import { ButtonOutline } from '@components/ButtonOutline';
import Loading from '@components/Loading';
import { Login as SSOLogin } from '@boxyhq/react-ui';
import { adminPortalSSODefaults } from '@lib/env';

const Login = ({ csrfToken, tenant, product }: InferGetServerSidePropsType<typeof getServerSideProps>) => {
  const { t } = useTranslation('common');
  const router = useRouter();
  const { status } = useSession();
  const [authView, setAuthView] = useState<'magic-link' | 'email-password'>('magic-link');

  if (status === 'loading') {
    return <Loading />;
  }

  if (status === 'authenticated') {
    router.push('/admin/sso-connection');
    return;
  }

  const onSSOSubmit = async (ssoIdentifier: string) => {
    await signIn('boxyhq-saml', undefined, { client_id: ssoIdentifier });
  };

  return (
    <>
      <div className='flex min-h-screen flex-col items-center justify-center'>
        <div className='flex flex-col'>
          <div className='mt-4 border p-6 text-left shadow-md'>
            <div className='space-y-3'>
              <div className='flex justify-center'>
                <Image src='/logo.png' alt='BoxyHQ logo' width={50} height={50} />
              </div>
              <h2 className='text-center text-3xl font-extrabold text-gray-900'>BoxyHQ Admin Portal</h2>
              <p className='text-center text-sm text-gray-600'>
                {t('enterprise_readiness_for_b2b_saas_straight_out_of_the_box')}
              </p>
            </div>
            {authView === 'magic-link' ? <LoginWithMagicLink csrfToken={csrfToken} /> : <LoginWithEmail />}
            <SSOLogin
              buttonText={t('login_with_sso')}
              ssoIdentifier={`tenant=${tenant}&product=${product}`}
              onSubmit={onSSOSubmit}
              classNames={{
                container: 'mt-2',
                button: 'btn-outline btn-block btn',
              }}
              innerProps={{
                button: { 'data-testid': 'sso-login-button' },
              }}
            />
            <div className='flex justify-center pt-4'>
              <a
                href={`#${authView}`}
                onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                  e.preventDefault();
                  setAuthView(authView === 'magic-link' ? 'email-password' : 'magic-link');
                }}
                className='text-sm text-gray-600 underline underline-offset-4'>
                {authView === 'email-password' ? t('login_with_magic_link') : t('login_with_email_password')}
              </a>
            </div>
          </div>
        </div>
        <Link href='/.well-known' className='my-3 text-sm underline underline-offset-4' target='_blank'>
          {t('here_are_the_set_of_uris_you_would_need_access_to')}
        </Link>
      </div>
    </>
  );
};

Login.getLayout = function getLayout(page: ReactElement) {
  return <SessionProvider>{page}</SessionProvider>;
};

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { locale }: GetServerSidePropsContext = context;
  const { tenant, product } = adminPortalSSODefaults;
  return {
    props: {
      csrfToken: await getCsrfToken(context),
      tenant,
      product,
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
};

// Login with magic link
const LoginWithMagicLink = ({ csrfToken }: { csrfToken: string | undefined }) => {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);

    const response = await signIn('email', {
      email,
      csrfToken,
      redirect: false,
    });

    setLoading(false);

    if (!response) {
      return;
    }

    const { error } = response;

    if (error) {
      errorToast(error);
    } else {
      successToast(t('login_success_toast'));
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div className='mt-8'>
        <div>
          <label className='block' htmlFor='email'>
            {t('email')}
            <label>
              <input
                type='email'
                placeholder={t('email')}
                className='input-bordered input mb-5 mt-2 w-full rounded-md'
                required
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                value={email}
              />
            </label>
          </label>
        </div>
        <div className='flex items-baseline justify-between'>
          <ButtonOutline type='submit' loading={loading} className='btn-block'>
            {t('send_magic_link')}
          </ButtonOutline>
        </div>
      </div>
    </form>
  );
};

// Login with email and password
const LoginWithEmail = () => {
  const { t } = useTranslation('common');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);

    const response = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (!response) {
      return;
    }

    const { error } = response;

    if (error) {
      errorToast(error);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <div className='mt-8'>
        <div className='flex flex-col gap-4'>
          <label className='block' htmlFor='email'>
            {t('email')}
            <label>
              <input
                type='email'
                placeholder={t('email')}
                className='input-bordered input mt-2 w-full rounded-md'
                required
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                value={email}
              />
            </label>
          </label>
          <label className='block' htmlFor='password'>
            {t('password')}
            <label>
              <input
                type='password'
                placeholder={t('password')}
                className='input-bordered input mt-2 w-full rounded-md'
                required
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                value={password}
              />
            </label>
          </label>
          <ButtonOutline type='submit' loading={loading} className='btn-block'>
            {t('sign_in')}
          </ButtonOutline>
        </div>
      </div>
    </form>
  );
};

export default Login;
