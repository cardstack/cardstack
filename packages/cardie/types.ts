import { Message } from 'discord.js';

interface Command {
  name: string;
  description: string;
  execute(message: Message, args: string[]): Promise<void>;
}

interface RepositoryConfig {
  name: string;
  alias?: string;
  default_branch?: string;
}
interface WorkflowInfo {
  id: number;
  repository: RepositoryConfig;
}
export { Command, RepositoryConfig, WorkflowInfo };
