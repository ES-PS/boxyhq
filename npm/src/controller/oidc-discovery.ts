import { IOidcDiscoveryController, JacksonOption } from '../typings';
import { JacksonError } from './error';
import { exportPublicKeyJWK, generateJwkThumbprint, importJWTPublicKey, isJWSKeyPairLoaded } from './utils';

export class OidcDiscoveryController implements IOidcDiscoveryController {
  private opts: JacksonOption;

  constructor({ opts }) {
    this.opts = opts;
  }

  openidConfig() {
    return {
      issuer: this.opts.samlAudience!,
      authorization_endpoint: `${this.opts.externalUrl}/api/oauth/authorize`,
      token_endpoint: `${this.opts.externalUrl}/api/oauth/token`,
      userinfo_endpoint: `${this.opts.externalUrl}/api/oauth/userinfo`,
      jwks_uri: `${this.opts.externalUrl}/oauth/jwks`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['plain', 'S256'],
    };
  }

  async jwks() {
    const { jwtSigningKeys } = this.opts.openid;
    if (!isJWSKeyPairLoaded(jwtSigningKeys)) {
      throw new JacksonError('JWT signing keys are not loaded', 501);
    }
    const importedPublicKey = await importJWTPublicKey(
      this.opts.openid.jwtSigningKeys.public,
      this.opts.openid.jwsAlg
    );
    const publicKeyJWK = await exportPublicKeyJWK(importedPublicKey);
    const jwkThumbprint = await generateJwkThumbprint(publicKeyJWK);
    const jwks = {
      keys: [{ ...publicKeyJWK, kid: jwkThumbprint, alg: this.opts.openid.jwsAlg, use: 'sig' }],
    };

    return jwks;
  }
}
