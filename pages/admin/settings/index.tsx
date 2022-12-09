import type { GetServerSidePropsContext, NextPage } from 'next';
// import Add from '@components/connection/Add';
import { useRouter } from 'next/router'; 
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';

const Settings: NextPage = () => {
  const router = useRouter();
  router.replace('/admin/settings/sso-connection');
  return null;
};

export async function getStaticProps({ locale }: GetServerSidePropsContext) {
  return {
    props: {
      ...(locale ? await serverSideTranslations(locale, ['common']) : {}),
    },
  };
}

export default Settings;
