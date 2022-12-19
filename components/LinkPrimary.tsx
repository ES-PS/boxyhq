import { LinkBase } from './LinkBase';

export const LinkPrimary = ({
  href,
  children,
  Icon = null,
  ...others
}: {
  href: string;
  children: any;
  Icon?: any;
}) => {
  return (
    <LinkBase href={href} className='btn-primary' Icon={Icon} {...others}>
      {children}
    </LinkBase>
  );
};
