import { glob } from 'glob';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { ethers, FunctionFragment, ErrorFragment, EventFragment } from 'ethers';
import { abiFile, ignore, functionPath, errorPath, eventPath } from './constant';

interface AbiRoot {
  root: string[];
}

interface Stats {
  files: number;
  function: { saved: number; skipped: number };
  error: { saved: number; skipped: number };
  event: { saved: number; skipped: number };
}

export const generate = async () => {
  const startTime = Date.now();
  const cwd = process.cwd();

  const ymlContent = fs.readFileSync(path.join(cwd, 'abi-root.yml'), 'utf-8');
  const { root } = yaml.load(ymlContent) as AbiRoot;

  /**
   * abi-root.yml에 명시된 node_modules 경로 abi를 추적합니다
   */
  const patterns = root.map((p) => path.join(cwd, p, abiFile));
  const rootFiles = await glob(patterns, { ignore });

  /**
   * abi-json 디렉토레에 저장된 abi를 추적합니다
   */
  const localFiles = await glob(path.join(cwd, 'abi-json/**/*.json'), { ignore });
  const allFiles = [...rootFiles, ...localFiles];

  console.log(`\nFound ${allFiles.length} files (${rootFiles.length} from abi-root.yml, ${localFiles.length} from abi-json/)\n`);

  const stats: Stats = {
    files: allFiles.length,
    function: { saved: 0, skipped: 0 },
    error: { saved: 0, skipped: 0 },
    event: { saved: 0, skipped: 0 },
  };

  separateByJson(allFiles, stats);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  const total = (type: keyof Omit<Stats, 'files'>) => stats[type].saved + stats[type].skipped;

  const totalSaved = stats.function.saved + stats.error.saved + stats.event.saved;

  console.log('─'.repeat(40));
  console.log(`  files processed : ${stats.files}`);
  console.log(`  functions        : ${stats.function.saved} saved, ${stats.function.skipped} skipped (${total('function')} total)`);
  console.log(`  errors           : ${stats.error.saved} saved, ${stats.error.skipped} skipped (${total('error')} total)`);
  console.log(`  events           : ${stats.event.saved} saved, ${stats.event.skipped} skipped (${total('event')} total)`);
  console.log('─'.repeat(40));
  console.log(`  total saved      : ${totalSaved}`);
  console.log(`  done in ${elapsed}s\n`);
};

const separateByJson = (abiPaths: string[], stats: Stats) => {
  abiPaths.map((abiPath) => {
    const { abi } = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
    separateAbi(abi, stats);
  });
};

const separateAbi = (abi: any[], stats: Stats) => {
  const i = new ethers.Interface(abi);

  i.fragments.map((item, idx) => {
    if (item.type === 'function') {
      save((item as FunctionFragment).selector, abi[idx], functionPath, stats, 'function');
    } else if (item.type === 'error') {
      save((item as ErrorFragment).selector, abi[idx], errorPath, stats, 'error');
    } else if (item.type === 'event') {
      save((item as EventFragment).topicHash, abi[idx], eventPath, stats, 'event');
    }
  });
};

const strip0x = (hex: string) => hex.replace(/^0x/, '');

export const save = (selector: string, item: any, archivePath: string, stats?: Stats, type?: keyof Omit<Stats, 'files'>) => {
  const hexSelector = strip0x(selector);
  const index1 = hexSelector.slice(0, 2);
  const index2 = hexSelector.slice(2, 4);
  const filePath = `${archivePath}/${index1}/${index2}`;
  const filePathAbi = `${filePath}/abi.json`;

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(filePath, { recursive: true });
  }

  if (!fs.existsSync(filePathAbi)) {
    fs.writeFileSync(filePathAbi, JSON.stringify([item], null, 2));
    if (stats && type) stats[type].saved++;
  } else {
    const origin = fs.readFileSync(filePathAbi, 'utf8');
    const data = JSON.parse(origin);
    const isDuplicate = data.some((existing: any) => JSON.stringify(existing) === JSON.stringify(item));

    if (!isDuplicate) {
      data.push(item);
      fs.writeFileSync(filePathAbi, JSON.stringify(data, null, 2));
      if (stats && type) stats[type].saved++;
    } else {
      if (stats && type) stats[type].skipped++;
    }
  }
};
