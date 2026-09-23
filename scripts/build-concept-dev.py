#!/usr/bin/env python3
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
"""Assemble an isolated UI development app using an installed Zen engine.

This is not a full Gecko compilation. Source integrations under src/zen/concept
are identical to the full build. Never patch the installed application/profile.
"""
import hashlib, json, plistlib, shutil, subprocess, tempfile, zipfile
from concept_bundle import read_omni
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=Path('/Applications/Zen.app')
APP=ROOT/'dist'/'Sierra Dev.app'
PROFILE=ROOT/'.concept-profile'


def build():
    global APP
    destination=APP
    executable=str(destination/'Contents/MacOS/zen')
    commands=subprocess.check_output(['ps','-axo','command='],text=True).splitlines()
    if any(line.strip()==executable or line.strip().startswith(executable+' ') for line in commands):
        raise SystemExit('Quit Sierra Dev completely before rebuilding its bundle.')
    if not BASE.is_dir():raise SystemExit('Install the official Zen macOS application first.')
    if APP.exists():
        if not (APP/'Contents/Resources/concept-build.json').exists():raise SystemExit('Refusing to overwrite an unrecognized app')
    APP.parent.mkdir(exist_ok=True)
    staging=Path(tempfile.mkdtemp(prefix=".concept-build-",dir=APP.parent))
    APP=staging/"Sierra Dev.app"
    shutil.copytree(BASE,APP,symlinks=True)
    jar=APP/'Contents/Resources/browser/omni.ja'
    original=read_omni(jar)
    source=ROOT/'src/zen/concept'
    additions={
        'chrome/browser/content/browser/zen-components/BrowserConcept.mjs':(source/'BrowserConcept.mjs').read_bytes(),
        'chrome/browser/content/browser/zen-styles/browser-concept.css':(source/'browser-concept.css').read_bytes(),
        'modules/zen/concept/ConceptStore.sys.mjs':(source/'ConceptStore.sys.mjs').read_bytes(),
        'modules/zen/concept/ConceptModel.sys.mjs':(source/'ConceptModel.sys.mjs').read_bytes(),
        'actors/ConceptCursorParent.sys.mjs':(source/'actors/ConceptCursorParent.sys.mjs').read_bytes(),
        'actors/ConceptCursorChild.sys.mjs':(source/'actors/ConceptCursorChild.sys.mjs').read_bytes(),
    }
    preloaded='chrome/browser/content/browser/ZenPreloadedScripts.js'
    text=original.read(preloaded).decode()
    anchor='"chrome://browser/content/ZenStartup.mjs",'
    if text.count(anchor)!=1:raise ValueError('Unsupported Zen startup integration')
    additions[preloaded]=text.replace(anchor,anchor+'\n    "chrome://browser/content/zen-components/BrowserConcept.mjs",').encode()
    actors='modules/ZenActorsManager.sys.mjs'
    actor_source=(ROOT/'src/zen/common/sys/ZenActorsManager.sys.mjs').read_text()
    block=actor_source.split('  ConceptCursor: {',1)[1].split('  ZenModsMarketplace:',1)[0]
    text=original.read(actors).decode()
    additions[actors]=text.replace('let JSWINDOWACTORS = {','let JSWINDOWACTORS = {\n  ConceptCursor: {'+block,1).encode()
    temporary=jar.with_suffix('.tmp')
    with zipfile.ZipFile(temporary,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=3) as out:
        for entry in original.infolist():
            if entry.filename not in additions:out.writestr(entry.filename,original.read(entry.filename))
        for name,content in additions.items():out.writestr(name,content)
    original.close();temporary.replace(jar)
    plist=APP/'Contents/Info.plist'
    with plist.open('rb') as f: info=plistlib.load(f)
    engine_version=info.get('CFBundleShortVersionString')
    launcher=APP/'Contents/MacOS/concept-launcher'
    launcher.write_text('\n'.join([
        '#!/bin/sh',
        'APP_CONTENTS="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"',
        'REPO_ROOT="$(CDPATH= cd -- "$APP_CONTENTS/../../.." && pwd)"',
        'exec "$APP_CONTENTS/MacOS/zen" -no-remote -purgecaches -profile "$REPO_ROOT/.concept-profile" "$@" >>"$REPO_ROOT/concept-dev.log" 2>&1',
        '',
    ]))
    launcher.chmod(0o755)
    info.update(CFBundleIdentifier='local.browserconcept.sierra-dev',CFBundleName='Sierra Dev',CFBundleDisplayName='Sierra Dev',CFBundleExecutable='concept-launcher')
    with plist.open('wb') as f:plistlib.dump(info,f)
    (APP/'Contents/Resources/concept-build.json').write_text(json.dumps({'base':'Zen','engine_version':engine_version,'kind':'UI development overlay','overlay_sha256':hashlib.sha256(b''.join(name.encode()+additions[name] for name in sorted(additions))).hexdigest(),'source':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()},indent=2))
    PROFILE.mkdir(mode=0o700,exist_ok=True)
    # These defaults apply only to this explicit development profile.
    (PROFILE/'user.js').write_text('''user_pref("browser.concept.enabled", true);
user_pref("browser.theme.toolbar-theme", 0);
user_pref("browser.theme.content-theme", 0);
user_pref("layout.css.prefers-color-scheme.content-override", 0);
user_pref("ui.systemUsesDarkTheme", 1);
user_pref("zen.welcome-screen.seen", true);
user_pref("zen.watermark.enabled", false);
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("zen.view.use-single-toolbar", true);
''')
    # A development overlay must not update itself over the fork's modifications.
    # The installed production Zen is untouched and keeps its update policy.
    policies=APP/'Contents/Resources/distribution';policies.mkdir(exist_ok=True)
    (policies/'policies.json').write_text(json.dumps({'policies':{'DisableAppUpdate':True,'DontCheckDefaultBrowser':True}}))
    # Preserve the engine's JIT entitlements. The vendor-only application and
    # credential entitlements cannot be used by an ad-hoc development identity.
    result=subprocess.run(['codesign','-d','--entitlements',':-',str(BASE)],capture_output=True,check=True)
    entitlements=plistlib.loads(result.stdout)
    entitlements.pop('com.apple.application-identifier',None)
    entitlements.pop('com.apple.developer.web-browser.public-key-credential',None)
    subprocess.run(['codesign','--force','--deep','--preserve-metadata=entitlements','--sign','-',str(APP)],check=True)
    with tempfile.NamedTemporaryFile(suffix='.plist') as ent:
        ent.write(plistlib.dumps(entitlements));ent.flush()
        subprocess.run(['codesign','--force','--sign','-','--entitlements',ent.name,str(APP/'Contents/MacOS/zen')],check=True)
    subprocess.run(['codesign','--force','--sign','-',str(APP)],check=True)
    subprocess.run(['codesign','--verify','--deep','--strict',str(APP)],check=True)
    previous=destination.with_name('.concept-previous.app')
    if previous.exists():
        if not (previous/'Contents/Resources/concept-build.json').exists():raise SystemExit('Unrecognized previous bundle')
        shutil.rmtree(previous)
    if destination.exists():destination.rename(previous)
    try:APP.rename(destination)
    except Exception:
        if previous.exists():previous.rename(destination)
        raise
    staging.rmdir()
    if previous.exists():shutil.rmtree(previous)
    print(destination)
    print('Profile:',PROFILE)
if __name__=='__main__':build()
