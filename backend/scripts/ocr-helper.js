'use strict';

// Sets up or runs the PaddleOCR helper (backend/ocr-helper), the optional second reader for handwritten answers.
//   npm run ocr:setup    once: makes backend/ocr-helper/.venv (Python 3.10-3.13 needed) and installs PaddleOCR
//   npm run ocr:helper   runs the helper by itself (npm start also starts it when it is set up)
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HELPER_DIR = path.join(__dirname, '..', 'ocr-helper');
const VENV = path.join(HELPER_DIR, '.venv');
const venvPython = () => path.join(VENV, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

// The first Python 3.10-3.13 found on this computer: [command, args...] or null.
function findPython() {
  const candidates = process.platform === 'win32'
    ? [['py', '-3.13'], ['py', '-3.12'], ['py', '-3.11'], ['py', '-3.10'], ['python'], ['python3']]
    : [['python3.13'], ['python3.12'], ['python3.11'], ['python3.10'], ['python3'], ['python']];
  for (const [cmd, ...args] of candidates) {
    const r = spawnSync(cmd, [...args, '-c', 'import sys; print("%d.%d" % sys.version_info[:2])'], { encoding: 'utf8' });
    const version = (r.stdout || '').trim();
    if (r.status === 0 && /^3\.(1[0-3])$/.test(version)) return { cmd, args, version };
  }
  return null;
}

function setup() {
  const py = findPython();
  if (!py) {
    console.error('Python 3.10 to 3.13 was not found. Install it from https://www.python.org/downloads/ '
      + '(tick "Add python.exe to PATH"), then run: npm run ocr:setup');
    process.exit(1);
  }
  console.log(`Using Python ${py.version}. Making ${VENV} ...`);
  if (!fs.existsSync(venvPython())) {
    const made = spawnSync(py.cmd, [...py.args, '-m', 'venv', VENV], { stdio: 'inherit' });
    if (made.status !== 0) process.exit(made.status || 1);
  }
  console.log('Installing PaddleOCR (a few hundred MB; this takes a few minutes) ...');
  const pip = spawnSync(venvPython(), ['-m', 'pip', 'install', '-r', path.join(HELPER_DIR, 'requirements.txt')], { stdio: 'inherit' });
  if (pip.status !== 0) process.exit(pip.status || 1);
  console.log('\nDone. Start the backend as usual (npm start): it now starts the OCR helper too.'
    + '\nThe first start downloads the reading model once (internet needed).');
}

function start() {
  if (!fs.existsSync(venvPython())) {
    console.error('The OCR helper is not set up yet. Run: npm run ocr:setup');
    process.exit(1);
  }
  const child = spawn(venvPython(), [path.join(HELPER_DIR, 'server.py')], { stdio: 'inherit', cwd: HELPER_DIR });
  child.on('exit', (code) => process.exit(code || 0));
}

if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === 'setup') setup();
  else if (cmd === 'start') start();
  else console.log('Usage: node scripts/ocr-helper.js setup | start');
}

module.exports = { venvPython, HELPER_DIR };
