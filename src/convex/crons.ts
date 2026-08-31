import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Reconciles inspection windows: any delivered transaction whose inspection
// deadline passed without a dispute is auto-accepted and released server-side.
crons.interval("inspection auto-release", { minutes: 5 }, internal.jobs.inspectionAutoRelease);

export default crons;