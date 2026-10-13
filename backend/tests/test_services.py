from app.services import basic_requirements

def test_requirement_heuristic_flags_mandatory():
    rows = basic_requirements("The vendor must provide encryption at rest.\nThe response shall include a security policy.")
    assert len(rows) == 2
    assert all(x["mandatory"] for x in rows)

def test_empty_text_has_no_requirements():
    assert basic_requirements("General introduction only.") == []
