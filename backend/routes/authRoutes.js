const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');
const {
  isOAuthProviderConfigured,
  getOAuthProviderStatus,
  redirectOAuthError,
  redirectOAuthSuccess,
} = require('../config/oauth');

// public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/social', authController.socialAuth);

router.get('/oauth/providers', (_req, res) => {
  res.json(getOAuthProviderStatus());
});

const ensureOAuthProvider = (provider) => (req, res, next) => {
  if (!isOAuthProviderConfigured(provider)) {
    return redirectOAuthError(res, provider, 'provider_not_configured');
  }
  return next();
};

const handleOAuthCallback = (provider, options = {}) => (req, res, next) => {
  passport.authenticate(
    provider,
    { session: false, ...options },
    (error, user) => {
      if (error) {
        console.error(`${provider} oauth callback error:`, error);
        return redirectOAuthError(res, provider, 'oauth_server_error');
      }

      if (!user) {
        return redirectOAuthError(res, provider, 'oauth_auth_failed');
      }

      return redirectOAuthSuccess(res, provider, user);
    },
  )(req, res, next);
};

router.get('/oauth/google', ensureOAuthProvider('google'), passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
router.get('/oauth/google/callback', ensureOAuthProvider('google'), handleOAuthCallback('google'));

router.get('/oauth/facebook', ensureOAuthProvider('facebook'), passport.authenticate('facebook', { scope: ['email'], session: false }));
router.get('/oauth/facebook/callback', ensureOAuthProvider('facebook'), handleOAuthCallback('facebook'));

router.get('/oauth/apple', ensureOAuthProvider('apple'), passport.authenticate('apple', { session: false }));
router.get('/oauth/apple/callback', ensureOAuthProvider('apple'), handleOAuthCallback('apple'));
router.post('/oauth/apple/callback', ensureOAuthProvider('apple'), handleOAuthCallback('apple'));

module.exports = router;
