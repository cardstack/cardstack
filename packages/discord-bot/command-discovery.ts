import glob from 'glob-promise';
import { Command, CommandDiscoverer } from './bot';

export class CommandDiscovery implements CommandDiscoverer {
  async discover(
    commandsDir: string
  ): Promise<{ dmCommands: Map<string, Command>; guildCommands: Map<string, Command> }> {
    let dmCommands = await this.gatherCommands(`${commandsDir}/dm/**/*.js`);
    let guildCommands = await this.gatherCommands(`${commandsDir}/guild/**/*.js`);
    return { dmCommands, guildCommands };
  }

  async gatherCommands(path: string): Promise<Map<string, Command>> {
    const commandModules: string[] = await glob(path);
    return new Map(
      await Promise.all(
        commandModules.map(async (module) => {
          const { name, run, aliases = [], description } = (await import(module)) as Command;
          return [
            name,
            {
              name,
              run,
              aliases,
              description,
            },
          ] as [string, Command];
        })
      )
    );
  }
}
