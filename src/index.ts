import { fileExists } from './lib';
import { DataScrapper } from './DataScrapper';
import { generateMeta } from './meta-data';

async function main() {
  const scrapper = new DataScrapper();
  await scrapper.run();
  if (!fileExists('meta.json')) {
    generateMeta();
  }
}
main();
