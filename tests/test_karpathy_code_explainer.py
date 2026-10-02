"""Behavioral checks for source/evidence agreement and safe offline serialization."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

SKILL = Path(__file__).resolve().parents[1] / 'skills' / 'karpathy-code-explainer'
sys.path.insert(0, str(SKILL / 'scripts'))
from index_sources import create_index, DEFAULT_EXTENSIONS
from build_atlas import validate, render


class ToolsCheck(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.body = 'def reserve():\n    return "</script><img src=x onerror=alert(1)>"\n'
        (self.root / 'app.py').write_text(self.body)
        (self.root / '.env').write_text('TOKEN=fixture_environment_value')
        (self.root / 'credentials.py').write_text('TOKEN="fixture_credential_value"')
        (self.root / 'data.bin').write_bytes(b'\x00\xff')
        (self.root / 'alias.py').symlink_to(self.root / 'app.py')
        (self.root / 'node_modules').mkdir()
        (self.root / 'node_modules/vendor.js').write_text('vendor source')
        self.roots = {'cli': self.root}
        self.index = create_index(self.roots, {}, DEFAULT_EXTENSIONS, 100000)
        self.ref = {'file':'cli:app.py','line':1}
        self.guide = {
            'schemaVersion':1, 'project':{'title':'CLI'},
            'modules':[{'id':'booking','label':'예약','entryFiles':['cli:app.py']}],
            'flows':[{'id':'book','module':'booking','title':'예약',
                      'steps':[{'title':'호출','detail':'예약 함수를 호출합니다.','sources':[self.ref]}]}],
            'fileAnnotations':[{'file':'cli:app.py','module':'booking',
                                'symbols':[{'name':'reserve','line':1}]}],
        }

    def tearDown(self):
        self.temp.cleanup()

    def test_valid_arbitrary_repo_and_symbols(self):
        result = validate(self.index, self.guide, self.roots)
        self.assertEqual(result['sourceBodiesVerified'], 1)
        self.assertEqual(result['symbols'], 1)

    def test_private_values_symlinks_and_dependencies_not_embedded(self):
        encoded = json.dumps(self.index)
        self.assertNotIn('fixture_environment_value', encoded)
        self.assertNotIn('fixture_credential_value', encoded)
        self.assertNotIn('vendor source', encoded)
        alias = next(f for f in self.index['files'] if f['path'] == 'alias.py')
        self.assertFalse(alias['code'])

    def test_live_source_drift_rejected(self):
        (self.root / 'app.py').write_text(self.body + '# edited\n')
        with self.assertRaisesRegex(ValueError, 'hash drift'):
            validate(self.index, self.guide, self.roots)

    def test_valid_hash_does_not_allow_tampered_embedded_body(self):
        index = copy.deepcopy(self.index)
        next(f for f in index['files'] if f['code'])['text'] = 'invented body'
        with self.assertRaisesRegex(ValueError, 'Embedded source differs'):
            validate(index, self.guide, self.roots)

    def test_out_of_range_evidence_rejected(self):
        guide = copy.deepcopy(self.guide)
        guide['flows'][0]['steps'][0]['sources'][0]['line'] = 300
        with self.assertRaisesRegex(ValueError, 'range outside'):
            validate(self.index, guide, self.roots)

    def test_factual_claim_cannot_be_evidence_free(self):
        guide = copy.deepcopy(self.guide)
        guide['flows'][0]['steps'][0]['sources'] = []
        with self.assertRaisesRegex(ValueError, 'lacks evidence'):
            validate(self.index, guide, self.roots)
        guide['flows'][0]['steps'][0]['certainty'] = 'unverified'
        validate(self.index, guide, self.roots)

    def test_job_cannot_be_displayed_as_direct_chain(self):
        guide = copy.deepcopy(self.guide)
        guide['flows'][0]['steps'][0]['execution'] = 'background'
        with self.assertRaisesRegex(ValueError, 'labeled follow-up'):
            validate(self.index, guide, self.roots)
        guide['flows'][0]['steps'][0]['connection'] = 'followup'
        validate(self.index, guide, self.roots)

    def test_symbol_must_exist_at_stated_line(self):
        guide = copy.deepcopy(self.guide)
        guide['fileAnnotations'][0]['symbols'][0]['line'] = 2
        with self.assertRaisesRegex(ValueError, 'Symbol missing'):
            validate(self.index, guide, self.roots)

    def test_duplicate_modules_rejected(self):
        guide = copy.deepcopy(self.guide)
        guide['modules'].append(copy.deepcopy(guide['modules'][0]))
        with self.assertRaisesRegex(ValueError, 'duplicate IDs'):
            validate(self.index, guide, self.roots)

    def test_source_url_cannot_execute_script(self):
        index = copy.deepcopy(self.index)
        index['files'][0]['sourceUrl'] = 'javascript:alert(1)'
        with self.assertRaisesRegex(ValueError, 'Source URL'):
            validate(index, self.guide, self.roots)

    def test_payload_roundtrip_escapes_html_without_altering_source(self):
        shell = '<script id="atlas-data" type="application/json">__DATA__</script>'
        html = render(self.index, self.guide, shell)
        self.assertNotIn('</script><img', html)
        embedded = json.loads(html.split('>',1)[1].rsplit('</script>',1)[0])
        self.assertEqual(next(f for f in embedded['index']['files'] if f['code'])['text'], self.body)

    def test_path_escape_rejected(self):
        index = copy.deepcopy(self.index)
        file = next(f for f in index['files'] if f['code'])
        file['path'] = '../app.py'
        file['id'] = 'cli:../app.py'
        with self.assertRaisesRegex(ValueError, 'Unsafe path'):
            validate(index, self.guide, self.roots)


if __name__ == '__main__':
    unittest.main(verbosity=1)
