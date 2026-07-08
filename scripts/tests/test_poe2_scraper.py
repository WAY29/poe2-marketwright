import unittest
import sys
from pathlib import Path

SCRIPT_ROOT = Path(__file__).resolve().parents[1]
if str(SCRIPT_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPT_ROOT))

from poe2_scraper import (
    filter_modifier_links,
    discover_modifier_links,
    extract_modsview_payload,
    flatten_affixes,
)


class ExtractModsViewPayloadTests(unittest.TestCase):
    def test_extracts_embedded_modsview_json(self) -> None:
        html = """
        <html>
          <body>
            <script>
              $(function() {
                new ModsView({
                  "baseitem": {
                    "href": "Amulets",
                    "link_name": "<a href=\\"Amulets\\">Amulets</a>"
                  },
                  "gen": {
                    "1": "Prefix",
                    "2": "Suffix"
                  },
                  "normal": [
                    {
                      "Name": "of the Brute",
                      "Level": "1",
                      "ModGenerationTypeID": "2",
                      "str": "<span class='mod-value'>+(5-8)</span> to Strength",
                      "DropChance": "1000",
                      "ModFamilyList": ["Strength"]
                    }
                  ]
                });
              });
            </script>
          </body>
        </html>
        """

        payload = extract_modsview_payload(html)

        self.assertEqual(payload["baseitem"]["href"], "Amulets")
        self.assertEqual(payload["gen"]["1"], "Prefix")
        self.assertEqual(payload["normal"][0]["Name"], "of the Brute")


class DiscoverModifierLinksTests(unittest.TestCase):
    def test_discovers_relative_and_absolute_modifierscalc_links(self) -> None:
        html = """
        <div class="itemList">
          <a href="/us/Amulets#ModifiersCalc">Amulets</a>
          <a href="Rings#ModifiersCalc">Rings</a>
          <a href="https://poe2db.tw/us/Belts#ModifiersCalc">Belts</a>
          <a href="/us/Modifiers">Modifiers</a>
        </div>
        """

        links = discover_modifier_links(html, "https://poe2db.tw/us/Modifiers")

        self.assertEqual(
            links,
            [
                "https://poe2db.tw/us/Amulets#ModifiersCalc",
                "https://poe2db.tw/us/Rings#ModifiersCalc",
                "https://poe2db.tw/us/Belts#ModifiersCalc",
            ],
        )


class FlattenAffixesTests(unittest.TestCase):
    def test_flattens_page_affixes_with_plain_text(self) -> None:
        payload = {
            "baseitem": {
                "href": "Amulets",
                "link_name": '<a class="ItemClasses" href="Amulets">Amulets</a>',
            },
            "opt": {
                "ItemClassesCode": "Amulet",
                "ItemClassesID": 4,
            },
            "gen": {
                "1": "Prefix",
                "2": "Suffix",
            },
            "normal": [
                {
                    "Name": "of the Brute",
                    "Level": "1",
                    "ModGenerationTypeID": "2",
                    "str": "<span class='mod-value'>+(5-8)</span> to <a href='Strength'>Strength</a>",
                    "DropChance": "1000",
                    "Code": "Strength1",
                    "ModFamilyList": ["Strength"],
                    "spawn_no": ["amulet", "default"],
                    "mod_no": [
                        "<span class='badge bg-primary'>Attribute</span>",
                    ],
                }
            ],
            "essence": [],
        }

        affixes = flatten_affixes(
            page_url="https://poe2db.tw/us/Amulets#ModifiersCalc",
            payload=payload,
        )

        self.assertEqual(len(affixes), 1)
        self.assertEqual(affixes[0]["page_slug"], "Amulets")
        self.assertEqual(affixes[0]["item_class_code"], "Amulet")
        self.assertEqual(affixes[0]["affix_group"], "normal")
        self.assertEqual(affixes[0]["generation_type"], "suffix")
        self.assertEqual(affixes[0]["text"], "+(5-8) to Strength")
        self.assertEqual(affixes[0]["tags"], ["Attribute"])

    def test_uses_url_slug_for_split_file_safe_page_slug(self) -> None:
        payload = {
            "baseitem": {
                "href": "Gloves",
                "link_name": '<a class="ItemClasses" href="Gloves">Gloves</a>',
            },
            "opt": {
                "ItemClassesCode": "Gloves",
                "ItemClassesID": 22,
            },
            "gen": {
                "1": "Prefix",
                "2": "Suffix",
            },
            "normal": [
                {
                    "Name": "of the Brute",
                    "Level": "1",
                    "ModGenerationTypeID": "2",
                    "str": "<span class='mod-value'>+(5-8)</span> to Strength",
                    "DropChance": "1000",
                }
            ],
        }

        affixes = flatten_affixes(
            page_url="https://poe2db.tw/us/Gloves_str#ModifiersCalc",
            payload=payload,
        )

        self.assertEqual(affixes[0]["page_slug"], "Gloves_str")


class FilterModifierLinksTests(unittest.TestCase):
    def test_filters_equipment_scope_by_page_slug(self) -> None:
        links = [
            "https://poe2db.tw/us/Claws#ModifiersCalc",
            "https://poe2db.tw/us/Rings#ModifiersCalc",
            "https://poe2db.tw/us/Waystones_low_tier",
            "https://poe2db.tw/us/Life_Flasks#ModifiersCalc",
            "https://poe2db.tw/us/Bucklers#ModifiersCalc",
        ]

        filtered = filter_modifier_links(links, scope="equipment")

        self.assertEqual(
            filtered,
            [
                "https://poe2db.tw/us/Claws#ModifiersCalc",
                "https://poe2db.tw/us/Rings#ModifiersCalc",
                "https://poe2db.tw/us/Bucklers#ModifiersCalc",
            ],
        )


if __name__ == "__main__":
    unittest.main()
