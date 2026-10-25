import type { CollabCommands } from "../ports/collab-commands.ts";
import { Script } from "./scripted.ts";

export class FakeCollabCommands implements CollabCommands {
  readonly script = new Script<CollabCommands>();

  async lock_and_snapshot(...args: Parameters<CollabCommands["lock_and_snapshot"]>): Promise<Awaited<ReturnType<CollabCommands["lock_and_snapshot"]>>> {
    return this.script.take("lock_and_snapshot", args) as Awaited<ReturnType<CollabCommands["lock_and_snapshot"]>>;
  }
  async apply_edit(...args: Parameters<CollabCommands["apply_edit"]>): Promise<Awaited<ReturnType<CollabCommands["apply_edit"]>>> {
    return this.script.take("apply_edit", args) as Awaited<ReturnType<CollabCommands["apply_edit"]>>;
  }
  async set_mode(...args: Parameters<CollabCommands["set_mode"]>): Promise<Awaited<ReturnType<CollabCommands["set_mode"]>>> {
    return this.script.take("set_mode", args) as Awaited<ReturnType<CollabCommands["set_mode"]>>;
  }
}
