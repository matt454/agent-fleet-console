import type { Instance, Job } from "../models/fleet.ts";
import { JobsTable } from "../components/JobRows.tsx";

export function JobsPanel({ selected, jobs, cancelJob }: { selected: Instance; jobs: Job[]; cancelJob: (job: Job) => void }) {
  return (
    <div className="tab-content jobs-panel">
      <JobsTable
        jobs={jobs}
        cancelJob={cancelJob}
        description={jobs.length ? `${jobs.length} recorded for ${selected.name}` : `No jobs recorded for ${selected.name}.`}
      />
    </div>
  );
}
