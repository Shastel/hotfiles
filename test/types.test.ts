import analyzeRepository, {
  analyzeRepository as analyzeNamed,
  type AnalyzeOptions,
  type CommitDetail,
  type HotFile
} from '..';

const options: AnalyzeOptions = { repo: '.', extensions: ['js'] };
const result: Promise<HotFile[]> = analyzeRepository(options);
const namedResult: Promise<HotFile[]> = analyzeNamed(options);

void result.then(files => {
  const detail: CommitDetail = files[0].details[0];
  console.log(detail.hash, detail.date, detail.message);
});
void namedResult;
