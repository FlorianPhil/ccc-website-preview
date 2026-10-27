import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


speed = load_module("check_signature_speed", ROOT / "tools/check_signature_speed.py")
build = load_module("ccc_build", ROOT / "tools/build.py")


def test_current_approved_signature_source_passes_speed_and_corner_rules():
    source = (ROOT / "assets/js/site.js").read_text(encoding="utf-8")
    assert speed.check(source) == []


def test_speed_above_setting_is_still_rejected():
    source = (ROOT / "assets/js/site.js").read_text(encoding="utf-8")
    too_fast = source.replace("scrollBoost = Math.min(1,", "scrollBoost = Math.min(2,", 1)
    assert too_fast != source
    assert any("scrollBoost may exceed 1" in error for error in speed.check(too_fast))


def test_sharp_route_corner_is_still_rejected():
    source = '''window.CCC_SIG=window.CCC_SIG||{"field":{"routes":[{"d":"M 0 0 C 0 0 0 10 0 10 C 0 10 10 10 10 10"}]}};
scrollBoost = Math.min(1, scrollBoost + 1);
this.time += delta * this.P.speed * (this.clock === "scroll" ? Math.max(this.idle, scrollBoost) : 1);
'''
    errors = speed.check(source)
    assert any("degree corner" in error for error in errors)


def dot_fixture(tmp_path, site_js):
    root = tmp_path / "fixture"
    tools = root / "tools"
    assets = root / "assets"
    (assets / "js").mkdir(parents=True)
    (assets / "css").mkdir()
    tools.mkdir()
    shutil.copy2(ROOT / "tools/check_signature_dots.py", tools / "check_signature_dots.py")
    shutil.copy2(ROOT / "assets/css/site.css", assets / "css/site.css")
    (assets / "js/site.js").write_text(site_js, encoding="utf-8")
    return root


def run_dot_check(root):
    return subprocess.run([sys.executable, str(root / "tools/check_signature_dots.py")],
                          capture_output=True, text=True, check=False)


def test_current_approved_dot_appearance_passes_the_appearance_checker(tmp_path):
    source = (ROOT / "assets/js/site.js").read_text(encoding="utf-8")
    result = run_dot_check(dot_fixture(tmp_path, source))
    assert result.returncode == 0, result.stdout + result.stderr
    assert "ok signature dots stay solid" in result.stdout


def test_dot_without_photo_clearance_gap_is_rejected(tmp_path):
    source = (ROOT / "assets/js/site.js").read_text(encoding="utf-8")
    approved = 'ctx.globalCompositeOperation = "destination-out";\n        ctx.beginPath(); ctx.arc(node.cx, node.cy, node.outerR'
    invalid = 'ctx.globalCompositeOperation = "source-over";\n        ctx.beginPath(); ctx.arc(node.cx, node.cy, node.outerR'
    assert source.count(approved) == 1
    result = run_dot_check(dot_fixture(tmp_path, source.replace(approved, invalid, 1)))
    assert result.returncode != 0
    assert "dots over a photo do not cut an invisible clearance gap" in result.stdout


def test_build_runs_both_existing_signature_checkers(tmp_path):
    calls = []

    def fake_call(argv):
        calls.append(Path(argv[-1]).name)
        return int(calls[-1] == "check_signature_speed.py")

    status = build.run_qa_checks(root=tmp_path, call=fake_call)
    assert "check_signature_dots.py" in calls
    assert "check_signature_speed.py" in calls
    assert status == 1
