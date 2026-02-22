import test from "node:test";
import assert from "node:assert/strict";

import { prepareCategoryUpsert } from "../assets/js/modules/repositories/category.repository.js";

test("prepareCategoryUpsert splits add/update and skips invalid rows", () => {
  const existing = [
    { id: 1, code: "11", name_vi: "Old", name_en: "", level: 1, parentCode: null },
  ];
  const rows = [
    { code: "11", name_vi: "New Name", level: "1" },
    { code: "11.1", name_vi: "Child", level: "2", parentCode: "11" },
    { code: "", name_vi: "Missing code" },
    { code: "99", name_vi: "" },
  ];

  const result = prepareCategoryUpsert(rows, existing);

  assert.equal(result.skippedCount, 2);
  assert.equal(result.toUpdate.length, 1);
  assert.equal(result.toUpdate[0].id, 1);
  assert.equal(result.toUpdate[0].name_vi, "New Name");
  assert.equal(result.toAdd.length, 1);
  assert.equal(result.toAdd[0].code, "11.1");
  assert.equal(result.toAdd[0].parentCode, "11");
});
