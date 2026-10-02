#!/usr/bin/env python3
"""Create a source inventory without guessing architecture or business behavior."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

DEFAULT_EXTENSIONS = {
    '.py', '.swift', '.m', '.mm', '.h', '.c', '.cc', '.cpp', '.hpp', '.go',
    '.rs', '.java', '.kt', '.kts', '.js', '.jsx', '.ts', '.tsx', '.vue',
    '.svelte', '.css', '.scss', '.html', '.rb', '.php', '.ex', '.exs',
    '.erl', '.hrl', '.cs', '.fs', '.fsx', '.dart', '.sh', '.bash', '.zsh',
    '.sql', '.gradle', '.cjs', '.mjs', '.scala', '.clj', '.cljs', '.lua',
}
SKIP_DIRS = {
    '.git', 'node_modules', '.venv', 'venv', '__pycache__', '.build',
    '.gradle', '.next', '.nuxt', '.cache', 'Pods', 'Carthage',
    'DerivedData', 'target', 'dist', 'build', 'vendor',
}


def source_lines(text):
    if not text:
        return []
    lines = text.split('\n')
    if lines[-1] == '':
        lines.pop()
    return lines


def assignments(values):
    result = {}
    for value in values:
        key, sep, item = value.partition('=')
        if not sep or not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]*', key) or not item:
            raise ValueError('Expected a stable repository ID and value: ID=VALUE')
        if key in result:
            raise ValueError('Duplicate repository ID: ' + key)
        result[key] = item
    return result


def roots_from(values):
    roots = {key: Path(value).expanduser().resolve() for key, value in assignments(values).items()}
    for key, root in roots.items():
        if not root.is_dir():
            raise ValueError('Missing repository root: ' + key)
    return roots


def sensitive_name(path):
    name = path.name.lower()
    return (name == '.env' or name.startswith('.env.') or name in {
        '.npmrc', '.pypirc', 'id_rsa', 'id_ed25519', 'id_ecdsa',
    } or re.match(r'^(?:secrets?|credentials?)(?:[._-]|$)', name) is not None
        or path.suffix.lower() in {'.pem', '.p12', '.pfx', '.key', '.keystore'})


def candidates(root):
    """Use Git inventory at checkout root; snapshots use a pruned filesystem walk."""
    try:
        top = subprocess.run(['git', '-C', str(root), 'rev-parse', '--show-toplevel'],
                             check=True, capture_output=True).stdout.decode().strip()
        if Path(top).resolve() == root:
            raw = subprocess.run(['git', '-C', str(root), 'ls-files', '--cached',
                                  '--others', '--exclude-standard', '-z'],
                                 check=True, capture_output=True).stdout
            paths = {Path(os.fsdecode(item)) for item in raw.split(b'\0') if item}
            return sorted(paths), 'git tracked and non-ignored files'
    except (OSError, subprocess.CalledProcessError, UnicodeError):
        pass
    paths = []
    for folder, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = [name for name in dirs if name not in SKIP_DIRS
                   and not (Path(folder) / name).is_symlink()]
        paths.extend((Path(folder) / name).relative_to(root) for name in names)
    return sorted(paths), 'filesystem walk with dependency/cache directories pruned'


def create_index(roots, revisions, extensions, max_bytes):
    records, repos, omitted = [], [], 0
    for repo, root in roots.items():
        paths, mode = candidates(root)
        repos.append({'id': repo, 'label': repo,
                      'revision': revisions.get(repo, 'working copy'), 'inventoryMode': mode})
        for relative in paths:
            if relative.is_absolute() or '..' in relative.parts:
                raise ValueError('Unsafe inventory path')
            if any(part in SKIP_DIRS for part in relative.parts):
                omitted += 1
                continue
            path = root / relative
            if not path.exists() and not path.is_symlink():
                omitted += 1  # tracked file locally deleted
                continue
            name = relative.as_posix()
            record = {'id': repo + ':' + name, 'repo': repo, 'path': name,
                      'name': relative.name, 'code': False, 'bytes': path.lstat().st_size}
            if path.is_symlink() or not path.resolve().is_relative_to(root):
                record['bodyOmitted'] = 'symlink or outside root'
            elif not path.is_file():
                omitted += 1
                continue
            elif sensitive_name(relative):
                record['bodyOmitted'] = 'sensitive filename; contents not read'
            elif path.suffix.lower() not in extensions:
                record['bodyOmitted'] = 'metadata-only extension'
            elif record['bytes'] > max_bytes:
                record['bodyOmitted'] = 'source body exceeds configured size limit'
            else:
                raw = path.read_bytes()
                try:
                    body = raw.decode('utf-8')
                    if '\0' in body:
                        raise UnicodeError('binary data')
                except UnicodeError:
                    record['bodyOmitted'] = 'not UTF-8 text'
                else:
                    record.update(code=True, sha256=hashlib.sha256(raw).hexdigest(),
                                  text=body, lines=len(source_lines(body)))
            records.append(record)
    return {'schemaVersion': 1, 'repositories': repos, 'files': records,
            'coverage': {'files': len(records), 'codeFiles': sum(f['code'] for f in records),
                         'codeLines': sum(f.get('lines', 0) for f in records),
                         'metadataFiles': sum(not f['code'] for f in records),
                         'excludedFiles': omitted,
                         'note': 'Counts follow the stated inventory mode; pruned and Git-ignored directories are outside scope.'}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', action='append', required=True, metavar='ID=PATH')
    parser.add_argument('--revision', action='append', default=[], metavar='ID=LABEL')
    parser.add_argument('--extensions', help='Comma-separated source extensions replacing defaults')
    parser.add_argument('--add-extensions', default='', help='Comma-separated extensions added to the selected source set')
    parser.add_argument('--max-bytes', type=int, default=2 * 1024 * 1024)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        roots, revisions = roots_from(args.repo), assignments(args.revision)
        if set(revisions) - set(roots):
            raise ValueError('Revision supplied for an unknown repository')
        if args.max_bytes < 1:
            raise ValueError('--max-bytes must be positive')
        extensions = DEFAULT_EXTENSIONS
        if args.extensions is not None:
            extensions = {'.' + item.strip().lower().lstrip('.')
                          for item in args.extensions.split(',') if item.strip()}
            if not extensions:
                raise ValueError('At least one extension is required')
        extensions = extensions | {'.' + item.strip().lower().lstrip('.')
                                   for item in args.add_extensions.split(',') if item.strip()}
        data = create_index(roots, revisions, extensions, args.max_bytes)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(data['coverage'], ensure_ascii=False))
    except (ValueError, OSError) as error:
        print('Index failed: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
