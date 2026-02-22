import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
  'poll plaid sync fallback',
  { hours: 6 },
  internal.plaid.pollAllOwnersInternal,
  {}
);

export default crons;
