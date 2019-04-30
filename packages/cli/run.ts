
interface Options {
  dir: string;
}
export default async function run({ dir }: Options) {
  console.log('running the card in', dir);
}
