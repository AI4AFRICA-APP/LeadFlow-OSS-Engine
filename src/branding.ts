export const BRANDING = {
  appName: import.meta.env.VITE_APP_NAME || 'LeadFlow-OSS-Engine',
  tagline:
    import.meta.env.VITE_APP_TAGLINE ||
    'Lead discovery and outreach automation',
  logoUrl: import.meta.env.VITE_APP_LOGO_URL || '/leadflow-logo.svg',
  websiteUrl:
    import.meta.env.VITE_APP_WEBSITE ||
    'https://github.com/AI4AFRICA-APP/LeadFlow-OSS-Engine',
  footerText:
    import.meta.env.VITE_APP_FOOTER_TEXT || 'Built by the open-source community',
  versionLabel: import.meta.env.VITE_APP_VERSION || 'Community Edition v1.0.0',
};
