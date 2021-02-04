interface RawCard {
  'schema.js': string;
}

interface CompiledCard {
  modelSource: string;
}

export class Compiler {
  async compile(cardSource: RawCard): Promise<CompiledCard> {
    return {
      modelSource: cardSource['schema.js'],
    };
  }
}
