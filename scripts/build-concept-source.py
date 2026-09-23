#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""Assemble an isolated development app from the locally compiled Gecko build.

Run `npm run build:ui` and `cd engine && ./mach package` first. No network, upstream profile, or installed app is
used. Resolving the build tree's symlinks makes the result self-contained.
"""
import configparser
import hashlib
import json
import plistlib
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from concept_bundle import read_omni

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'dist' / 'Sierra Source.app'
PROFILE = ROOT / '.concept-source-profile'


def add_zen_locales(omni):
    """Package the Zen strings that the upstream source package omits."""
    locale_root = ROOT / 'locales/en-US/browser/browser'
    locales = sorted(locale_root.glob('zen-*.ftl'))
    if not locales:
        raise SystemExit('Zen localization sources are missing.')
    additions = {
        f'localization/en-US/browser/{path.name}': path.read_bytes()
        for path in locales
    }
    brand_files = {
        'localization/en-US/branding/brand.ftl',
        'chrome/en-US/locale/branding/brand.properties',
    }
    replacement = omni.with_suffix('.ja.tmp')
    with read_omni(omni) as source, zipfile.ZipFile(
        replacement, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=3
    ) as target:
        for entry in source.infolist():
            if entry.filename not in additions:
                data = source.read(entry.filename)
                if entry.filename in brand_files:
                    data = data.replace(b'Nightly', b'Sierra')
                target.writestr(entry, data)
        for name, data in additions.items():
            target.writestr(name, data)
    replacement.replace(omni)


def build():
    candidates = list((ROOT / 'engine').glob('obj-*/dist/zen/Nightly.app'))
    if len(candidates) != 1:
        raise SystemExit('Expected one packaged Nightly.app. Run cd engine && ./mach package first.')
    base = candidates[0]
    if not (base / 'Contents/MacOS/XUL').is_file():
        raise SystemExit('The source engine is not built.')
    executable = str(APP / 'Contents/MacOS/zen')
    commands = subprocess.check_output(['ps', '-axo', 'command='], text=True).splitlines()
    if any(line.strip() == executable or line.strip().startswith(executable + ' ') for line in commands):
        raise SystemExit('Quit Sierra Source before rebuilding.')
    if APP.exists() and not (APP / 'Contents/Resources/concept-source-build.json').exists():
        raise SystemExit('Refusing to replace an unrecognized app.')
    APP.parent.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.concept-source-', dir=APP.parent) as temp:
        staged = Path(temp) / APP.name
        shutil.copytree(base, staged, symlinks=False)
        contents = staged / 'Contents'
        # Use Mozilla's packaged layout: raw dist/Nightly.app is a developer
        # runtime and its resource roots differ when copied out of the tree.
        add_zen_locales(contents / 'Resources/browser/omni.ja')
        with read_omni(contents / 'Resources/browser/omni.ja') as archive:
            module = archive.read('chrome/browser/content/browser/zen-components/BrowserConcept.mjs')
            stylesheet = archive.read('chrome/browser/content/browser/zen-styles/browser-concept.css')
        for content, name in ((module, 'BrowserConcept.mjs'), (stylesheet, 'browser-concept.css')):
            if content != (ROOT / 'src/zen/concept' / name).read_bytes():
                raise SystemExit('UI package is stale. Run npm run build:ui, then cd engine && ./mach package.')
        info_path = contents / 'Info.plist'
        info = plistlib.loads(info_path.read_bytes())
        info.update(CFBundleIdentifier='local.browserconcept.sierra-source',
                    CFBundleName='Sierra Source', CFBundleDisplayName='Sierra Source',
                    CFBundleExecutable='concept-launcher')
        info_path.write_bytes(plistlib.dumps(info))
        launcher = contents / 'MacOS/concept-launcher'
        launcher.write_text('\n'.join([
            '#!/bin/sh',
            'APP_CONTENTS="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"',
            'REPO_ROOT="$(CDPATH= cd -- "$APP_CONTENTS/../../.." && pwd)"',
            'exec "$APP_CONTENTS/MacOS/zen" -no-remote -purgecaches -profile "$REPO_ROOT/.concept-source-profile" "$@" >>"$REPO_ROOT/concept-source.log" 2>&1',
            '',
        ]))
        launcher.chmod(0o755)
        policies = contents / 'Resources/distribution'
        policies.mkdir(exist_ok=True)
        (policies / 'policies.json').write_text(json.dumps({'policies': {
            'DisableAppUpdate': True, 'DontCheckDefaultBrowser': True,
            'DisableTelemetry': True,
        }}))
        platform = configparser.ConfigParser()
        platform.read(contents / 'Resources/platform.ini')
        manifest = {
            'kind': 'Local full-source build',
            'gecko': platform.get('Build', 'Milestone'),
            'engine_build_id': platform.get('Build', 'BuildID'),
            'engine_source_stamp': platform.get('Build', 'SourceStamp'),
            'source_head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
            'concept_sha256': hashlib.sha256(module + stylesheet).hexdigest(),
        }
        (contents / 'Resources/concept-source-build.json').write_text(json.dumps(manifest, indent=2))
        PROFILE.mkdir(mode=0o700, exist_ok=True)
        # Never read or migrate the user's standard Zen profile.
        (PROFILE / 'user.js').write_text('''user_pref("browser.concept.enabled", true);
user_pref("browser.theme.toolbar-theme", 0);
user_pref("browser.theme.content-theme", 0);
user_pref("layout.css.prefers-color-scheme.content-override", 0);
user_pref("ui.systemUsesDarkTheme", 1);
user_pref("zen.welcome-screen.seen", true);
user_pref("zen.watermark.enabled", false);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("zen.view.use-single-toolbar", true);
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.enabled", false);
''')
        # Local development signature. JIT remains allowed; no vendor identity.
        subprocess.run(['codesign', '--force', '--deep', '--sign', '-', str(staged)], check=True)
        entitlements = Path(temp) / 'jit.plist'
        entitlements.write_bytes(plistlib.dumps({
            'com.apple.security.cs.allow-jit': True,
            'com.apple.security.cs.allow-unsigned-executable-memory': True,
            'com.apple.security.cs.disable-library-validation': True,
        }))
        subprocess.run(['codesign', '--force', '--sign', '-', '--entitlements', str(entitlements), str(contents / 'MacOS/zen')], check=True)
        subprocess.run(['codesign', '--force', '--sign', '-', str(staged)], check=True)
        subprocess.run(['codesign', '--verify', '--deep', '--strict', str(staged)], check=True)
        previous = APP.with_name('.concept-source-previous.app')
        if previous.exists():
            if not (previous / 'Contents/Resources/concept-source-build.json').exists():
                raise SystemExit('Refusing to remove an unrecognized previous bundle.')
            shutil.rmtree(previous)
        if APP.exists():
            APP.rename(previous)
        try:
            staged.rename(APP)
        except Exception:
            if previous.exists():
                previous.rename(APP)
            raise
        if previous.exists():
            shutil.rmtree(previous)
    print(APP)
    print('Isolated profile:', PROFILE)


if __name__ == '__main__':
    build()
