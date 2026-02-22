function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  return (value || "").toString().trim();
}

function prepareCategoryUpsert(rows, existingCategories) {
  const toAdd = [];
  const toUpdate = [];
  let skippedCount = 0;
  const existingCodes = new Map((existingCategories || []).map((c) => [c.code, c]));

  for (const row of rows || []) {
    const code = normalizeText(row.code);
    const nameVi = normalizeText(row.name_vi);

    if (!code || !nameVi) {
      skippedCount += 1;
      continue;
    }

    const level = parseInt(row.level, 10) === 2 ? 2 : 1;
    const categoryData = {
      code,
      name_vi: nameVi,
      name_en: normalizeText(row.name_en),
      level,
      parentCode: level === 2 ? normalizeText(row.parentCode) || null : null,
    };

    const existing = existingCodes.get(code);
    if (existing) {
      toUpdate.push({ ...existing, ...categoryData });
    } else {
      toAdd.push(categoryData);
    }
  }

  return { toAdd, toUpdate, skippedCount };
}

async function upsertCategories(databaseService, toAdd, toUpdate) {
  await databaseService.db.transaction("rw", databaseService.db.categories, async () => {
    if (Array.isArray(toAdd) && toAdd.length > 0) {
      await databaseService.db.categories.bulkAdd(clone(toAdd));
    }
    if (Array.isArray(toUpdate) && toUpdate.length > 0) {
      await databaseService.db.categories.bulkPut(clone(toUpdate));
    }
  });
}

async function getAllCategories(databaseService) {
  return databaseService.db.categories.toArray();
}

async function saveCategoryRecord(databaseService, categoryInput, mode) {
  const categoryToSave = clone(categoryInput);
  categoryToSave.level = categoryToSave.parentCode ? 2 : 1;

  if (mode === "add") {
    delete categoryToSave.id;
    const newId = await databaseService.db.categories.add(categoryToSave);
    categoryToSave.id = newId;
  } else {
    await databaseService.db.categories.put(categoryToSave);
  }

  return categoryToSave;
}

async function deleteCategoriesByIds(databaseService, ids) {
  await databaseService.db.categories.bulkDelete(ids);
  return { deletedIds: ids };
}

async function seedCategoriesIfEmpty(databaseService, defaultReportStructure) {
  const categoryCount = await databaseService.db.categories.count();
  if (categoryCount > 0) {
    return { seeded: false, seededCount: 0 };
  }

  const categoriesToSeed = [];
  (defaultReportStructure || []).forEach((parent) => {
    categoriesToSeed.push({
      code: parent.code,
      name_vi: parent.name_vi,
      name_en: parent.name_en,
      level: parent.level,
      parentCode: null,
    });

    if (Array.isArray(parent.children)) {
      parent.children.forEach((child) => {
        categoriesToSeed.push({
          code: child.code,
          name_vi: child.name_vi,
          name_en: child.name_en,
          level: child.level,
          parentCode: parent.code,
        });
      });
    }
  });

  await databaseService.db.categories.bulkAdd(categoriesToSeed);
  return { seeded: true, seededCount: categoriesToSeed.length };
}

export {
  prepareCategoryUpsert,
  upsertCategories,
  getAllCategories,
  saveCategoryRecord,
  deleteCategoriesByIds,
  seedCategoriesIfEmpty,
};
