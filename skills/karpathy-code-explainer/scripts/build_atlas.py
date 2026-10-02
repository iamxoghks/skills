#!/usr/bin/env python3
"""Validate a source index/evidence guide and render the bundled offline atlas."""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys
from urllib.parse import urlparse
from index_sources import roots_from, source_lines

CERTAINTIES = {'source', 'inference', 'unverified'}
EXECUTIONS = {'ui', 'request', 'sync', 'async', 'scheduled', 'background', 'event', 'inference'}
CONNECTIONS = {'direct', 'followup', 'alternative'}
KINDS = {'call', 'api', 'event', 'storage', 'import', 'inference'}


def need(condition, message):
    if not condition:
        raise ValueError(message)


def unique(items, key, label):
    need(isinstance(items, list), label + ' must be a list')
    values = [item.get(key) for item in items if isinstance(item, dict)]
    need(len(values) == len(items) and all(isinstance(v, str) and v for v in values),
         label + ' require nonempty ' + key)
    duplicates = [v for v, count in Counter(values).items() if count > 1]
    need(not duplicates, label + ' have duplicate IDs: ' + ', '.join(duplicates))
    return {item[key]: item for item in items}


def validate(index, guide, roots):
    need(index.get('schemaVersion') == 1 and guide.get('schemaVersion') == 1, 'Unsupported schemaVersion')
    repos = unique(index.get('repositories'), 'id', 'Repositories')
    need(set(roots) == set(repos), 'Supply exactly the repository roots used by the index')
    files = unique(index.get('files'), 'id', 'Files')
    need(files, 'Index contains no files')
    body_count = 0
    for fid, file in files.items():
        repo, path = file.get('repo'), file.get('path')
        need(repo in repos and isinstance(path, str), 'Invalid repository/path: ' + fid)
        relative = PurePosixPath(path)
        need(not relative.is_absolute() and '..' not in relative.parts and '\\' not in path,
             'Unsafe path: ' + fid)
        need(fid == repo + ':' + path, 'File ID does not match repository/path: ' + fid)
        need(isinstance(file.get('code'), bool), 'Missing code/body flag: ' + fid)
        if file['code']:
            source = roots[repo] / path
            need(source.is_file() and not source.is_symlink() and source.resolve().is_relative_to(roots[repo]),
                 'Source is missing or outside root: ' + fid)
            raw = source.read_bytes()
            need(isinstance(file.get('text'), str), 'Source text is missing: ' + fid)
            need(hashlib.sha256(raw).hexdigest() == file.get('sha256'), 'Source hash drift: ' + fid)
            need(raw.decode('utf-8') == file['text'], 'Embedded source differs: ' + fid)
            need(file.get('lines') == len(source_lines(file['text'])), 'Line count mismatch: ' + fid)
            need(file.get('bytes') == len(raw), 'Byte count mismatch: ' + fid)
            body_count += 1
        else:
            need('text' not in file and 'sha256' not in file, 'Metadata entry includes a body/hash: ' + fid)
        if file.get('sourceUrl'):
            link = urlparse(file['sourceUrl'])
            need(link.scheme == 'https' and link.hostname and not link.username and not link.password,
                 'Source URL must be HTTPS without credentials: ' + fid)
    expected = {'files': len(files), 'codeFiles': body_count,
                'codeLines': sum(f.get('lines', 0) for f in files.values()),
                'metadataFiles': len(files) - body_count}
    for key, value in expected.items():
        if key in index.get('coverage', {}):
            need(index['coverage'][key] == value, 'Coverage mismatch: ' + key)
    need(body_count, 'No code bodies available to explain')

    project = guide.get('project')
    need(isinstance(project, dict) and isinstance(project.get('title'), str) and project['title'],
         'Project title is required')
    modules = unique(guide.get('modules'), 'id', 'Modules')
    need(modules, 'At least one module is required')
    flows = unique(guide.get('flows', []), 'id', 'Flows')
    annotations = unique(guide.get('fileAnnotations', []), 'file', 'File annotations')
    ref_count = 0

    def reference(ref):
        nonlocal ref_count
        need(isinstance(ref, dict), 'Source reference must be an object')
        fid, line = ref.get('file'), ref.get('line')
        need(fid in files and files[fid]['code'], 'Reference needs an embedded code file: ' + str(fid))
        end = ref.get('endLine', line)
        need(type(line) is int and type(end) is int and 1 <= line <= end <= files[fid]['lines'],
             'Source line range outside file: ' + str(fid))
        if 'excerpt' in ref:
            excerpt = '\n'.join(source_lines(files[fid]['text'])[line - 1:end])
            need(ref['excerpt'] == excerpt, 'Evidence excerpt mismatch: ' + fid)
        ref_count += 1

    def claim(item, context):
        need(isinstance(item, dict), context + ' must be an object')
        certainty = item.get('certainty', 'source')
        need(certainty in CERTAINTIES, 'Invalid certainty: ' + context)
        sources = item.get('sources', [])
        need(isinstance(sources, list), 'Sources must be a list: ' + context)
        need(sources or certainty != 'source', 'Source-observed claim lacks evidence: ' + context)
        for ref in sources:
            reference(ref)

    def known_file(fid, context):
        need(fid in files, 'Unknown file in ' + context + ': ' + str(fid))

    edge_count = 0
    for mid, module in modules.items():
        need(isinstance(module.get('label'), str) and module['label'], 'Module label missing: ' + mid)
        for fid in module.get('entryFiles', []):
            known_file(fid, mid)
        for key in ('rules', 'notes'):
            for item in module.get(key, []):
                claim(item, mid + '/' + key)
        diagram = module.get('diagram', {})
        nodes = unique(diagram.get('nodes', []), 'id', mid + ' diagram nodes')
        for node in nodes.values():
            need(isinstance(node.get('label'), str) and node['label'], 'Diagram node needs a label')
            for fid in node.get('files', []):
                known_file(fid, mid + ' diagram')
        for edge in diagram.get('edges', []):
            need(edge.get('from') in nodes and edge.get('to') in nodes, 'Unknown diagram node: ' + mid)
            need(edge.get('kind') in KINDS, 'Invalid diagram edge kind: ' + mid)
            claim(edge, mid + ' diagram edge')
            edge_count += 1
    step_count = 0
    for flow in flows.values():
        need(flow.get('module') in modules, 'Flow module is unknown: ' + flow['id'])
        need(isinstance(flow.get('title'), str) and flow['title'], 'Flow title is required')
        steps = flow.get('steps')
        need(isinstance(steps, list) and steps, 'Flow must contain steps: ' + flow['id'])
        for step in steps:
            claim(step, flow['id'])
            execution, connection = step.get('execution', 'sync'), step.get('connection', 'direct')
            need(execution in EXECUTIONS and connection in CONNECTIONS, 'Invalid execution/connection')
            need(execution not in {'async', 'scheduled', 'background'} or connection != 'direct',
                 'Async/job step must be a labeled follow-up or alternative: ' + flow['id'])
            step_count += 1
    symbol_count = 0
    for fid, annotation in annotations.items():
        known_file(fid, 'annotations')
        need(annotation.get('module') in modules, 'Annotation module is unknown: ' + fid)
        for symbol in annotation.get('symbols', []):
            need(files[fid]['code'], 'Symbols need an embedded body: ' + fid)
            name, line = symbol.get('name'), symbol.get('line')
            need(isinstance(name, str) and name and type(line) is int
                 and 1 <= line <= files[fid]['lines'], 'Invalid symbol: ' + fid)
            need(name in source_lines(files[fid]['text'])[line - 1], 'Symbol missing at stated line: ' + fid)
            symbol_count += 1
    documentation = unique(guide.get('documentation', []), 'id', 'Documentation sections')
    for section in documentation.values():
        need(isinstance(section.get('title'), str) and section['title'], 'Documentation title is required')
        claim(section, 'documentation/' + section['id'])
        commands = section.get('commands', [])
        need(isinstance(commands, list) and all(isinstance(c, str) and c for c in commands),
             'Documentation commands must be nonempty strings')
    return {'schemaVersion': 1, **expected, 'modules': len(modules), 'flows': len(flows),
            'flowSteps': step_count, 'diagramEdges': edge_count, 'sourceReferences': ref_count,
            'symbols': symbol_count, 'sourceBodiesVerified': body_count,
            'documentationSections': len(documentation),
            'note': 'Structural/source agreement only; semantic accuracy and browser/app behavior require separate review.'}


def render(index, guide, template):
    need(template.count('__DATA__') == 1, 'Template must contain __DATA__ exactly once')
    data = json.dumps({'index': index, 'guide': guide}, ensure_ascii=False, separators=(',', ':'))
    # Escape HTML parser delimiters; preserve source text exactly after JSON.parse.
    data = data.replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    data = data.replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')
    result = template.replace('__DATA__', data)
    match = re.search(r'<script\b[^>]*\bid=["\']atlas-data["\'][^>]*>(.*?)</script>', result, re.S)
    need(match is not None, 'Template needs <script id="atlas-data" type="application/json">')
    need(json.loads(match.group(1)) == {'index': index, 'guide': guide}, 'Rendered payload round-trip differs')
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--index', required=True, type=Path)
    parser.add_argument('--guide', required=True, type=Path)
    parser.add_argument('--repo', action='append', required=True, metavar='ID=PATH')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--report', type=Path)
    parser.add_argument('--template', type=Path, default=Path(__file__).resolve().parents[1] / 'assets/atlas.html')
    parser.add_argument('--validate-only', action='store_true')
    args = parser.parse_args()
    try:
        need(args.validate_only or args.output is not None, '--output required unless --validate-only')
        index = json.loads(args.index.read_text(encoding='utf-8'))
        guide = json.loads(args.guide.read_text(encoding='utf-8'))
        report = validate(index, guide, roots_from(args.repo))
        if not args.validate_only:
            html = render(index, guide, args.template.read_text(encoding='utf-8'))
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(html, encoding='utf-8')
            report['htmlBytes'] = len(html.encode('utf-8'))
        if args.report:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps(report, ensure_ascii=False))
    except (ValueError, OSError, UnicodeError, TypeError, KeyError, AttributeError) as error:
        print('Atlas failed: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
