const jwt = require('jsonwebtoken');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const { Strategy: FacebookStrategy } = require('passport-facebook');
const AppleStrategy = require('passport-apple');

const prisma = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'secret_tam_thoi';
const OAUTH_CALLBACK_PATH = '/auth/callback';

const configuredProviders = new Set();
let initialized = false;

const getBackendBaseUrl = () => (process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
const getFrontendBaseUrl = () => (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');

const buildFrontendCallbackUrl = (query = {}) => {
  const url = new URL(`${getFrontendBaseUrl()}${OAUTH_CALLBACK_PATH}`);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

const getCallbackUrl = (provider) => {
  const envKey = `${provider.toUpperCase()}_CALLBACK_URL`;
  return process.env[envKey] || `${getBackendBaseUrl()}/api/auth/oauth/${provider}/callback`;
};

const safeProviderId = (providerId) => String(providerId || '').replace(/[^a-zA-Z0-9_.-]/g, '_');

const buildDisplayName = ({ name, email, provider, providerId }) => {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (normalizedName) return normalizedName;

  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (normalizedEmail) return normalizedEmail.split('@')[0] || 'OAuth User';

  return `${provider}_${safeProviderId(providerId) || 'user'}`;
};

const buildEmail = ({ provider, providerId, email }) => {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (normalizedEmail) return normalizedEmail;

  const fallbackId = safeProviderId(providerId) || 'user';
  return `oauth_${provider}_${fallbackId}@oauth.local`;
};

const upsertOAuthUser = async ({ provider, providerId, email, name, avatar }) => {
  const normalizedEmail = buildEmail({ provider, providerId, email });
  const normalizedName = buildDisplayName({ name, email: normalizedEmail, provider, providerId });
  const normalizedAvatar = typeof avatar === 'string' && avatar.trim() ? avatar.trim() : null;

  let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedName,
        avatar: normalizedAvatar,
        role: 'USER',
      },
    });

    return user;
  }

  const updatePayload = {};
  if (!user.avatar && normalizedAvatar) updatePayload.avatar = normalizedAvatar;
  if (!user.name && normalizedName) updatePayload.name = normalizedName;

  if (Object.keys(updatePayload).length > 0) {
    user = await prisma.user.update({ where: { id: user.id }, data: updatePayload });
  }

  return user;
};

const buildAuthPayload = (user) => {
  const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      points: user.points,
      totalDeposited: user.totalDeposited,
      avatar: user.avatar,
    },
  };
};

const decodeAppleIdToken = (idToken) => {
  if (!idToken) return null;
  try {
    return jwt.decode(idToken);
  } catch (_error) {
    return null;
  }
};

const setupOAuthStrategies = () => {
  if (initialized) return;

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser((id, done) => done(null, { id }));

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      'google',
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: getCallbackUrl('google'),
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile?.emails?.[0]?.value || null;
            const name = profile?.displayName || null;
            const avatar = profile?.photos?.[0]?.value || null;
            const providerId = profile?.id;

            const user = await upsertOAuthUser({ provider: 'google', providerId, email, name, avatar });
            return done(null, user);
          } catch (error) {
            return done(error);
          }
        },
      ),
    );
    configuredProviders.add('google');
  }

  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(
      'facebook',
      new FacebookStrategy(
        {
          clientID: process.env.FACEBOOK_APP_ID,
          clientSecret: process.env.FACEBOOK_APP_SECRET,
          callbackURL: getCallbackUrl('facebook'),
          profileFields: ['id', 'displayName', 'photos', 'email'],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile?.emails?.[0]?.value || null;
            const name = profile?.displayName || null;
            const avatar = profile?.photos?.[0]?.value || null;
            const providerId = profile?.id;

            const user = await upsertOAuthUser({ provider: 'facebook', providerId, email, name, avatar });
            return done(null, user);
          } catch (error) {
            return done(error);
          }
        },
      ),
    );
    configuredProviders.add('facebook');
  }

  const applePrivateKeyString = process.env.APPLE_PRIVATE_KEY
    ? process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : process.env.APPLE_PRIVATE_KEY_BASE64
      ? Buffer.from(process.env.APPLE_PRIVATE_KEY_BASE64, 'base64').toString('utf8')
      : null;

  const hasAppleConfig =
    process.env.APPLE_CLIENT_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APPLE_KEY_ID &&
    (applePrivateKeyString || process.env.APPLE_PRIVATE_KEY_PATH);

  if (hasAppleConfig) {
    passport.use(
      'apple',
      new AppleStrategy(
        {
          clientID: process.env.APPLE_CLIENT_ID,
          teamID: process.env.APPLE_TEAM_ID,
          keyID: process.env.APPLE_KEY_ID,
          callbackURL: getCallbackUrl('apple'),
          privateKeyString: applePrivateKeyString || undefined,
          privateKeyLocation: process.env.APPLE_PRIVATE_KEY_PATH || undefined,
          passReqToCallback: true,
        },
        async (req, _accessToken, _refreshToken, params, profile, done) => {
          try {
            const idToken = typeof params === 'string' ? params : params?.id_token;
            const decoded = decodeAppleIdToken(idToken);

            const bodyProfile = req?.appleProfile || null;
            const providerId = decoded?.sub || profile?.id || bodyProfile?.sub || bodyProfile?.id || 'apple_user';

            const email = bodyProfile?.email || decoded?.email || null;

            const composedName =
              bodyProfile?.name && typeof bodyProfile.name === 'object'
                ? `${bodyProfile.name.firstName || ''} ${bodyProfile.name.lastName || ''}`.trim()
                : null;

            const name = composedName || decoded?.name || profile?.displayName || null;

            const user = await upsertOAuthUser({
              provider: 'apple',
              providerId,
              email,
              name,
              avatar: null,
            });

            return done(null, user);
          } catch (error) {
            return done(error);
          }
        },
      ),
    );

    configuredProviders.add('apple');
  }

  initialized = true;
};

const isOAuthProviderConfigured = (provider) => configuredProviders.has(provider);

const getOAuthProviderStatus = () => ({
  google: configuredProviders.has('google'),
  facebook: configuredProviders.has('facebook'),
  apple: configuredProviders.has('apple'),
});

const redirectOAuthError = (res, provider, errorCode) => {
  return res.redirect(buildFrontendCallbackUrl({ provider, error: errorCode }));
};

const redirectOAuthSuccess = (res, provider, user) => {
  const payload = buildAuthPayload(user);
  return res.redirect(buildFrontendCallbackUrl({ provider, token: payload.token }));
};

module.exports = {
  setupOAuthStrategies,
  isOAuthProviderConfigured,
  getOAuthProviderStatus,
  redirectOAuthError,
  redirectOAuthSuccess,
};