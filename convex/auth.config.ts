const domain =
  process.env.CLERK_ISSUER_URL ||
  process.env.CLERK_ISSUER ||
  process.env.CLERK_DOMAIN ||
  "https://popular-corgi-5.clerk.accounts.dev";

const applicationID = "convex";

export default {
  providers: [
    {
      domain,
      applicationID,
    },
  ],
};