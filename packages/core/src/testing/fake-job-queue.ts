import type { JobQueue } from "../ports/job-queue.ts";
import { Script } from "./scripted.ts";

export class FakeJobQueue implements JobQueue {
  readonly script = new Script<JobQueue>();

  async create_run_jobs(...args: Parameters<JobQueue["create_run_jobs"]>): Promise<Awaited<ReturnType<JobQueue["create_run_jobs"]>>> {
    return this.script.take("create_run_jobs", args) as Awaited<ReturnType<JobQueue["create_run_jobs"]>>;
  }
  async create_candidate_job(...args: Parameters<JobQueue["create_candidate_job"]>): Promise<Awaited<ReturnType<JobQueue["create_candidate_job"]>>> {
    return this.script.take("create_candidate_job", args) as Awaited<ReturnType<JobQueue["create_candidate_job"]>>;
  }
  async claim(...args: Parameters<JobQueue["claim"]>): Promise<Awaited<ReturnType<JobQueue["claim"]>>> {
    return this.script.take("claim", args) as Awaited<ReturnType<JobQueue["claim"]>>;
  }
  async renew_lease(...args: Parameters<JobQueue["renew_lease"]>): Promise<Awaited<ReturnType<JobQueue["renew_lease"]>>> {
    return this.script.take("renew_lease", args) as Awaited<ReturnType<JobQueue["renew_lease"]>>;
  }
  async set_tile_state(...args: Parameters<JobQueue["set_tile_state"]>): Promise<Awaited<ReturnType<JobQueue["set_tile_state"]>>> {
    return this.script.take("set_tile_state", args) as Awaited<ReturnType<JobQueue["set_tile_state"]>>;
  }
  async finish(...args: Parameters<JobQueue["finish"]>): Promise<Awaited<ReturnType<JobQueue["finish"]>>> {
    return this.script.take("finish", args) as Awaited<ReturnType<JobQueue["finish"]>>;
  }
  async requeue_expired(...args: Parameters<JobQueue["requeue_expired"]>): Promise<Awaited<ReturnType<JobQueue["requeue_expired"]>>> {
    return this.script.take("requeue_expired", args) as Awaited<ReturnType<JobQueue["requeue_expired"]>>;
  }
  async requeue_failed(...args: Parameters<JobQueue["requeue_failed"]>): Promise<Awaited<ReturnType<JobQueue["requeue_failed"]>>> {
    return this.script.take("requeue_failed", args) as Awaited<ReturnType<JobQueue["requeue_failed"]>>;
  }
  async cancel_run(...args: Parameters<JobQueue["cancel_run"]>): Promise<Awaited<ReturnType<JobQueue["cancel_run"]>>> {
    return this.script.take("cancel_run", args) as Awaited<ReturnType<JobQueue["cancel_run"]>>;
  }
  async jobs_for_run(...args: Parameters<JobQueue["jobs_for_run"]>): Promise<Awaited<ReturnType<JobQueue["jobs_for_run"]>>> {
    return this.script.take("jobs_for_run", args) as Awaited<ReturnType<JobQueue["jobs_for_run"]>>;
  }
  async is_cancelled(...args: Parameters<JobQueue["is_cancelled"]>): Promise<Awaited<ReturnType<JobQueue["is_cancelled"]>>> {
    return this.script.take("is_cancelled", args) as Awaited<ReturnType<JobQueue["is_cancelled"]>>;
  }
}
