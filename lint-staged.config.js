module.exports = {
  '*.{js,css,ts,tsx,md}': ['prettier --write', 'eslint'],
  '**/*.ts?(x)': () => 'tsc -p tsconfig.json --noEmit',
};
