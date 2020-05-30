import { fileExists } from './lib';
import { DataScrapper } from './DataScrapper';
import { generateMeta } from './meta-data';

async function main() {
  if (!fileExists('meta.json')) {
    generateMeta();
  }
  const scrapper = new DataScrapper();
  await scrapper.run();
}
main();
