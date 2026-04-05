from pathlib import Path

from server.main import _mask_config, _read_csv_page


def test_mask_config_hides_token_values():
    config = {
        "tokens": {"primary": "Bearer abc123", "secondary": "Bearer xyz"},
        "workflows": {"pan_details": {"token": "primary"}},
    }
    masked = _mask_config(config)

    assert masked["tokens"]["primary"] == "Bearer ****"
    assert masked["tokens"]["secondary"] == "Bearer ****"
    assert masked["workflows"]["pan_details"]["token"] == "primary"


def test_read_csv_page_returns_window_and_total(tmp_path: Path):
    csv_path = tmp_path / "sample.csv"
    csv_path.write_text(
        "id,name\n"
        "1,A\n"
        "2,B\n"
        "3,C\n"
        "4,D\n",
        encoding="utf-8",
    )

    columns, rows, total = _read_csv_page(csv_path, offset=1, limit=2)

    assert columns == ["id", "name"]
    assert total == 4
    assert len(rows) == 2
    assert rows[0]["id"] == "2"
    assert rows[1]["name"] == "C"
